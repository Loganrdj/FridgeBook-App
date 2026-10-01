import React, { useContext } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalProvider, GlobalContext } from './context/GlobalState';
import AppNav from "./components/AppNav"
import Kitchen from "./components/Kitchen"
import Dashboard from "./components/Dashboard"
import Recipes from "./components/Recipes"
import ShoppingList from "./components/ShoppingList"
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

function Splash() {
  return <div className="fb-splash" aria-label="Loading"><Logo /></div>;
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
            <PrivateRoute exact path="/calendar" component={EventCalendar} />
            <Redirect to="/" />
          </Switch>
        </Router>
      </GlobalProvider>
    </AuthProvider>
  );
}

export default App;
