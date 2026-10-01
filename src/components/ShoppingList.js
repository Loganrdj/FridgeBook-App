import React, { useContext, useState } from 'react';
import { GlobalContext } from '../context/GlobalState';
import { addDays } from '../utils/dates';

const QUICK_DATES = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 }
];

function ShoppingRow({ item, onToggle, onQuantity, onDelete }) {
  const checkboxId = `shopping-${item.id}`;
  return (
    <li className={`fb-shop-item${item.checked ? ' is-checked' : ''}`}>
      <input id={checkboxId} type="checkbox" className="fb-checkbox" checked={item.checked} onChange={() => onToggle(item)} />
      <label htmlFor={checkboxId} className="fb-shop-name">
        {item.name}
        {item.note && <span className="fb-shop-note">{item.note}</span>}
      </label>
      <div className="fb-stepper">
        <button type="button" className="fb-icon-btn" aria-label={`One less ${item.name}`}
          onClick={() => onQuantity(item, -1)} disabled={item.quantity <= 1}>−</button>
        <span className="fb-stepper-value" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
        <button type="button" className="fb-icon-btn" aria-label={`One more ${item.name}`}
          onClick={() => onQuantity(item, 1)} disabled={item.quantity >= 9999}>+</button>
      </div>
      <button type="button" className="fb-icon-btn" aria-label={`Remove ${item.name} from the list`} onClick={() => onDelete(item)}>×</button>
    </li>
  );
}

