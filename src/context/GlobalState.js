import React, { createContext, useReducer, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppReducer from './AppReducer';
import { useAuth } from './AuthContext';
import { todayString, formatDayLabel } from '../utils/dates';

// Before accounts, fridge items lived in this browser under this key
const LEGACY_INGREDIENTS_KEY = 'ingredients';
const RECIPE_SEARCH_KEY = 'recipeSearch';

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

const initialState = {
  // the logged-in user's fridge and pantry, from the server
  ingredients: [],
  ingredientsLoaded: false,
  error: null,
  // short confirmation shown after an action ("Added Milk to your shopping list.")
  notice: null,
  // the logged-in user's shopping list, from the server
  shopping: [],
  shoppingLoaded: false,
  // recipe-page search terms ({ id, value }), kept in this browser only
  searchIngredients: readJson(RECIPE_SEARCH_KEY)
};

export const GlobalContext = createContext(initialState);

function errorMessage(err, fallback) {
  const data = err && err.response && err.response.data;
  if (data && data.errors) return data.errors.join(', ');
  return fallback;
}

/**
 * Copies fridge items saved in this browser before accounts existed into the
 * account, once, then removes them. Recipe search terms in the old list
 * ({ value } without a name) move to their own list instead.
 */
async function importLegacyIngredients() {
  const legacy = readJson(LEGACY_INGREDIENTS_KEY);
  if (!legacy.length) return;

  const fridgeItems = legacy.filter((item) => item && item.name && item.date_expire);
  const searchTerms = legacy.filter((item) => item && item.value && !item.name);
  if (searchTerms.length) {
    const existing = readJson(RECIPE_SEARCH_KEY);
    const known = new Set(existing.map((item) => item.value));
    const merged = existing.concat(searchTerms.filter((item) => !known.has(item.value)));
    localStorage.setItem(RECIPE_SEARCH_KEY, JSON.stringify(merged));
  }
  if (fridgeItems.length) {
    await axios.post('/api/ingredient/import', { ingredients: fridgeItems });
  }
  localStorage.removeItem(LEGACY_INGREDIENTS_KEY);
}

export const GlobalProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(AppReducer, initialState);

  useEffect(() => {
    localStorage.setItem(RECIPE_SEARCH_KEY, JSON.stringify(state.searchIngredients));
  }, [state.searchIngredients]);

  // Load the user's ingredients whenever someone logs in
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'SET_INGREDIENTS', payload: [] });
      dispatch({ type: 'SET_SHOPPING', payload: [] });
      return;
    }
    let cancelled = false;
    axios.get('/api/shopping')
      .then((response) => {
        if (!cancelled) dispatch({ type: 'SET_SHOPPING', payload: response.data });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_ERROR', payload: 'Could not load your shopping list. Please refresh to try again.' });
      });
    importLegacyIngredients()
      .catch(() => {}) // keep the browser copy and try again next time
      .then(() => axios.get('/api/ingredient'))
      .then((response) => {
        if (!cancelled) dispatch({ type: 'SET_INGREDIENTS', payload: response.data });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_ERROR', payload: 'Could not load your kitchen. Please refresh to try again.' });
      });
    return () => { cancelled = true; };
  }, [user]);

  const clearError = useCallback(() => dispatch({ type: 'SET_ERROR', payload: null }), []);

  // Confirmations disappear on their own after a few seconds
  useEffect(() => {
    if (!state.notice) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'SET_NOTICE', payload: null }), 4000);
    return () => clearTimeout(timer);
  }, [state.notice]);

  // Shopping list actions: saved to the server first, then shown
  const addShoppingItem = useCallback(async (item, { notify = false } = {}) => {
    try {
      const response = await axios.post('/api/shopping', item);
      dispatch({ type: response.data.merged ? 'UPDATE_SHOPPING' : 'ADD_SHOPPING', payload: response.data });
      if (notify) dispatch({ type: 'SET_NOTICE', payload: `Added ${response.data.name} to your shopping list.` });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not add that to your shopping list.') });
      return false;
    }
  }, []);

  // Several at once (e.g. a recipe's missing ingredients); the server merges duplicates
  const addShoppingItems = useCallback(async (items) => {
    try {
      const response = await axios.post('/api/shopping/bulk', { items });
      dispatch({ type: 'SET_SHOPPING', payload: response.data.items });
      const count = items.length;
      dispatch({ type: 'SET_NOTICE', payload: `Added ${count} ${count === 1 ? 'item' : 'items'} to your shopping list.` });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not add those to your shopping list.') });
      return false;
    }
  }, []);

  // Puts a recipe on the meal calendar; its ingredients show up under "For planned meals" on Shopping
  const planMeal = useCallback(async (recipe, date) => {
    try {
      const { title, description, minutes, servings, ingredients, steps } = recipe;
      const response = await axios.post('/api/meals', {
        date,
        local_date: todayString(),
        recipe: { title, description, minutes, servings, ingredients: ingredients.map(({ name, amount }) => ({ name, amount })), steps }
      });
      const needs = response.data.needs;
      dispatch({
        type: 'SET_NOTICE',
        payload: `Added ${title} to your calendar for ${formatDayLabel(date)}.` +
          (needs ? ` ${needs} ${needs === 1 ? 'ingredient' : 'ingredients'} to get, listed on Shopping.` : ' You have everything for it.')
      });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not add that to your calendar.') });
      return false;
    }
  }, []);

  const updateShoppingItem = useCallback(async (id, fields) => {
    try {
      const response = await axios.patch(`/api/shopping/${id}`, fields);
      dispatch({ type: 'UPDATE_SHOPPING', payload: response.data });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not update that item.') });
      return false;
    }
  }, []);

  const deleteShoppingItem = useCallback(async (id) => {
    try {
      await axios.delete(`/api/shopping/${id}`);
      dispatch({ type: 'REMOVE_SHOPPING', payload: [id] });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not remove that item.') });
    }
  }, []);

  const clearCheckedShopping = useCallback(async () => {
    try {
      await axios.delete('/api/shopping/checked');
      dispatch({ type: 'REMOVE_CHECKED_SHOPPING' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not clear checked items.') });
    }
  }, []);

  // entries: [{ id, date_expire, fridge_bool, quantity }]
  const moveShoppingToKitchen = useCallback(async (entries) => {
    try {
      const response = await axios.post('/api/shopping/to-kitchen', { items: entries });
      dispatch({ type: 'REMOVE_SHOPPING', payload: entries.map((entry) => entry.id) });
      dispatch({ type: 'ADD_INGREDIENTS', payload: response.data.ingredients });
      const count = response.data.moved;
      dispatch({ type: 'SET_NOTICE', payload: `Moved ${count} ${count === 1 ? 'item' : 'items'} to your kitchen.` });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not move those items to your kitchen.') });
      return false;
    }
  }, []);

  // Fridge/pantry actions: saved to the server first, then shown
  const addIngredient = useCallback(async (ingredient) => {
    try {
      const response = await axios.post('/api/ingredient', { date_start: todayString(), ...ingredient });
      dispatch({ type: 'ADD_INGREDIENT', payload: response.data });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not add that item.') });
      return false;
    }
  }, []);

  // Several items at once (e.g. from a scanned receipt)
  const addIngredients = useCallback(async (items) => {
    try {
      const response = await axios.post('/api/ingredient/import', {
        ingredients: items.map((item) => ({ date_start: todayString(), ...item }))
      });
      const list = await axios.get('/api/ingredient');
      dispatch({ type: 'SET_INGREDIENTS', payload: list.data });
      const count = response.data.imported;
      dispatch({ type: 'SET_NOTICE', payload: `Added ${count} ${count === 1 ? 'item' : 'items'} to your kitchen.` });
      return count;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not add those to your kitchen.') });
      return 0;
    }
  }, []);

  const deleteIngredient = useCallback(async (id) => {
    try {
      await axios.delete(`/api/ingredient/${id}`);
      dispatch({ type: 'DELETE_INGREDIENT', payload: id });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not remove that item.') });
    }
  }, []);

  // Saves changed fields (name, quantity, date_expire, fridge_bool); quantity 0 removes the item
  const updateIngredient = useCallback(async (id, fields) => {
    try {
      const response = await axios.patch(`/api/ingredient/${id}`, fields);
      if (response.data.deleted) dispatch({ type: 'DELETE_INGREDIENT', payload: id });
      else dispatch({ type: 'UPDATE_INGREDIENT', payload: response.data });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(err, 'Could not update that item.') });
      return false;
    }
  }, []);

  // −/+ buttons: going below 1 removes the item
  const changeQuantity = useCallback((id, delta) => {
    const item = state.ingredients.find((ingredient) => ingredient.id === id);
    if (!item) return Promise.resolve(false);
    const quantity = Math.min(9999, Math.max(0, item.quantity + delta));
    return updateIngredient(id, { quantity });
  }, [state.ingredients, updateIngredient]);

  // Recipe search actions (this browser only)
  const addSearchIngredient = useCallback((ingredient) => {
    dispatch({ type: 'ADD_SEARCH_INGREDIENT', payload: ingredient });
  }, []);

  const deleteSearchIngredient = useCallback((id) => {
    dispatch({ type: 'DELETE_SEARCH_INGREDIENT', payload: id });
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        ingredients: state.ingredients,
        ingredientsLoaded: state.ingredientsLoaded,
        error: state.error,
        clearError,
        notice: state.notice,
        shopping: state.shopping,
        shoppingLoaded: state.shoppingLoaded,
        addShoppingItem,
        addShoppingItems,
        planMeal,
        updateShoppingItem,
        deleteShoppingItem,
        clearCheckedShopping,
        moveShoppingToKitchen,
        addIngredient,
        addIngredients,
        deleteIngredient,
        updateIngredient,
        changeQuantity,
        searchIngredients: state.searchIngredients,
        addSearchIngredient,
        deleteSearchIngredient
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
