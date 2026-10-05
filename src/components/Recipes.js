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
  const [dish, setDish] = useState('');
  const [pending, setPending] = useState(''); // typed in the ingredient box but not added yet
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

  async function findRecipes(event) {
    if (event) event.preventDefault();
    // anything still typed in the ingredient box counts too
    const typed = pending.trim().toLowerCase();
    const terms = typed && !chosen.includes(typed) ? [...chosen, typed] : chosen;
    if (typed) {
      if (!chosen.includes(typed)) addSearchIngredient({ id: `typed-${Date.now()}`, value: typed });
      setPending('');
    }
    const wanted = dish.trim();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/recipes/suggest', { dish: wanted, ingredients: terms, local_date: todayString() });
      const batch = { id: `${Date.now()}`, day: todayString(), at: new Date().toISOString(), dish: wanted, terms, recipes: response.data.recipes };
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
        <form className="fb-form fb-dish-form" onSubmit={findRecipes}>
          <label className="fb-field">
            <span>What do you want to make? <span className="fb-optional">(optional)</span></span>
            <input className="fb-input" value={dish} onChange={(e) => setDish(e.target.value)} maxLength={80}
              placeholder="e.g. ratatouille, pad thai, banana bread" autoComplete="off" />
          </label>
        </form>
        <div className="fb-field fb-recipe-search">
          <span className="fb-field-label">Ingredients to use <span className="fb-optional">(optional)</span></span>
          <AddIngredient value={pending} onValueChange={setPending} />
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
            {loading ? 'Thinking up recipes…' : dish.trim() || chosen.length || pending.trim() ? 'Find recipes' : 'Find recipes from my kitchen'}
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
              Recipes come from published sources where possible; any written by AI are labeled.
              Double-check cooking times and temperatures. Today's ideas stay on this device until midnight.
              {history.some((batch) => batch.recipes.some((r) => r.provider === 'spoonacular')) && (
                <> Recipe search <a className="fb-link" href="https://spoonacular.com/food-api" target="_blank" rel="noopener noreferrer">powered by spoonacular</a>.</>
              )}
            </p>
            <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={clearHistory}>Clear ideas</button>
          </div>
          {history.map((batch) => (
            <section key={batch.id} className="fb-history-batch" aria-label={`Search at ${timeLabel(batch.at)}`}>
              <h2 className="fb-history-title">
                {batch.dish
                  ? `${batch.dish}${batch.terms.length ? ` with ${batch.terms.join(', ')}` : ''}`
                  : batch.terms.length ? `With ${batch.terms.join(', ')}` : 'From your kitchen'}
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
