import React, { useEffect } from 'react';
import "./style.css";
import { Link, NavLink } from 'react-router-dom';
import { useAuth, LOGOUT_URL } from '../context/AuthContext';
import Logo from './Logo';

const IDLE_LIMIT_MS = 30 * 60 * 1000;

// Logs out after 30 idle minutes, so the next person on a shared device
// doesn't land in someone else's kitchen
function useIdleLogout() {
    useEffect(() => {
        let timer;
        const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(() => { window.location.href = LOGOUT_URL; }, IDLE_LIMIT_MS);
        };
        const events = ['mousemove', 'keydown', 'touchstart', 'scroll'];
        events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
        reset();
        return () => {
            clearTimeout(timer);
            events.forEach((event) => window.removeEventListener(event, reset));
        };
    }, []);
}

function Nav() {
    const { user } = useAuth();
    useIdleLogout();

    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-light sticky-top fb-nav">
            <Link className="navbar-brand" to="/dashboard"><Logo className="fb-logo-nav" /></Link>
            <ul className="nav-links navbar-nav mr-auto">
                <NavLink to="/dashboard" className="nav-link"><li className="nav-item">Dashboard</li></NavLink>
                <NavLink to="/kitchen" className="nav-link"><li className="nav-item">Kitchen</li></NavLink>
                <NavLink to="/recipes" className="nav-link"><li className="nav-item">Recipes</li></NavLink>
                <NavLink to="/calendar" className="nav-link"><li className="nav-item">Calendar</li></NavLink>
            </ul>
            {user && <span className="fb-nav-user">{user.name.split(' ')[0]}</span>}
            <a href={LOGOUT_URL}><button className="px-3 py-2 rounded-md bg-black-500 text-white focus:outline-none hover:bg-gray-400">Log Out</button></a>
        </nav>
    );
}

export default Nav;
