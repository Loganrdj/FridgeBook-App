import React from 'react';

function RecipeCard({ recipe }) {
  const missing = recipe.missedIngredients || [];
  return (
    <article className="fb-card fb-recipe-card">
      <img src={recipe.image} alt="" loading="lazy" />
      <div className="fb-recipe-body">
        <h3>{recipe.title}</h3>
        {missing.length > 0 && (
          <p className="fb-recipe-missing">Also needs: {missing.map((item) => item.name).join(', ')}</p>
        )}
      </div>
    </article>
  );
}

export default RecipeCard;
