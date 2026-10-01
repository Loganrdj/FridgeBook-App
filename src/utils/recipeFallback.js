export function buildFallbackRecipes(ingredients = []) {
  const ingredientList = ingredients.length
    ? ingredients
    : ['eggs', 'bread', 'cheese'];

  return [
    {
      id: 'fallback-1',
      title: `${ingredientList[0]} stir-fry`,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
      missedIngredients: ingredientList.slice(1).map((name) => ({ name }))
    },
    {
      id: 'fallback-2',
      title: `${ingredientList[0]} pasta bowl`,
      image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80',
      missedIngredients: ingredientList.slice(0, 2).map((name) => ({ name }))
    },
    {
      id: 'fallback-3',
      title: `${ingredientList[0]} snack plate`,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      missedIngredients: ingredientList.slice(0, 1).map((name) => ({ name }))
    }
  ];
}
