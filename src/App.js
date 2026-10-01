import React, { useContext } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalProvider, GlobalContext } from './context/GlobalState';
import Nav from "./components/Nav"
import Kitchen from "./components/Kitchen"
import Dashboard from "./components/Dashboard"
import Final from "./components/Final"
import EventCalendar from "./components/EventCalendar"
import Landing from "./components/Landing"
import Logo from "./components/Logo"
import "./components/Landing.css";
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
  const { error, clearError } = useContext(GlobalContext);
  if (!error) return null;
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center m-3" role="alert">
      <span>{error}</span>
      <button type="button" className="close" aria-label="Dismiss" onClick={clearError}>×</button>
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
        <>
          <Nav />
          <ErrorBanner />
          <Component />
        </>
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
            <PrivateRoute exact path="/recipes" component={Final} />
            <PrivateRoute exact path="/calendar" component={EventCalendar} />
            <Redirect to="/" />
          </Switch>
        </Router>
      </GlobalProvider>
    </AuthProvider>
  );
}

export default App;