// Put-away step: an expiration date and a place for each bought item
function PutAway({ items, onCancel, onConfirm }) {
  const [entries, setEntries] = useState(() => items.map((item) => ({
    id: item.id, name: item.name, quantity: String(item.quantity), date_expire: '', fridge_bool: true
  })));
  const [saving, setSaving] = useState(false);
  const update = (id, fields) => setEntries(entries.map((entry) => (entry.id === id ? { ...entry, ...fields } : entry)));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onConfirm(entries.map(({ id, quantity, date_expire, fridge_bool }) => ({
      id, quantity: Number(quantity) || 1, date_expire, fridge_bool
    })));
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form className="fb-card fb-putaway" onSubmit={submit} aria-label="Put away">
      <div className="fb-card-header">
        <h2><span className="fb-card-icon" aria-hidden="true">🧺</span>Put away</h2>
      </div>
      <p className="fb-putaway-hint">When does each item expire, and where does it go?</p>
      <ul className="fb-items">
        {entries.map((entry) => (
          <li key={entry.id} className="fb-putaway-row">
            <div className="fb-putaway-title">{entry.name}</div>
            <div className="fb-form-row">
              <label className="fb-field">
                <span>Quantity</span>
                <input className="fb-input" type="number" min="1" max="9999" step="1" value={entry.quantity}
                  onChange={(e) => update(entry.id, { quantity: e.target.value })} required />
              </label>
              <label className="fb-field">
                <span>Expires</span>
                <input className="fb-input" type="date" value={entry.date_expire}
                  onChange={(e) => update(entry.id, { date_expire: e.target.value })} required />
              </label>
            </div>
            <div className="fb-chips" role="group" aria-label={`Quick expiration dates for ${entry.name}`}>
              {QUICK_DATES.map(({ label, days }) => {
                const value = addDays(days);
                return (
                  <button type="button" key={label} className={`fb-chip${entry.date_expire === value ? ' is-active' : ''}`}
                    onClick={() => update(entry.id, { date_expire: value })}>{label}</button>
                );
              })}
            </div>
            <div className="fb-segmented" role="radiogroup" aria-label={`Where ${entry.name} goes`}>
              {[['Fridge', true], ['Pantry', false]].map(([label, value]) => (
                <label key={label} className={entry.fridge_bool === value ? 'is-active' : ''}>
                  <input type="radio" name={`where-${entry.id}`} checked={entry.fridge_bool === value}
                    onChange={() => update(entry.id, { fridge_bool: value })} />
                  {label}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="fb-edit-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="fb-btn" disabled={saving}>
          {saving ? 'Moving…' : `Add ${entries.length} to kitchen`}
        </button>
        <button type="button" className="fb-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AddToList({ addShoppingItem }) {
  const [form, setForm] = useState({ name: '', quantity: '1', note: '' });
  const [saving, setSaving] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await addShoppingItem({ name: form.name.trim(), quantity: Number(form.quantity) || 1, note: form.note.trim() || null });
    setSaving(false);
    if (ok) setForm({ name: '', quantity: '1', note: '' });
  }

  return (
    <form className="fb-form" onSubmit={submit} aria-label="Add to list">
      <label className="fb-field">
        <span>Item</span>
        <input className="fb-input" value={form.name} onChange={set('name')} placeholder="e.g. Bananas" maxLength={100} required autoComplete="off" />
      </label>
      <div className="fb-form-row">
        <label className="fb-field">
          <span>Quantity</span>
          <input className="fb-input" type="number" min="1" max="9999" step="1" value={form.quantity} onChange={set('quantity')} required />
        </label>
        <label className="fb-field">
          <span>Note (optional)</span>
          <input className="fb-input" value={form.note} onChange={set('note')} placeholder="e.g. ripe, 2%" maxLength={100} />
        </label>
      </div>
      <div><button type="submit" className="fb-btn" disabled={saving}>{saving ? 'Adding…' : 'Add to list'}</button></div>
    </form>
  );
}

function ShoppingList() {
  const {
    shopping, shoppingLoaded, addShoppingItem, updateShoppingItem, deleteShoppingItem,
    clearCheckedShopping, moveShoppingToKitchen
  } = useContext(GlobalContext);
  const [puttingAway, setPuttingAway] = useState(false);

  const toBuy = shopping.filter((item) => !item.checked);
  const inCart = shopping.filter((item) => item.checked);
  const rowActions = {
    onToggle: (item) => updateShoppingItem(item.id, { checked: !item.checked }),
    onQuantity: (item, delta) => updateShoppingItem(item.id, { quantity: Math.min(9999, Math.max(1, item.quantity + delta)) }),
    onDelete: (item) => deleteShoppingItem(item.id)
  };

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Shopping list</h1>
        <p>Check things off as you shop, then put them away in one go.</p>
      </header>

      {puttingAway && inCart.length > 0 && (
        <PutAway items={inCart} onCancel={() => setPuttingAway(false)} onConfirm={moveShoppingToKitchen} />
      )}

      <div className="fb-grid-shopping">
        <section className="fb-card" aria-labelledby="to-buy-title">
          <div className="fb-card-header">
            <h2 id="to-buy-title"><span className="fb-card-icon" aria-hidden="true">🛒</span>To buy</h2>
            <span className="fb-count">{toBuy.length} {toBuy.length === 1 ? 'item' : 'items'}</span>
          </div>
          {toBuy.length === 0 ? (
            <p className="fb-empty">{!shoppingLoaded ? 'Loading…' : inCart.length ? 'All done. Nice!' : 'Your list is empty.'}</p>
          ) : (
            <ul className="fb-items">
              {toBuy.map((item) => <ShoppingRow key={item.id} item={item} {...rowActions} />)}
            </ul>
          )}

          {inCart.length > 0 && (
            <div className="fb-cart" aria-label="In the cart">
              <div className="fb-card-header" style={{ marginTop: 20 }}>
                <h3 className="fb-cart-title">In the cart ({inCart.length})</h3>
                <div className="fb-edit-actions">
                  <button type="button" className="fb-btn fb-btn-sm" onClick={() => setPuttingAway(true)}>Move to kitchen</button>
                  <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={clearCheckedShopping}>Clear</button>
                </div>
              </div>
              <ul className="fb-items">
                {inCart.map((item) => <ShoppingRow key={item.id} item={item} {...rowActions} />)}
              </ul>
            </div>
          )}
        </section>

        <section className="fb-card" aria-labelledby="add-to-list-title">
          <div className="fb-card-header">
            <h2 id="add-to-list-title"><span className="fb-card-icon" aria-hidden="true">➕</span>Add to list</h2>
          </div>
          <AddToList addShoppingItem={addShoppingItem} />
        </section>
      </div>
    </main>
  );
}

export default ShoppingList;
