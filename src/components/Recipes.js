import React, { useContext, useState } from 'react';
import axios from 'axios';
import AddIngredient from './AddIngredient';
import RecipeCard from './RecipeCard';
import { GlobalContext } from '../context/GlobalState';
import { daysUntil } from '../utils/dates';

// Recipe ideas from Gemini, built around the chosen ingredients and the kitchen
function Recipes() {
  const { ingredients, searchIngredients, addSearchIngredient, deleteSearchIngredient } = useContext(GlobalContext);
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(null);

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

  async function findRecipes() {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/recipes/suggest', { ingredients: chosen });
      setRecipes(response.data.recipes);
      setRemaining(response.data.remaining);
    } catch (err) {
      const data = err.response && err.response.data;
      setError((data && (data.error || (data.errors && data.errors.join(', ')))) || 'Recipe ideas are unavailable right now. Please try again in a minute.');
      if (data && data.remaining !== undefined) setRemaining(data.remaining);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Recipes</h1>
        <p>Ideas built around what you already have, starting with what expires soonest.</p>
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
        <div className="fb-recipe-actions">
          <button type="button" className="fb-btn" onClick={findRecipes} disabled={loading}>
            {loading ? 'Thinking up recipes…' : chosen.length ? 'Find recipes' : 'Find recipes from my kitchen'}
          </button>
          {remaining !== null && <span className="fb-count">{remaining} {remaining === 1 ? 'search' : 'searches'} left today</span>}
        </div>
      </section>

      {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}

      {loading && (
        <p className="fb-empty" role="status">
          <span className="fb-empty-icon" aria-hidden="true">🍳</span>
          Checking your kitchen and thinking up recipes…
        </p>
      )}

      {!loading && recipes && (
        <section aria-label="Recipe ideas">
          <p className="fb-note-text">
            AI-generated with Gemini. Double-check cooking times and temperatures, especially for meat and fish.
          </p>
          <div className="fb-recipe-grid">
            {recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
          </div>
        </section>
      )}
    </main>
  );
}

export default Recipes;
