// Soonest-expiring first, matching the order the server returns
const byExpiry = (list) =>
  [...list].sort((a, b) => (a.date_expire || '').localeCompare(b.date_expire || '') || a.id - b.id);

// Still-needed items first, then in the order they were added
const byChecked = (list) => [...list].sort((a, b) => Number(a.checked) - Number(b.checked) || a.id - b.id);

const AppReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INGREDIENTS':
      return { ...state, ingredients: byExpiry(action.payload), ingredientsLoaded: true };
    case 'ADD_INGREDIENT':
      return { ...state, ingredients: byExpiry([...state.ingredients, action.payload]), error: null };
    case 'UPDATE_INGREDIENT':
      return {
        ...state,
        ingredients: byExpiry(state.ingredients.map((ingredient) =>
          ingredient.id === action.payload.id ? action.payload : ingredient
        )),
        error: null
      };
    case 'DELETE_INGREDIENT':
      return {
        ...state,
        ingredients: state.ingredients.filter((ingredient) => ingredient.id !== action.payload),
        error: null
      };
    case 'ADD_INGREDIENTS':
      return { ...state, ingredients: byExpiry([...state.ingredients, ...action.payload]), error: null };
    case 'MERGE_GLUTEN': {
      const byId = new Map(action.payload.map((u) => [u.id, u]));
      return {
        ...state,
        ingredients: state.ingredients.map((item) => (byId.has(item.id)
          ? { ...item, gluten_status: byId.get(item.id).gluten_status, gluten_reason: byId.get(item.id).gluten_reason }
          : item))
      };
    }
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_NOTICE':
      return { ...state, notice: action.payload };
    case 'SET_SHOPPING':
      return { ...state, shopping: byChecked(action.payload), shoppingLoaded: true };
    case 'ADD_SHOPPING':
      return { ...state, shopping: byChecked([...state.shopping, action.payload]), error: null };
    case 'UPDATE_SHOPPING':
      return {
        ...state,
        shopping: byChecked(state.shopping.map((item) => (item.id === action.payload.id ? action.payload : item))),
        error: null
      };
    case 'REMOVE_SHOPPING': {
      const ids = new Set(action.payload);
      return { ...state, shopping: state.shopping.filter((item) => !ids.has(item.id)), error: null };
    }
    case 'REMOVE_CHECKED_SHOPPING':
      return { ...state, shopping: state.shopping.filter((item) => !item.checked), error: null };
    case 'ADD_SEARCH_INGREDIENT':
      return { ...state, searchIngredients: [...state.searchIngredients, action.payload] };
    case 'DELETE_SEARCH_INGREDIENT':
      return {
        ...state,
        searchIngredients: state.searchIngredients.filter((ingredient) => ingredient.id !== action.payload)
      };
    default:
      return state;
  }
};

export default AppReducer;
