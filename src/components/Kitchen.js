import React, { useContext, useState } from 'react';
import InventoryItem from './InventoryItem';
import { GlobalContext } from '../context/GlobalState';

function InventoryCard({ title, icon, items, emptyText, actions }) {
    return (
        <section className="fb-card" aria-label={title}>
            <div className="fb-card-header">
                <h2><span className="fb-card-icon" aria-hidden="true">{icon}</span>{title}</h2>
                <span className="fb-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </div>
            {items.length === 0 ? (
                <p className="fb-empty">{emptyText}</p>
            ) : (
                <ul className="fb-items">
                    {items.map((item) => <InventoryItem key={item.id} item={item} {...actions} />)}
                </ul>
            )}
        </section>
    );
}

function Kitchen() {
    const { ingredients, ingredientsLoaded, updateIngredient, changeQuantity, deleteIngredient, addShoppingItem } = useContext(GlobalContext);
    const [query, setQuery] = useState('');

    const search = query.trim().toLowerCase();
    const shown = search ? ingredients.filter((item) => item.name.toLowerCase().includes(search)) : ingredients;
    const fridge = shown.filter((item) => item.fridge_bool === true);
    const pantry = shown.filter((item) => item.fridge_bool !== true);
    const actions = { updateIngredient, changeQuantity, deleteIngredient, addShoppingItem };
    const emptyText = (place) => !ingredientsLoaded ? 'Loading…'
        : search ? `Nothing in your ${place} matches "${query.trim()}".`
        : `Your ${place} is empty. Add items from the Dashboard.`;

    return (
        <main className="fb-page">
            <header className="fb-page-header">
                <h1>Kitchen</h1>
                <p>Everything you have, soonest-expiring first.</p>
            </header>
            <div className="fb-toolbar">
                <input className="fb-input" type="search" placeholder="Search your kitchen" aria-label="Search your kitchen"
                    value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="fb-grid-2">
                <InventoryCard title="Fridge" icon="🧊" items={fridge} emptyText={emptyText('fridge')} actions={actions} />
                <InventoryCard title="Pantry" icon="🥫" items={pantry} emptyText={emptyText('pantry')} actions={actions} />
            </div>
        </main>
    );
}

export default Kitchen;
