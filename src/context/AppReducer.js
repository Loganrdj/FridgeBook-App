// Soonest-expiring first, matching the order the server returns
const byExpiry = (list) =>
  [...list].sort((a, b) => (a.date_expire || '').localeCompare(b.date_expire || '') || a.id - b.id);

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
    case 'SET_ERROR':
      return { ...state, error: action.payload };
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
