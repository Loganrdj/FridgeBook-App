import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Toggle({ id, label, description, checked, disabled, onChange }) {
  return (
    <div className="fb-setting">
      <div>
        <label htmlFor={id} className="fb-setting-label">{label}</label>
        <p className="fb-setting-desc">{description}</p>
      </div>
      <input id={id} type="checkbox" role="switch" className="fb-switch" checked={checked} disabled={disabled}
        aria-checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

function Settings() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(fields) {
    setSaving(true);
    setError('');
    try {
      const response = await axios.patch('/api/me/settings', fields);
      updateUser(response.data);
    } catch (err) {
      setError('Could not save that setting. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fb-page">
      <header className="fb-page-header">
        <h1>Settings</h1>
        <p>Signed in as {user.name}.</p>
      </header>
      {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}

      <section className="fb-card fb-settings" aria-labelledby="diet-title">
        <div className="fb-card-header">
          <h2 id="diet-title"><span className="fb-card-icon" aria-hidden="true">🌾</span>Diet</h2>
        </div>
        <Toggle id="celiac-mode" label="Celiac Mode"
          description="Flags gluten in your kitchen and pantry, warns about gluten on scanned receipts, and adds gluten checks for products and restaurant menus."
          checked={user.celiac_mode} disabled={saving} onChange={(value) => save({ celiac_mode: value })} />
        {user.celiac_mode && (
          <Toggle id="celiac-strict" label="Strict"
            description='Treat "may contain gluten" and "made in a shared facility" as unsafe instead of a warning.'
            checked={user.celiac_strict} disabled={saving} onChange={(value) => save({ celiac_strict: value })} />
        )}
        <p className="fb-note-text fb-settings-note">
          Gluten labels are guidance, not medical advice. Ingredients and recipes change, so always check the package
          and talk to your doctor or dietitian about what's safe for you.
        </p>
      </section>
    </main>
  );
}

export default Settings;
