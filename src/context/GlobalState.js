import React, { createContext, useReducer, useEffect } from 'react';
import AppReducer from './AppReducer';

// Initial state
const initialState = {
  ingredients: JSON.parse(localStorage.getItem('ingredients')) || [],
  recipes: null,
  loading: false
};

// Create context
export const GlobalContext = createContext(initialState);

// Provider component
export const GlobalProvider = ({ children }) => {
  const [state, dispatch] = useReducer(AppReducer, initialState);

  useEffect(() => {
    localStorage.setItem('ingredients', JSON.stringify(state.ingredients));
  }, [state.ingredients]);

  // Actions
  function deleteIngredient(id) {
    dispatch({
      type: 'DELETE_INGREDIENT',
      payload: id
    });
  }

  function addIngredient(ingredient) {
    dispatch({
      type: 'ADD_INGREDIENT',
      payload: ingredient
    });
  }

  function updateIngredientQuantity(id, amount) {
    dispatch({
      type: 'UPDATE_INGREDIENT_QUANTITY',
      payload: { id, amount }
    });
  }

  return (
    <GlobalContext.Provider
      value={{
        ingredients: state.ingredients,
        deleteIngredient,
        addIngredient,
        updateIngredientQuantity
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
