import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import axios from 'axios';
import { GlobalContext } from '../context/GlobalState';
import { extractItemLines } from '../utils/receiptText';
import { todayString } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import GlutenBadge, { isGlutenRisk } from './GlutenBadge';

const MAX_SIDE = 2000;

// Shrinks big phone photos and boosts contrast, which makes text recognition faster and better
function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext && canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return resolve(file); // no canvas support: let the reader take the photo as is
      ctx.filter = 'grayscale(1) contrast(1.4)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t an image we can read.')); };
    img.src = url;
  });
}

// Reads the text on the device; the photo is never uploaded
async function readText(image, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); }
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

function ReviewRow({ item, onChange }) {
  const set = (fields) => onChange({ ...item, ...fields });
  return (
    <li className={`fb-scan-item${item.include ? '' : ' is-excluded'}`}>
      <input type="checkbox" className="fb-checkbox" checked={item.include} onChange={(e) => set({ include: e.target.checked })}
        aria-label={`Include ${item.name || 'item'}`} />
      <div className="fb-scan-fields">
        <label className="fb-field">
          <span>Item {!item.confident && <span className="fb-badge fb-badge-soon">Check this</span>}
            <GlutenBadge status={item.gluten_status} reason={item.gluten_reason} /></span>
          <input className="fb-input" value={item.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="fb-scan-row">
          <label className="fb-field">
            <span>Qty</span>
            <input className="fb-input" type="number" min="1" max="9999" value={item.quantity} onChange={(e) => set({ quantity: e.target.value })} />
          </label>
          <label className="fb-field">
            <span>Expires</span>
            <input className="fb-input" type="date" value={item.date_expire} onChange={(e) => set({ date_expire: e.target.value })} />
          </label>
        </div>
        <div className="fb-segmented" role="radiogroup" aria-label={`Where ${item.name || 'this item'} goes`}>
          {[['Fridge', true], ['Pantry', false]].map(([label, value]) => (
            <label key={label} className={item.fridge_bool === value ? 'is-active' : ''}>
              <input type="radio" name={`scan-${item.key}`} checked={item.fridge_bool === value} onChange={() => set({ fridge_bool: value })} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </li>
  );
}

function ReceiptScan() {
  const { addIngredients } = useContext(GlobalContext);
  const { user } = useAuth();
  const celiac = !!(user && user.celiac_mode);
  const strict = !!(user && user.celiac_strict);
  const history = useHistory();
  const fileInput = useRef(null);
  const [stage, setStage] = useState('pick'); // pick | reading | sorting | review
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [sent, setSent] = useState([]);
  const [remaining, setRemaining] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`/api/receipts/usage?local_date=${todayString()}`)
      .then((response) => setRemaining(response.data.remaining))
      .catch(() => {});
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function startOver() {
    setStage('pick');
    setItems([]);
    setSent([]);
    setError('');
    setProgress(0);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setError('');
    setPreview(URL.createObjectURL(file));
    try {
      setStage('reading');
      setProgress(0);
      const image = await prepareImage(file);
      const text = await readText(image, setProgress);
      const { lines } = extractItemLines(text);
      if (!lines.length) {
        throw new Error("We couldn't find any items on that receipt. Try a flat, well-lit photo with the whole receipt in view.");
      }
      setStage('sorting');
      const response = await axios.post('/api/receipts/parse', { lines, local_date: todayString() });
      setSent(response.data.lines);
      setRemaining(response.data.remaining);
      setItems(response.data.items.map((item, index) => ({ ...item, original_name: item.name, key: index, include: true })));
      setStage('review');
    } catch (err) {
      const data = err.response && err.response.data;
      setError((data && (data.error || (data.errors && data.errors.join(', ')))) || err.message || 'Something went wrong reading that receipt.');
      if (data && data.remaining !== undefined) setRemaining(data.remaining);
      setStage('pick');
    }
  }

  async function addToKitchen() {
    const chosen = items.filter((item) => item.include && item.name.trim());
    setSaving(true);
    const added = await addIngredients(chosen.map((item) => {
      const name = item.name.trim();
      // keep the receipt's gluten label unless the name was changed
      const sameName = name.toLowerCase() === (item.original_name || '').toLowerCase();
      return {
        name, quantity: Number(item.quantity) || 1, date_expire: item.date_expire, fridge_bool: item.fridge_bool,
        ...(sameName && item.gluten_status ? { gluten_status: item.gluten_status, gluten_reason: item.gluten_reason } : {})
      };
    }));
    setSaving(false);
    if (added) history.push('/kitchen');
  }

  const chosenCount = items.filter((item) => item.include && item.name.trim()).length;

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Scan a receipt</h1>
        <p>Snap your grocery receipt and we'll add what you bought to your kitchen.</p>
      </header>

      {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}

      {stage === 'pick' && (
        <section className="fb-card fb-scan-pick" aria-label="Choose a receipt photo">
          <span className="fb-empty-icon" aria-hidden="true">🧾</span>
          <input ref={fileInput} id="receipt-photo" type="file" accept="image/*" capture="environment" onChange={handleFile}
            className="fb-visually-hidden" disabled={remaining === 0} />
          <label htmlFor="receipt-photo" className={`fb-btn${remaining === 0 ? ' is-disabled' : ''}`}>📷 Take or choose a photo</label>
          {remaining !== null && <p className="fb-count">{remaining} {remaining === 1 ? 'scan' : 'scans'} left today</p>}
          <p className="fb-scan-privacy">
            Your photo stays on this device: the text is read right here in your browser. Only the item lines
            (like "GV 2% MLK GAL") are sent to Google Gemini to be tidied up. Card numbers, totals, addresses,
            phone numbers and dates are removed first.
          </p>
        </section>
      )}

      {(stage === 'reading' || stage === 'sorting') && (
        <section className="fb-card fb-scan-pick" aria-label="Reading the receipt">
          {preview && <img className="fb-scan-preview" src={preview} alt="Your receipt" />}
          <p className="fb-empty" role="status">
            {stage === 'reading' ? `Reading the receipt… ${progress}%` : 'Sorting out what you bought…'}
          </p>
        </section>
      )}

      {stage === 'review' && (
        <section className="fb-card" aria-labelledby="review-title">
          <div className="fb-card-header">
            <h2 id="review-title"><span className="fb-card-icon" aria-hidden="true">🧺</span>Check what we found</h2>
            <span className="fb-count">{items.length} found</span>
          </div>
          {items.length === 0 ? (
            <p className="fb-empty">No food or drinks on this receipt. <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={startOver}>Try another</button></p>
          ) : (
            <>
              {celiac && (() => {
                const risky = items.filter((i) => isGlutenRisk(i.gluten_status, strict));
                const maybe = strict ? [] : items.filter((i) => i.gluten_status === 'may_contain');
                if (!risky.length && !maybe.length) return null;
                return (
                  <div className="fb-gluten-alert" role="alert">
                    <strong>🌾 Gluten found on this receipt</strong>
                    {risky.length > 0 && <p>Contains gluten: {risky.map((i) => i.name).join(', ')}.</p>}
                    {maybe.length > 0 && <p>May contain gluten: {maybe.map((i) => i.name).join(', ')}.</p>}
                    <p className="fb-gluten-alert-note">Based on typical products. Check each package's label.</p>
                  </div>
                );
              })()}
              <p className="fb-putaway-hint">Fix anything that looks off. Expiration dates are typical estimates.</p>
              <ul className="fb-items">
                {items.map((item) => (
                  <ReviewRow key={item.key} item={item} onChange={(next) => setItems(items.map((i) => (i.key === item.key ? next : i)))} />
                ))}
              </ul>
              <div className="fb-edit-actions" style={{ marginTop: 16 }}>
                <button type="button" className="fb-btn" onClick={addToKitchen} disabled={saving || chosenCount === 0}>
                  {saving ? 'Adding…' : `Add ${chosenCount} to kitchen`}
                </button>
                <button type="button" className="fb-btn-ghost" onClick={startOver}>Start over</button>
              </div>
            </>
          )}
          <details className="fb-recipe-steps" style={{ marginTop: 16 }}>
            <summary>Show what was sent</summary>
            <ol>{sent.map((line, index) => <li key={index}><code>{line}</code></li>)}</ol>
          </details>
        </section>
      )}

      <p className="fb-note-text" style={{ marginTop: 16 }}>
        <Link to="/kitchen" className="fb-link">← Back to your kitchen</Link>
      </p>
    </main>
  );
}

export default ReceiptScan;
