import React, { useCallback, useContext, useRef, useState } from 'react';
import axios from 'axios';
import Modal from './Modal';
import { GlobalContext } from '../context/GlobalState';
import { addDays, todayString } from '../utils/dates';

let nextId = 0;

function siteName(recipe) {
  if (recipe.source_name) return recipe.source_name;
  try {
    return new URL(recipe.source_url).hostname.replace(/^www\./, '');
  } catch (e) {
    return 'the original site';
  }
}

// A recipe from search. Spoonacular recipes saved earlier only keep their title,
// image and link (their terms), so the details load again when opened.
function RecipeCard({ recipe: given }) {
  const titleId = useRef(`recipe-title-${++nextId}`).current;
  const [loaded, setLoaded] = useState(null);
  const recipe = loaded || given;
  const hasDetails = Array.isArray(recipe.ingredients);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const { addShoppingItems, addShoppingItem, planMeal } = useContext(GlobalContext);
  const [added, setAdded] = useState(false);
  const [addedNames, setAddedNames] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [planDate, setPlanDate] = useState(() => addDays(1));
  const [plannedFor, setPlannedFor] = useState(null);
  const missing = hasDetails ? recipe.ingredients.filter((item) => !item.have) : [];

  async function openRecipe() {
    if (hasDetails) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const response = await axios.get(`/api/recipes/details/spoonacular/${recipe.id}?local_date=${todayString()}`);
      setLoaded(response.data);
      setOpen(true);
    } catch (err) {
      setLoadError("This recipe can't be loaded right now. You can still open the original.");
    } finally {
      setLoading(false);
    }
  }

  async function addMissing() {
    const ok = await addShoppingItems(missing.map((item) => ({ name: item.name, note: item.amount || null, source: 'recipe' })));
    if (ok) {
      setAdded(true);
      setAddedNames((names) => [...names, ...missing.map((item) => item.name)]);
    }
  }

  // Any single ingredient, even one you have (e.g. running low)
  async function addOne(item) {
    const ok = await addShoppingItem({ name: item.name, note: item.amount || null, source: 'recipe' }, { notify: true });
    if (ok) setAddedNames((names) => [...names, item.name]);
  }

  async function plan(event) {
    event.preventDefault();
    const ok = await planMeal(recipe, planDate);
    if (ok) {
      setPlannedFor(planDate);
      setPlanning(false);
    }
  }

  const source = recipe.source_url ? (
    <a className="fb-recipe-source" href={recipe.source_url} target="_blank" rel="noopener noreferrer">From {siteName(recipe)} ↗</a>
  ) : recipe.provider === 'ai' ? (
    <span className="fb-recipe-ai">AI-suggested recipe</span>
  ) : null;

  const meta = (
    <p className="fb-recipe-meta">
      {recipe.minutes && <span>⏱ {recipe.minutes} min</span>}
      {recipe.servings && <span>🍽 Serves {recipe.servings}</span>}
      {hasDetails && <span>{missing.length ? `Missing ${missing.length}` : 'You have everything'}</span>}
    </p>
  );

  const ingredients = hasDetails && (
    <ul className="fb-recipe-ingredients" aria-label={`Ingredients for ${recipe.title}`}>
      {recipe.ingredients.map((item) => (
        <li key={item.name} className={item.have ? 'is-have' : 'is-missing'}>
          <span className="fb-visually-hidden">{item.have ? 'Have: ' : 'Need: '}</span>
          <span aria-hidden="true" className="fb-recipe-mark">{item.have ? '✓' : '+'}</span>
          <span className="fb-recipe-ing">{item.amount && <strong>{item.amount} </strong>}{item.name}</span>
          {addedNames.includes(item.name) ? (
            <span className="fb-recipe-added" aria-label={`${item.name} is on your shopping list`}>On list</span>
          ) : (
            <button type="button" className="fb-icon-btn fb-icon-btn-sm" aria-label={`Add ${item.name} to the shopping list`}
              title="Add to shopping list" onClick={() => addOne(item)}>🛒</button>
          )}
        </li>
      ))}
    </ul>
  );

  const actions = (
    <>
      <div className="fb-recipe-buttons">
        {missing.length > 0 && (
          <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={addMissing} disabled={added}>
            {added ? 'Added to shopping list' : `Add ${missing.length} missing to shopping list`}
          </button>
        )}
        {!planning && (
          <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={() => setPlanning(true)}>
            {plannedFor ? 'Add to another day' : '📅 Add to calendar'}
          </button>
        )}
      </div>
      {planning && (
        <form className="fb-plan-form" onSubmit={plan} aria-label={`Plan ${recipe.title}`}>
          <label className="fb-field">
            <span>Day</span>
            <input className="fb-input" type="date" value={planDate} min={todayString()} onChange={(e) => setPlanDate(e.target.value)} required />
          </label>
          <button type="submit" className="fb-btn fb-btn-sm">Add</button>
          <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={() => setPlanning(false)}>Cancel</button>
        </form>
      )}
    </>
  );

  // Clicking anywhere on the card opens the recipe, except on its own controls
  function onCardClick(event) {
    if (!event.target.closest('button, input, label, a, form, summary')) openRecipe();
  }

  return (
    <article className="fb-card fb-recipe-card is-clickable" aria-label={recipe.title} onClick={onCardClick}>
      {recipe.image && <img className="fb-recipe-img" src={recipe.image} alt="" loading="lazy" />}
      <h3><button type="button" className="fb-recipe-open" onClick={openRecipe}>{recipe.title}</button></h3>
      {source}
      {recipe.description && <p className="fb-recipe-desc">{recipe.description}</p>}
      {meta}
      {ingredients}
      {loadError && <p className="fb-recipe-error" role="alert">{loadError}</p>}
      {!open && actions}
      <button type="button" className="fb-link fb-recipe-view" onClick={openRecipe} disabled={loading}>
        {loading ? 'Loading…' : hasDetails ? 'View recipe →' : 'Show ingredients and steps →'}
      </button>

      {open && hasDetails && (
        <Modal labelledBy={titleId} onClose={close}>
          <div className="fb-recipe-modal">
            {recipe.image && <img className="fb-recipe-modal-img" src={recipe.image} alt="" />}
            <h2 id={titleId}>{recipe.title}</h2>
            {source}
            {recipe.description && <p className="fb-recipe-desc">{recipe.description}</p>}
            {meta}
            <h3>Ingredients</h3>
            {ingredients}
            {actions}
            <h3>Steps</h3>
            {recipe.steps && recipe.steps.length ? (
              <ol className="fb-recipe-step-list">
                {recipe.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            ) : (
              <p>The steps are on the original recipe.</p>
            )}
            {recipe.source_url && (
              <a className="fb-btn-ghost fb-btn-sm fb-recipe-full" href={recipe.source_url} target="_blank" rel="noopener noreferrer">
                View the full recipe on {siteName(recipe)} ↗
              </a>
            )}
            <p className="fb-note-text">
              {recipe.provider === 'ai'
                ? 'This recipe was written by AI (Gemini). Double-check cooking times and temperatures.'
                : 'Double-check cooking times and temperatures, especially for meat and fish.'}
            </p>
          </div>
        </Modal>
      )}
    </article>
  );
}

export default RecipeCard;
