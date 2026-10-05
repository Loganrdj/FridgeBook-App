import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Alert from "sweetalert2";
import "@fullcalendar/core/main.css";
import "@fullcalendar/daygrid/main.css";
import "@fullcalendar/timegrid/main.css";
import { todayString, daysUntil, formatDayLabel } from "../utils/dates";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Meal planning: recipes added from the Recipes page, one per day or several
function EventCalendar() {
  const [meals, setMeals] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const today = todayString();
    return Promise.all([
      axios.get(`/api/meals?local_date=${today}`),
      axios.get(`/api/meals/needs?local_date=${today}`)
    ]).then(([mealsResponse, needsResponse]) => {
      setMeals(mealsResponse.data);
      setNeeds(needsResponse.data);
    }).catch(() => setError("Could not load your meal plan. Please refresh to try again."));
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMeal = async ({ event }) => {
    const meal = meals.find((m) => String(m.id) === event.id);
    if (!meal) return;
    let recipe = meal.recipe;
    if (recipe.provider === "spoonacular") {
      // saved as a reference only (their terms), so fetch the details now
      try {
        const response = await axios.get(`/api/recipes/details/spoonacular/${recipe.external_id}?local_date=${todayString()}`);
        recipe = { ...recipe, ...response.data };
      } catch (err) {
        recipe = { ...recipe, ingredients: [], steps: [] };
      }
    }
    const needFor = (name) => needs.find((n) => n.meal_id === meal.id && n.name.toLowerCase() === name.toLowerCase());
    const status = (name) => {
      const need = needFor(name);
      if (!need) return "";
      return need.on_list ? ' <em class="is-listed">(on your list)</em>' : " <em>(to get)</em>";
    };
    const html = `
      <div class="fb-meal-popup">
        <p>${escapeHtml(formatDayLabel(meal.date))}${recipe.minutes ? ` · ${recipe.minutes} min` : ""}${recipe.servings ? ` · serves ${recipe.servings}` : ""}</p>
        <h4>Ingredients</h4>
        <ul>${(recipe.ingredients || []).map((i) => `<li>${i.amount ? `<strong>${escapeHtml(i.amount)}</strong> ` : ""}${escapeHtml(i.name)}${status(i.name)}</li>`).join("")}</ul>
        <h4>Steps</h4>
        ${recipe.steps && recipe.steps.length ? `<ol>${recipe.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>` : "<p>The steps are on the original recipe.</p>"}
        ${recipe.source_url ? `<p><a href="${escapeHtml(recipe.source_url)}" target="_blank" rel="noopener noreferrer">View the full recipe${recipe.source_name ? ` on ${escapeHtml(recipe.source_name)}` : ""} ↗</a></p>` : ""}
      </div>`;
    Alert.fire({
      title: escapeHtml(meal.title),
      html,
      showCancelButton: true,
      confirmButtonColor: "#C2421F",
      cancelButtonColor: "#2BB39A",
      confirmButtonText: "Remove from calendar",
      cancelButtonText: "Close"
    }).then((result) => {
      if (result.value) {
        axios.delete(`/api/meals/${meal.id}`).then(load).catch(() => setError("Could not remove that meal."));
      }
    });
  };

  const moveMeal = ({ event, revert }) => {
    const date = todayString(event.start);
    axios.patch(`/api/meals/${event.id}`, { date, local_date: todayString() })
      .then(load)
      .catch(() => { revert(); setError("Could not move that meal."); });
  };

  const upcoming = meals.filter((meal) => daysUntil(meal.date) >= 0).slice(0, 8);
  const toGetCount = needs.filter((n) => !n.on_list).length;

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Calendar</h1>
        <p>Plan your meals. Add recipes from the Recipes page, then drag them to move them.</p>
      </header>
      {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}
      <div className="fb-calendar-layout">
        <section className="fb-card" aria-labelledby="upcoming-title">
          <div className="fb-card-header">
            <h2 id="upcoming-title"><span className="fb-card-icon" aria-hidden="true">📌</span>Upcoming</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="fb-empty">No meals planned yet. Find a recipe and choose "Add to calendar".</p>
          ) : (
            <ul className="fb-soon-list">
              {upcoming.map((meal) => (
                <li key={meal.id}>
                  <div>
                    <div className="fb-soon-name">{meal.title}</div>
                    <div className="fb-soon-meta">{formatDayLabel(meal.date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {toGetCount > 0 && (
            <Link to="/shopping" className="fb-btn-ghost fb-btn-sm" style={{ marginTop: 12 }}>
              {toGetCount} {toGetCount === 1 ? "ingredient" : "ingredients"} to get
            </Link>
          )}
          <p className="fb-note-text" style={{ marginTop: 14 }}>
            <Link to="/recipes" className="fb-link">Find recipes to plan →</Link>
          </p>
        </section>
        <section className="fb-card fb-calendar" aria-label="Meal calendar">
          <FullCalendar
            defaultView="dayGridMonth"
            header={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
            buttonText={{ today: "Today", month: "Month", week: "Week" }}
            height="auto"
            allDaySlot={true}
            editable={true}
            eventDurationEditable={false}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            events={meals.map((meal) => ({ id: String(meal.id), title: meal.title, start: meal.date, allDay: true }))}
            eventClick={showMeal}
            eventDrop={moveMeal}
          />
        </section>
      </div>
    </main>
  );
}

export default EventCalendar;
