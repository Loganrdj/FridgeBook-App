import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth, LOGOUT_URL } from '../context/AuthContext';
import Logo from './Logo';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const LINKS = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/kitchen', label: 'Kitchen' },
    { to: '/recipes', label: 'Recipes' },
    { to: '/calendar', label: 'Calendar' }
];

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

function AppNav() {
    const { user } = useAuth();
    useIdleLogout();
    const firstName = user ? user.name.split(' ')[0] : '';

    return (
        <nav className="fb-appnav" aria-label="Main">
            <div className="fb-appnav-inner">
                <Link className="fb-appnav-brand" to="/dashboard"><Logo /></Link>
                <ul className="fb-appnav-links">
                    {LINKS.map((link) => (
                        <li key={link.to}><NavLink to={link.to}>{link.label}</NavLink></li>
                    ))}
                </ul>
                <div className="fb-appnav-user">
                    <span className="fb-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</span>
                    <span className="fb-appnav-name">{firstName}</span>
                    <a className="fb-btn-ghost fb-btn-sm" href={LOGOUT_URL}>Log out</a>
                </div>
            </div>
        </nav>
    );
}

export default AppNav;
