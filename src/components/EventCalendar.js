import React, { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import Alert from "sweetalert2";
import "@fullcalendar/core/main.css";
import "@fullcalendar/daygrid/main.css";
import "@fullcalendar/timegrid/main.css";

// Meal planning: drag a saved recipe onto a day. Saved recipes come back once
// they're stored in the account (they used to live in a now-deleted Firebase project).
function EventCalendar() {
  const savedRef = useRef(null);
  const [savedRecipes, setSavedRecipes] = useState([]);

  useEffect(() => {
    const draggable = new Draggable(savedRef.current, {
      itemSelector: ".fb-saved-recipe",
      eventData: (el) => ({ title: el.getAttribute("title"), id: el.getAttribute("data-id") })
    });
    return () => draggable.destroy();
  }, []);

  const eventClick = ({ event }) => {
    Alert.fire({
      title: event.title,
      showCancelButton: true,
      confirmButtonColor: "#C2421F",
      cancelButtonColor: "#2BB39A",
      confirmButtonText: "Remove from calendar",
      cancelButtonText: "Close"
    }).then((result) => {
      if (result.value) event.remove();
    });
  };

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Calendar</h1>
        <p>Plan your meals for the week.</p>
      </header>
      <div className="fb-calendar-layout">
        <section className="fb-card" aria-labelledby="saved-recipes-title">
          <div className="fb-card-header">
            <h2 id="saved-recipes-title"><span className="fb-card-icon" aria-hidden="true">📌</span>Saved recipes</h2>
          </div>
          <div ref={savedRef}>
            {savedRecipes.length === 0 ? (
              <p className="fb-empty">Saving recipes is coming soon. Then you'll drag them onto a day to plan your week.</p>
            ) : savedRecipes.map((recipe) => (
              <div key={recipe.id} className="fb-saved-recipe" title={recipe.title} data-id={recipe.id}>
                <span>{recipe.title}</span>
                <button type="button" className="fb-icon-btn" aria-label={`Remove ${recipe.title}`}
                  onClick={() => setSavedRecipes(savedRecipes.filter((r) => r.id !== recipe.id))}>×</button>
              </div>
            ))}
          </div>
        </section>
        <section className="fb-card fb-calendar" aria-label="Meal calendar">
          <FullCalendar
            defaultView="dayGridMonth"
            header={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
            height="auto"
            eventDurationEditable={false}
            editable={true}
            droppable={true}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            eventClick={eventClick}
          />
        </section>
      </div>
    </main>
  );
}

export default EventCalendar;
