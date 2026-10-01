export default (state, action) => {
  switch (action.type) {
    case 'DELETE_INGREDIENT':
      return {
        ...state,
        ingredients: state.ingredients.filter(
          ingredient => ingredient.id !== action.payload
        )
      };
    case 'ADD_INGREDIENT':
      return {
        ...state,
        ingredients: [...state.ingredients, action.payload]
      };
    case 'UPDATE_INGREDIENT_QUANTITY':
      return {
        ...state,
        ingredients: state.ingredients.flatMap((ingredient) => {
          if (ingredient.id !== action.payload.id) {
            return [ingredient];
          }

          const updatedQuantity = Number(ingredient.quantity) - Number(action.payload.amount);
          return updatedQuantity > 0 ? [{ ...ingredient, quantity: updatedQuantity }] : [];
        })
      };
    default:
      return state;
  }
};
