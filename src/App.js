import React, { useContext, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalProvider, GlobalContext } from './context/GlobalState';
import AppNav from "./components/AppNav"
import Kitchen from "./components/Kitchen"
import Dashboard from "./components/Dashboard"
import Recipes from "./components/Recipes"
import ShoppingList from "./components/ShoppingList"
import ReceiptScan from "./components/ReceiptScan"
import Settings from "./components/Settings"
import GlutenCheck from "./components/GlutenCheck"
import EventCalendar from "./components/EventCalendar"
import Landing from "./components/Landing"
import Logo from "./components/Logo"
import "./styles/brand.css";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect
} from "react-router-dom";

// Shown while we check who's logged in. The free server sleeps when idle, so the
// first visit after a quiet spell can take up to a minute: if loading takes more
// than a moment, say why (fast loads never see the note).
export const SLOW_LOAD_NOTE_DELAY_MS = 1000;

function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_NOTE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fb-splash" aria-label="Loading">
      <Logo />
      {slow && (
        <p className="fb-splash-note" role="status">
          FridgeBook runs on a free server and database, so it's starting up. This first load can take
          up to a minute. Once it's running, everything loads much faster.
        </p>
      )}
    </div>
  );
}

function ErrorBanner() {
  const { error, clearError, notice } = useContext(GlobalContext);
  if (!error) {
    return notice ? <div className="fb-notice" role="status">{notice}</div> : null;
  }
  return (
    <div className="fb-banner" role="alert">
      <span>{error}</span>
      <button type="button" aria-label="Dismiss" onClick={clearError}>×</button>
    </div>
  );
}

// The landing page is the sign-in page; logged-in users go straight to the dashboard
function LandingRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Redirect to="/dashboard" />;
  return <Landing />;
}

// Pages that need a logged-in user; everyone else is sent to the landing page
function PrivateRoute({ component: Component, ...rest }) {
  const { user, loading } = useAuth();
  return (
    <Route {...rest} render={() => {
      if (loading) return <Splash />;
      if (!user) return <Redirect to="/" />;
      return (
        <div className="fb-app">
          <AppNav />
          <ErrorBanner />
          <Component />
        </div>
      );
    }} />
  );
}

function App() {
  return (
    <AuthProvider>
      <GlobalProvider>
        <Router>
          <Switch>
            <Route exact path="/" component={LandingRoute} />
            <PrivateRoute exact path="/dashboard" component={Dashboard} />
            <PrivateRoute exact path="/kitchen" component={Kitchen} />
            <PrivateRoute exact path="/recipes" component={Recipes} />
            <PrivateRoute exact path="/shopping" component={ShoppingList} />
            <PrivateRoute exact path="/scan" component={ReceiptScan} />
            <PrivateRoute exact path="/settings" component={Settings} />
            <PrivateRoute exact path="/gluten" component={GlutenCheck} />
            <PrivateRoute exact path="/calendar" component={EventCalendar} />
            <Redirect to="/" />
          </Switch>
        </Router>
      </GlobalProvider>
    </AuthProvider>
  );
}

export default App;
