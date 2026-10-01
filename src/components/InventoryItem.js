import React, { useState } from 'react';
import ExpiryBadge from './ExpiryBadge';
import { formatShortDate } from '../utils/dates';

// One kitchen item: −/+ quantity, an expiry badge, and inline editing
function InventoryItem({ item, updateIngredient, changeQuantity, deleteIngredient, addShoppingItem }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    function startEditing() {
        setDraft({ name: item.name, quantity: String(item.quantity), date_expire: item.date_expire, fridge_bool: item.fridge_bool });
        setEditing(true);
    }

    async function save(event) {
        event.preventDefault();
        setSaving(true);
        const ok = await updateIngredient(item.id, {
            name: draft.name.trim(),
            quantity: Number(draft.quantity),
            date_expire: draft.date_expire,
            fridge_bool: draft.fridge_bool
        });
        setSaving(false);
        if (ok) setEditing(false);
    }

    function remove() {
        if (window.confirm(`Remove ${item.name} from your kitchen?`)) deleteIngredient(item.id);
    }

    if (editing) {
        const set = (field) => (event) => setDraft({ ...draft, [field]: event.target.value });
        return (
            <li className="fb-item-edit">
                <form className="fb-form" onSubmit={save} aria-label={`Edit ${item.name}`}>
                    <label className="fb-field">
                        <span>Item</span>
                        <input className="fb-input" value={draft.name} onChange={set('name')} maxLength={100} required autoFocus />
                    </label>
                    <div className="fb-form-row">
                        <label className="fb-field">
                            <span>Quantity</span>
                            <input className="fb-input" type="number" min="0" max="9999" step="1" value={draft.quantity} onChange={set('quantity')} required />
                        </label>
                        <label className="fb-field">
                            <span>Expires</span>
                            <input className="fb-input" type="date" value={draft.date_expire} onChange={set('date_expire')} required />
                        </label>
                    </div>
                    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                        <legend className="fb-legend">Where</legend>
                        <div className="fb-segmented">
                            {[['Fridge', true], ['Pantry', false]].map(([label, value]) => (
                                <label key={label} className={draft.fridge_bool === value ? 'is-active' : ''}>
                                    <input type="radio" name={`where-${item.id}`} checked={draft.fridge_bool === value}
                                        onChange={() => setDraft({ ...draft, fridge_bool: value })} />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="fb-edit-actions">
                        <button type="submit" className="fb-btn fb-btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </form>
            </li>
        );
    }

    return (
        <li className="fb-item">
            <div>
                <div className="fb-item-name">{item.name}</div>
                <div className="fb-item-date">Expires {formatShortDate(item.date_expire)}</div>
            </div>
            <div className="fb-stepper">
                <button type="button" className="fb-icon-btn" aria-label={`One less ${item.name}`} onClick={() => changeQuantity(item.id, -1)}>−</button>
                <span className="fb-stepper-value" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                <button type="button" className="fb-icon-btn" aria-label={`One more ${item.name}`} onClick={() => changeQuantity(item.id, 1)}
                    disabled={item.quantity >= 9999}>+</button>
            </div>
            <ExpiryBadge date={item.date_expire} />
            <div className="fb-item-actions">
                {addShoppingItem && (
                    <button type="button" className="fb-icon-btn" aria-label={`Add ${item.name} to the shopping list`}
                        title="Add to shopping list"
                        onClick={() => addShoppingItem({ name: item.name, quantity: 1, source: 'kitchen' }, { notify: true })}>🛒</button>
                )}
                <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={startEditing} aria-label={`Edit ${item.name}`}>Edit</button>
                <button type="button" className="fb-btn-danger fb-btn-sm" onClick={remove} aria-label={`Remove ${item.name}`}>Remove</button>
            </div>
        </li>
    );
}

export default InventoryItem;
