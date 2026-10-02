import React, { useContext, useState } from 'react';
import { GlobalContext } from '../context/GlobalState';
import { addDays, todayString } from '../utils/dates';

function RecipeCard({ recipe }) {
  const { addShoppingItems, planMeal } = useContext(GlobalContext);
  const [added, setAdded] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planDate, setPlanDate] = useState(() => addDays(1));
  const [plannedFor, setPlannedFor] = useState(null);
  const missing = recipe.ingredients.filter((item) => !item.have);

  async function addMissing() {
    const ok = await addShoppingItems(missing.map((item) => ({ name: item.name, note: item.amount || null, source: 'recipe' })));
    if (ok) setAdded(true);
  }

  async function plan(event) {
    event.preventDefault();
    const ok = await planMeal(recipe, planDate);
    if (ok) {
      setPlannedFor(planDate);
      setPlanning(false);
    }
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
