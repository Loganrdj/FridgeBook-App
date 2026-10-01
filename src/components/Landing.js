import React from 'react';
import { LOGIN_URL } from '../context/AuthContext';
import Logo from './Logo';
import './Landing.css';

const FEATURES = [
  { icon: '🧊', title: 'Track it', text: 'Everything in your fridge and pantry, with quantities and expiration dates.' },
  { icon: '⏰', title: 'Use it in time', text: 'Get a heads-up a couple of days before something goes bad.' },
  { icon: '🍳', title: 'Cook with it', text: 'Find recipe ideas that use what you already have.' },
  { icon: '📅', title: 'Plan it', text: 'Drag recipes onto a calendar and plan the week ahead.' }
];

// Decorative food, labelled for screen readers by the fridge's aria-label
const Food = ({ children, className = '' }) => (
  <span className={`fb-food ${className}`} aria-hidden="true">{children}</span>
);

function GoogleIcon() {
  return (
    <svg className="fb-google-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function Fridge() {
  return (
    <div className="fb-fridge-stage">
      <div className="fb-fridge" role="img" aria-label="An open fridge with milk, cheese, eggs, fruit and vegetables inside">
        {/* Freezer, closed, with a shopping-list note and a magnet */}
        <div className="fb-freezer">
          <div className="fb-note" aria-hidden="true">
            <span>milk</span>
            <span className="fb-note-done">eggs</span>
            <span>basil</span>
          </div>
          <div className="fb-magnet" aria-hidden="true">🍋</div>
          <div className="fb-handle fb-handle-freezer" />
        </div>

        {/* Main compartment, door open */}
        <div className="fb-main">
          <div className="fb-interior">
            <div className="fb-light" />
            <div className="fb-shelf fb-shelf-top">
              <Food>🥛</Food><Food>🧀</Food><Food>🥚</Food><Food className="fb-food-sm">🧈</Food>
            </div>
            <div className="fb-shelf fb-shelf-middle" />
            <div className="fb-drawer">
              <Food>🥕</Food><Food>🍎</Food><Food>🥬</Food><Food>🍓</Food>
            </div>
          </div>

          {/* Sign-in card sitting on the middle shelf */}
          <div className="fb-signin">
            <p className="fb-signin-label">Your kitchen is waiting</p>
            <a className="fb-signin-button" href={LOGIN_URL}>
              <GoogleIcon />
              <span>Sign in with Google</span>
            </a>
          </div>

          <div className="fb-door">
            <div className="fb-door-front">
              <div className="fb-handle fb-handle-main" />
            </div>
            <div className="fb-door-back" aria-hidden="true">
              <div className="fb-door-rail"><Food className="fb-food-sm">🧃</Food><Food className="fb-food-sm">🍯</Food></div>
              <div className="fb-door-rail"><Food className="fb-food-sm">🥫</Food><Food className="fb-food-sm">🧴</Food></div>
            </div>
          </div>
        </div>
        <div className="fb-chill" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <div className="fb-floor-shadow" aria-hidden="true" />
    </div>
  );
}

function Landing() {
  const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';

  return (
    <div className="fb-landing">
      <header className="fb-topbar">
        <Logo />
      </header>

      <main>
        <section className="fb-hero">
          <div className="fb-hero-text">
            <p className="fb-eyebrow">Your kitchen, organized</p>
            <h1 className="fb-title">Open the fridge.<br />Know what's inside.</h1>
            <p className="fb-lede">
              FridgeBook keeps track of what's in your fridge and pantry, reminds you before food
              goes bad, and suggests recipes from what you already have.
            </p>
            {loginFailed && (
              <p className="fb-alert" role="alert">Sign-in didn't finish. Give it another try.</p>
            )}
            <p className="fb-hint">
              <span className="fb-hint-desktop">Sign in from inside the fridge →</span>
              <span className="fb-hint-mobile">Sign in from inside the fridge ↓</span>
            </p>
          </div>
          <Fridge />
        </section>

        <section className="fb-features" aria-label="What FridgeBook does">
          {FEATURES.map((feature) => (
            <div className="fb-feature" key={feature.title}>
              <span className="fb-feature-icon" aria-hidden="true">{feature.icon}</span>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="fb-footer">© {new Date().getFullYear()} FridgeBook</footer>
    </div>
  );
}

export default Landing;
