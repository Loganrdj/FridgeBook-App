import React, { useContext, useState } from 'react';
import { GlobalContext } from '../context/GlobalState';

function RecipeCard({ recipe }) {
  const { addShoppingItems } = useContext(GlobalContext);
  const [added, setAdded] = useState(false);
  const missing = recipe.ingredients.filter((item) => !item.have);

  async function addMissing() {
    const ok = await addShoppingItems(missing.map((item) => ({ name: item.name, note: item.amount || null, source: 'recipe' })));
    if (ok) setAdded(true);
  }

  return (
    <article className="fb-card fb-recipe-card" aria-label={recipe.title}>
      <h3>{recipe.title}</h3>
      {recipe.description && <p className="fb-recipe-desc">{recipe.description}</p>}
      <p className="fb-recipe-meta">
        {recipe.minutes && <span>⏱ {recipe.minutes} min</span>}
        {recipe.servings && <span>🍽 Serves {recipe.servings}</span>}
        <span>{missing.length ? `Missing ${missing.length}` : 'You have everything'}</span>
      </p>

      <ul className="fb-recipe-ingredients" aria-label={`Ingredients for ${recipe.title}`}>
        {recipe.ingredients.map((item) => (
          <li key={item.name} className={item.have ? 'is-have' : 'is-missing'}>
            <span className="fb-visually-hidden">{item.have ? 'Have: ' : 'Need: '}</span>
            <span aria-hidden="true" className="fb-recipe-mark">{item.have ? '✓' : '+'}</span>
            <span>{item.amount && <strong>{item.amount} </strong>}{item.name}</span>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={addMissing} disabled={added}>
          {added ? 'Added to shopping list' : `Add ${missing.length} missing to shopping list`}
        </button>
      )}

      <details className="fb-recipe-steps">
        <summary>Show steps</summary>
        <ol>
          {recipe.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      </details>
    </article>
  );
}

export default RecipeCard;
