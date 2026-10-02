import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import AddItemForm from './AddItemForm';
import ExpiryBadge from './ExpiryBadge';
import { GlobalContext } from '../context/GlobalState';
import { useAuth } from '../context/AuthContext';
import { daysUntil, formatShortDate } from '../utils/dates';

function greeting(now = new Date()) {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function Dashboard() {
    const { user } = useAuth();
    const { ingredients, ingredientsLoaded, addIngredient } = useContext(GlobalContext);
    const firstName = user ? user.name.split(' ')[0] : '';

    const withDays = ingredients.map((item) => ({ ...item, days: daysUntil(item.date_expire) }));
    const expired = withDays.filter((item) => item.days !== null && item.days < 0);
    const soon = withDays.filter((item) => item.days !== null && item.days >= 0 && item.days <= 3);
    const stats = [
        { label: 'In the fridge', value: ingredients.filter((i) => i.fridge_bool).length, tone: '' },
        { label: 'In the pantry', value: ingredients.filter((i) => !i.fridge_bool).length, tone: '' },
        { label: 'Use within 3 days', value: soon.length, tone: 'fb-stat-soon' },
        { label: 'Expired', value: expired.length, tone: 'fb-stat-expired' }
    ];
    // expired first, then soonest; ingredients are already sorted by date
    const useSoon = [...expired, ...soon];

    return (
        <main className="fb-page">
            <header className="fb-page-header">
                <h1>{firstName ? `${greeting()}, ${firstName}` : greeting()}</h1>
                <p>Here's what's happening in your kitchen.</p>
            </header>

            <section className="fb-stats" aria-label="Kitchen summary">
                {stats.map((stat) => (
                    <div key={stat.label} className={`fb-card fb-stat ${stat.tone}`}>
                        <div className="fb-stat-value">{ingredientsLoaded ? stat.value : '–'}</div>
                        <div className="fb-stat-label">{stat.label}</div>
                    </div>
                ))}
            </section>

            <div className="fb-grid-dashboard">
                <section className="fb-card" aria-labelledby="add-item-title">
                    <div className="fb-card-header">
                        <h2 id="add-item-title"><span className="fb-card-icon" aria-hidden="true">➕</span>Add an item</h2>
                        <Link to="/scan" className="fb-btn-ghost fb-btn-sm">📷 Scan receipt</Link>
                    </div>
                    <AddItemForm addIngredient={addIngredient} />
                </section>

                <section className="fb-card" aria-labelledby="use-soon-title">
                    <div className="fb-card-header">
                        <h2 id="use-soon-title"><span className="fb-card-icon" aria-hidden="true">⏰</span>Use these soon</h2>
                        <Link to="/kitchen" className="fb-btn-ghost fb-btn-sm">Open kitchen</Link>
                    </div>
                    {useSoon.length === 0 ? (
                        <p className="fb-empty">
                            <span className="fb-empty-icon" aria-hidden="true">🌿</span>
                            {ingredients.length === 0 ? 'Add your first item to start tracking.' : 'Nothing expires in the next 3 days.'}
                        </p>
                    ) : (
                        <ul className="fb-soon-list">
                            {useSoon.map((item) => (
                                <li key={item.id}>
                                    <div>
                                        <div className="fb-soon-name">{item.name}</div>
                                        <div className="fb-soon-meta">
                                            {item.quantity} · {item.fridge_bool ? 'Fridge' : 'Pantry'} · {formatShortDate(item.date_expire)}
                                        </div>
                                    </div>
                                    <ExpiryBadge date={item.date_expire} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}

export default Dashboard;
