import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import AddIngredient from './AddIngredient';
import RecipeCard from './RecipeCard';
import { GlobalContext } from '../context/GlobalState';
import { useAuth } from '../context/AuthContext';
import { daysUntil, todayString, msUntilMidnight, formatDuration } from '../utils/dates';
import { loadHistory, saveHistory, addBatch } from '../utils/recipeHistory';

function timeLabel(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Ticks every minute: time left until searches and saved ideas reset at midnight
function useMidnightCountdown() {
  const [left, setLeft] = useState(() => msUntilMidnight());
  useEffect(() => {
    const timer = setInterval(() => setLeft(msUntilMidnight()), 60000);
    return () => clearInterval(timer);
  }, []);
  return formatDuration(left);
}

// Recipe ideas from Gemini, built around the chosen ingredients and the kitchen.
// Each search is kept (newest on top) until midnight.
function Recipes() {
  const { user } = useAuth();
  const userId = user && user.id;
  const { ingredients, searchIngredients, addSearchIngredient, deleteSearchIngredient } = useContext(GlobalContext);
  const [history, setHistory] = useState(() => loadHistory(userId, todayString()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(null);
  const resetsIn = useMidnightCountdown();

  const chosen = searchIngredients.map((item) => item.value);

  useEffect(() => {
    let cancelled = false;
    axios.get(`/api/recipes/usage?local_date=${todayString()}`)
      .then((response) => { if (!cancelled) setRemaining(response.data.remaining); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
      const response = await axios.post('/api/recipes/suggest', { ingredients: chosen, local_date: todayString() });
      const batch = { id: `${Date.now()}`, day: todayString(), at: new Date().toISOString(), terms: chosen, recipes: response.data.recipes };
      const next = addBatch(loadHistory(userId, todayString()), batch);
      saveHistory(userId, next);
      setHistory(next);
      setRemaining(response.data.remaining);
    } catch (err) {
      const data = err.response && err.response.data;
      setError((data && (data.error || (data.errors && data.errors.join(', ')))) || 'Recipe ideas are unavailable right now. Please try again in a minute.');
      if (data && data.remaining !== undefined) setRemaining(data.remaining);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    saveHistory(userId, []);
    setHistory([]);
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
          <button type="button" className="fb-btn" onClick={findRecipes} disabled={loading || remaining === 0}>
            {loading ? 'Thinking up recipes…' : chosen.length ? 'Find recipes' : 'Find recipes from my kitchen'}
          </button>
          {remaining !== null && (
            <span className="fb-count">
              {remaining} {remaining === 1 ? 'search' : 'searches'} left today · resets in {resetsIn}
            </span>
          )}
        </div>
      </section>

      {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}

      {loading && (
        <p className="fb-empty" role="status">
          <span className="fb-empty-icon" aria-hidden="true">🍳</span>
          Checking your kitchen and thinking up recipes…
        </p>
      )}

      {history.length > 0 && (
        <section aria-label="Recipe ideas">
          <div className="fb-history-header">
            <p className="fb-note-text">
              AI-generated with Gemini. Double-check cooking times and temperatures, especially for meat and fish.
              Today's ideas stay on this device until midnight.
            </p>
            <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={clearHistory}>Clear ideas</button>
          </div>
          {history.map((batch) => (
            <section key={batch.id} className="fb-history-batch" aria-label={`Search at ${timeLabel(batch.at)}`}>
              <h2 className="fb-history-title">
                {batch.terms.length ? `With ${batch.terms.join(', ')}` : 'From your kitchen'}
                <span className="fb-count"> · {timeLabel(batch.at)}</span>
              </h2>
              <div className="fb-recipe-grid">
                {batch.recipes.map((recipe) => <RecipeCard key={`${batch.id}-${recipe.id}`} recipe={recipe} />)}
              </div>
            </section>
          ))}
        </section>
      )}
    </main>
  );
}

export default Recipes;
