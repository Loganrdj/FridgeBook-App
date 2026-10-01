import React, { useState } from 'react';
import { addDays } from '../utils/dates';

const QUICK_DATES = [
    { label: '3 days', days: 3 },
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 }
];

const EMPTY = { name: '', quantity: '1', date_expire: '', fridge_bool: true };

// Adds an item to the logged-in user's kitchen
function AddItemForm({ addIngredient }) {
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [added, setAdded] = useState('');

    const set = (field) => (event) => { setAdded(''); setForm({ ...form, [field]: event.target.value }); };

    async function submit(event) {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        const name = form.name.trim();
        const saved = await addIngredient({
            name,
            quantity: Number(form.quantity) || 1,
            date_expire: form.date_expire,
            fridge_bool: form.fridge_bool
        });
        setSaving(false);
        if (saved) {
            // keep the location, since people usually add several things to the same place
            setForm({ ...EMPTY, fridge_bool: form.fridge_bool });
            setAdded(`Added ${name} to your ${form.fridge_bool ? 'fridge' : 'pantry'}.`);
        }
    }

    return (
        <form className="fb-form" onSubmit={submit}>
            <label className="fb-field">
                <span>Item</span>
                <input className="fb-input" id="ingredient_name" value={form.name} onChange={set('name')}
                    placeholder="e.g. Milk" maxLength={100} required autoComplete="off" />
            </label>
            <div className="fb-form-row">
                <label className="fb-field">
                    <span>Quantity</span>
                    <input className="fb-input" id="quantity" type="number" min="1" max="9999" step="1"
                        value={form.quantity} onChange={set('quantity')} required />
                </label>
                <label className="fb-field">
                    <span>Expires</span>
                    <input className="fb-input" id="date_expire" type="date" value={form.date_expire}
                        onChange={set('date_expire')} required />
                </label>
            </div>
            <div className="fb-chips" aria-label="Quick expiration dates">
                {QUICK_DATES.map(({ label, days }) => {
                    const value = addDays(days);
                    return (
                        <button type="button" key={label} className={`fb-chip${form.date_expire === value ? ' is-active' : ''}`}
                            onClick={() => setForm({ ...form, date_expire: value })}>
                            {label}
                        </button>
                    );
                })}
            </div>
            <fieldset className="fb-field" style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="fb-legend">Where</legend>
                <div className="fb-segmented">
                    {[['Fridge', true], ['Pantry', false]].map(([label, value]) => (
                        <label key={label} className={form.fridge_bool === value ? 'is-active' : ''}>
                            <input type="radio" name="fridge_bool" checked={form.fridge_bool === value}
                                onChange={() => setForm({ ...form, fridge_bool: value })} />
                            {label}
                        </label>
                    ))}
                </div>
            </fieldset>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button type="submit" className="fb-btn" disabled={saving}>{saving ? 'Adding…' : 'Add to kitchen'}</button>
                {added && <span className="fb-success" role="status">{added}</span>}
            </div>
        </form>
    );
}

export default AddItemForm;
