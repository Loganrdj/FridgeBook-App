import React, { useContext, useState } from 'react';
import AddIngredient from './AddIngredient';
import RecipeCard from './RecipeCard';
import { GlobalContext } from '../context/GlobalState';
import { buildFallbackRecipes } from '../utils/recipeFallback';
import { daysUntil } from '../utils/dates';

// Recipe ideas from chosen ingredients. Results are sample ideas until a recipe API is connected.
function Recipes() {
  const { ingredients, searchIngredients, addSearchIngredient, deleteSearchIngredient } = useContext(GlobalContext);
  const [recipes, setRecipes] = useState(null);

  const chosen = searchIngredients.map((item) => item.value);

  // Adds the kitchen items that expire soonest (up to 5) to the search
  function useExpiring() {
    const known = new Set(chosen.map((name) => name.toLowerCase()));
    ingredients
      .filter((item) => daysUntil(item.date_expire) !== null && daysUntil(item.date_expire) >= 0)
      .slice(0, 5)
      .filter((item) => !known.has(item.name.toLowerCase()))
      .forEach((item) => addSearchIngredient({ id: `kitchen-${item.id}`, value: item.name.toLowerCase() }));
  }

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Recipes</h1>
        <p>Find ideas that use what you already have.</p>
      </header>

      <section className="fb-card" aria-labelledby="cook-with-title" style={{ marginBottom: 20 }}>
        <div className="fb-card-header">
          <h2 id="cook-with-title"><span className="fb-card-icon" aria-hidden="true">🥕</span>Cook with</h2>
          <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={useExpiring} disabled={ingredients.length === 0}>
            Use what's expiring
          </button>
        </div>
        <div className="fb-recipe-search">
          <AddIngredient />
        </div>
        {chosen.length > 0 && (
          <ul className="fb-chips fb-chosen" aria-label="Chosen ingredients">
            {searchIngredients.map((item) => (
              <li key={item.id}>
                <button type="button" className="fb-chip is-active" onClick={() => deleteSearchIngredient(item.id)}
                  aria-label={`Remove ${item.value}`}>
                  {item.value} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 16 }}>
          <button type="button" className="fb-btn" onClick={() => setRecipes(buildFallbackRecipes(chosen))}>
            Find recipes
          </button>
        </div>
      </section>

      {recipes && (
        <section aria-label="Recipe ideas">
          <p className="fb-note-text">Recipe search is being rebuilt, so these are sample ideas for now.</p>
          <div className="fb-recipe-grid">
            {recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
          </div>
        </section>
      )}
    </main>
  );
}

export default Recipes;
