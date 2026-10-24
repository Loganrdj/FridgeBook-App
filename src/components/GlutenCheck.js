import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { todayString } from '../utils/dates';
import { runCheck, errorMessage } from '../utils/checkJob';
import { isPhone, compressPhoto, toWav } from '../utils/media';

const MAX_RECORDING_SECONDS = 60;

const VERDICTS = {
  likely_gluten: { tone: 'expired', label: 'Likely gluten', order: 0 },
  unknown: { tone: 'expired', label: 'Unknown: assume gluten', order: 1 },
  ask: { tone: 'today', label: 'Ask first', order: 2 },
  low_risk: { tone: 'ok', label: 'Low ingredient risk', order: 3 }
};

// How a dish verdict looks. In Strict mode "ask first" counts as not safe.
export function verdictLook(verdict, strict) {
  if (verdict === 'ask' && strict) return { tone: 'expired', label: 'Not safe in Strict mode: ask first' };
  return VERDICTS[verdict] || VERDICTS.unknown;
}

const INGREDIENT_LOOK = {
  contains: { tone: 'expired', label: 'Contains gluten' },
  may_contain: { tone: 'today', label: 'May contain gluten' },
  gluten_free: { tone: 'ok', label: 'Gluten-free' },
  unknown: { tone: 'none', label: 'Unknown' }
};

const CROSS_CONTACT = {
  lower: { tone: 'ok', label: 'Lower' },
  moderate: { tone: 'soon', label: 'Moderate' },
  high: { tone: 'today', label: 'High' },
  very_high: { tone: 'expired', label: 'Very high' }
};

const scoreTone = (n) => (n >= 70 ? 'good' : n >= 40 ? 'mid' : 'low');

const ExternalLink = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

function Disclaimer({ text }) {
  return (
    <p className="fb-note-text fb-gf-disclaimer">
      {text || 'Guidance only, not medical advice. We can’t see what the kitchen actually uses, so always tell staff you have celiac disease and ask how your food is made.'}
    </p>
  );
}

function ScoreCard({ result, strict }) {
  const { score, cross_contact: cross } = result;
  const hasKitchen = score.overall_score !== undefined;
  const value = hasKitchen ? score.overall_score : score.ingredient_score;
  const crossLook = cross ? CROSS_CONTACT[cross.level] || CROSS_CONTACT.high : null;
  return (
    <section className="fb-card fb-gf-score-card" aria-label="Gluten score">
      <div className="fb-gf-score-top">
        <div className={`fb-gf-score fb-gf-score-${scoreTone(value)}`}>
          <span className="fb-gf-score-value">{value}%</span>
          <span className="fb-gf-score-label">{hasKitchen ? 'Gluten safety estimate' : 'Ingredient score'}</span>
        </div>
        <div className="fb-gf-score-detail">
          {result.restaurant && result.restaurant.name && (
            <h2>{result.restaurant.name}</h2>
          )}
          {result.restaurant && result.restaurant.location && <p className="fb-gf-muted">{result.restaurant.location}</p>}
          <p>
            <strong>{score.counts.low_risk} of {score.total}</strong> dishes have low ingredient risk
            {hasKitchen && <> (ingredient score {score.ingredient_score}%)</>}.
          </p>
          <ul className="fb-gf-counts">
            <li><span className="fb-badge fb-badge-expired">Likely gluten {score.counts.likely_gluten}</span></li>
            <li><span className={`fb-badge fb-badge-${strict ? 'expired' : 'today'}`}>Ask first {score.counts.ask}</span></li>
            {score.counts.unknown > 0 && <li><span className="fb-badge fb-badge-expired">Unknown {score.counts.unknown}</span></li>}
          </ul>
        </div>
      </div>

      {hasKitchen && cross && (
        <div className="fb-gf-cross">
          <h3>Cross-contact risk <span className={`fb-badge fb-badge-${crossLook.tone}`}>{crossLook.label}</span></h3>
          {score.capped && (
            <p className="fb-gf-capped">
              The estimate is capped at {score.cross_contact_cap}% because of the {crossLook.label.toLowerCase()} cross-contact risk
              {strict ? ' (Strict mode)' : ''}.
            </p>
          )}
          {cross.summary && <p>{cross.summary}</p>}
          {cross.menu_note && <p>{cross.menu_note}</p>}
          {(cross.gf_menu !== 'unknown' || cross.dedicated_fryer !== 'unknown') && (
            <ul className="fb-gf-facts">
              {cross.gf_menu !== 'unknown' && <li>Gluten-free menu: <strong>{cross.gf_menu === 'yes' ? 'Yes' : 'No'}</strong></li>}
              {cross.dedicated_fryer !== 'unknown' && <li>Dedicated gluten-free fryer: <strong>{cross.dedicated_fryer === 'yes' ? 'Yes' : 'No'}</strong></li>}
            </ul>
          )}
          {cross.findings && cross.findings.length > 0 && (
            <ul className="fb-gf-findings">
              {cross.findings.map((f, i) => (
                <li key={i} className={`is-${f.tone}`}>
                  <span aria-hidden="true">{f.tone === 'good' ? '✓' : f.tone === 'bad' ? '⚠' : '•'}</span>
                  <span>{f.text} <ExternalLink href={f.source_url}>Source</ExternalLink></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!hasKitchen && (
        <p className="fb-gf-muted fb-gf-cross-note">
          A menu photo can’t tell us about the kitchen, so cross-contact isn’t rated here. Assume a shared kitchen and fryer
          unless staff tell you otherwise.
        </p>
      )}
      {result.sources && result.sources.length > 0 && (
        <p className="fb-gf-sources">
          Sources: {result.sources.map((s, i) => (
            <span key={s.url}>{i > 0 && ' · '}<ExternalLink href={s.url}>{s.label}</ExternalLink></span>
          ))}
        </p>
      )}
      <Disclaimer text={result.disclaimer} />
    </section>
  );
}

function DishRow({ dish, strict, onAskWaiter }) {
  const look = verdictLook(dish.verdict, strict);
  return (
    <li className={`fb-gf-dish is-${dish.verdict}`}>
      <div className="fb-gf-dish-head">
        <div>
          <strong className="fb-gf-dish-name">{dish.name}</strong>
          {dish.description && <p className="fb-gf-muted">{dish.description}</p>}
        </div>
        <div className="fb-gf-dish-verdict">
          <span className={`fb-badge fb-badge-${look.tone}`}>{look.label}</span>
          {dish.gluten_chance !== null && dish.gluten_chance !== undefined && (
            <span className="fb-gf-chance">{dish.gluten_chance}% chance of gluten</span>
          )}
        </div>
      </div>
      <details className="fb-gf-dish-more">
        <summary>Why, and what to ask</summary>
        {dish.reason && <p>{dish.reason}</p>}
        {dish.sources.length > 0 && <p><strong>Gluten often hides in:</strong> {dish.sources.join(', ')}.</p>}
        {dish.recipes && (
          <p>
            <strong>{dish.recipes.with_gluten} of {dish.recipes.checked}</strong> published recipes for this dish use a gluten ingredient.
            {dish.recipes.examples.length > 0 && (
              <> For example: {dish.recipes.examples.map((ex, i) => (
                <span key={i}>{i > 0 && '; '}{ex.url ? <ExternalLink href={ex.url}>{ex.title}</ExternalLink> : ex.title} ({ex.gluten.join(', ')})</span>
              ))}.</>
            )}
          </p>
        )}
        {dish.cautions.length > 0 && (
          <ul className="fb-gf-cautions">{dish.cautions.map((c) => <li key={c}>{c}</li>)}</ul>
        )}
        {dish.questions.length > 0 && (
          <>
            <p><strong>Ask your server:</strong></p>
            <ul className="fb-gf-questions">{dish.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </>
        )}
        {onAskWaiter && (
          <button type="button" className="fb-btn-ghost fb-btn-sm" onClick={() => onAskWaiter(dish)}>🎤 Record what the server says</button>
        )}
      </details>
    </li>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low_risk', label: 'Low risk' },
  { key: 'ask', label: 'Ask first' },
  { key: 'likely_gluten', label: 'Likely gluten' }
];

function DishList({ dishes, strict, onAskWaiter }) {
  const [filter, setFilter] = useState('all');
  const shown = dishes
    .filter((d) => filter === 'all' || d.verdict === filter || (filter === 'likely_gluten' && d.verdict === 'unknown'))
    .slice()
    .sort((a, b) => (VERDICTS[b.verdict] || VERDICTS.unknown).order - (VERDICTS[a.verdict] || VERDICTS.unknown).order);
  return (
    <section className="fb-card" aria-labelledby="gf-dishes-title">
      <div className="fb-card-header">
        <h2 id="gf-dishes-title"><span className="fb-card-icon" aria-hidden="true">🍽️</span>Dishes</h2>
        <span className="fb-count">{dishes.length}</span>
      </div>
      <div className="fb-chips" role="group" aria-label="Show dishes">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={`fb-chip${filter === f.key ? ' is-active' : ''}`} aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {shown.length ? (
        <ul className="fb-gf-dishes" aria-label="Dishes">
          {shown.map((dish, i) => <DishRow key={`${dish.name}-${i}`} dish={dish} strict={strict} onAskWaiter={onAskWaiter} />)}
        </ul>
      ) : <p className="fb-gf-muted fb-gf-empty">No dishes in this group.</p>}
    </section>
  );
}

// Messages shown while a slow check runs
function useProgress(active, steps) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) { setStep(0); return undefined; }
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 5000);
    return () => clearInterval(timer);
  }, [active, steps.length]);
  return steps[step];
}

function useMounted() {
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return mounted;
}

const RESTAURANT_STEPS = ['Finding the menu…', 'Checking each dish…', 'Cross-checking published recipes…', 'Reading what celiac diners say…', 'Almost done…'];

function RestaurantSearch({ usage, onUsage, result, setResult, strict, onAskWaiter }) {
  const byName = !usage || usage.restaurant_by_name;
  const [mode, setMode] = useState('name');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const progress = useProgress(busy, RESTAURANT_STEPS);

  useEffect(() => { if (!byName) setMode('link'); }, [byName]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const body = mode === 'link' ? { url: link.trim() } : { name: name.trim(), city: city.trim() };
    if (mode === 'link' ? !body.url : !body.name) {
      setError(mode === 'link' ? 'Paste a link to the menu.' : 'Enter the restaurant’s name.');
      return;
    }
    setBusy(true);
    try {
      const data = await runCheck(() => axios.post('/api/gluten/restaurant', { ...body, local_date: todayString() }), () => !mounted.current);
      if (!mounted.current || !data) return;
      setResult(data);
      if (data.remaining !== undefined) onUsage('restaurant', data.remaining);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, err.message || 'That check didn’t work. Please try again.'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <section className="fb-card" aria-labelledby="gf-restaurant-title">
        <div className="fb-card-header">
          <h2 id="gf-restaurant-title"><span className="fb-card-icon" aria-hidden="true">🏪</span>Check a restaurant</h2>
          {usage && <span className="fb-count">{usage.restaurant.remaining} new checks left today</span>}
        </div>
        <p className="fb-gf-muted fb-gf-intro">
          We read the menu, estimate each dish’s chance of gluten from how it’s usually made and from published recipes,
          and look for what celiac diners and the restaurant say about cross-contact.
        </p>
        <div className="fb-segmented" role="radiogroup" aria-label="Find the restaurant by">
          {[['name', 'Name and city'], ['link', 'Menu link']].map(([key, label]) => (
            <label key={key} className={mode === key ? 'is-active' : ''}>
              <input type="radio" name="gf-mode" checked={mode === key} disabled={key === 'name' && !byName} onChange={() => setMode(key)} />
              {label}
            </label>
          ))}
        </div>
        {!byName && <p className="fb-gf-muted">Searching by name isn’t switched on yet. Paste a link to the menu instead.</p>}
        <form className="fb-form fb-gf-form" onSubmit={submit}>
          {mode === 'name' ? (
            <div className="fb-form-row">
              <label className="fb-field"><span>Restaurant</span>
                <input className="fb-input" value={name} maxLength={120} placeholder="e.g. Sunny Thai Kitchen" onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="fb-field"><span>City</span>
                <input className="fb-input" value={city} maxLength={120} placeholder="e.g. Pasadena, CA" onChange={(e) => setCity(e.target.value)} />
              </label>
            </div>
          ) : (
            <label className="fb-field"><span>Link to the menu</span>
              <input className="fb-input" type="url" inputMode="url" value={link} maxLength={500} placeholder="https://…/menu" onChange={(e) => setLink(e.target.value)} />
            </label>
          )}
          <button type="submit" className="fb-btn" disabled={busy}>{busy ? 'Checking…' : 'Check gluten safety'}</button>
        </form>
        {busy && <p className="fb-gf-progress" role="status">{progress} This can take up to a minute.</p>}
        {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}
      </section>
      {result && (
        <>
          <ScoreCard result={result} strict={strict} />
          <DishList dishes={result.dishes} strict={strict} onAskWaiter={onAskWaiter} />
        </>
      )}
    </>
  );
}

const PHOTO_STEPS = ['Uploading the photo…', 'Reading the menu…', 'Checking each dish…', 'Almost done…'];

function MenuPhoto({ usage, onUsage, result, setResult, strict, onAskWaiter }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const progress = useProgress(busy, PHOTO_STEPS);

  async function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const photo = await compressPhoto(file);
      const data = await runCheck(() => axios.post(`/api/gluten/menu-photo?local_date=${todayString()}`, photo, {
        headers: { 'Content-Type': photo.type || 'image/jpeg' }
      }), () => !mounted.current);
      if (!mounted.current || !data) return;
      setResult(data);
      if (data.remaining !== undefined) onUsage('menu', data.remaining);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, err.message || 'We couldn’t read that menu. Please try again.'));
    } finally {
      if (mounted.current) setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <section className="fb-card" aria-labelledby="gf-photo-title">
        <div className="fb-card-header">
          <h2 id="gf-photo-title"><span className="fb-card-icon" aria-hidden="true">📷</span>Scan a menu</h2>
          {usage && <span className="fb-count">{usage.menu.remaining} left today</span>}
        </div>
        <p className="fb-gf-muted fb-gf-intro">
          Take a photo of one menu page, flat and in good light. Google’s Gemini reads it; the photo isn’t saved.
        </p>
        <label className={`fb-btn fb-gf-file${busy ? ' is-disabled' : ''}`}>
          {busy ? 'Checking…' : 'Take or choose a photo'}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" disabled={busy}
            onChange={handleFile} aria-label="Menu photo" />
        </label>
        {busy && <p className="fb-gf-progress" role="status">{progress}</p>}
        {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}
      </section>
      {result && (
        <>
          <ScoreCard result={result} strict={strict} />
          <DishList dishes={result.dishes} strict={strict} onAskWaiter={onAskWaiter} />
        </>
      )}
    </>
  );
}

function WaiterVoice({ dish, usage, onUsage, strict }) {
  const [dishName, setDishName] = useState(dish ? dish.name : '');
  const [stage, setStage] = useState('idle'); // idle | recording | checking
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const mounted = useMounted();
  const supported = typeof window !== 'undefined' && window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  useEffect(() => { if (dish) setDishName(dish.name); }, [dish]);

  const stopTracks = useCallback(() => {
    clearInterval(timer.current);
    if (stream.current) stream.current.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);
  useEffect(() => () => {
    stopTracks();
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
  }, [stopTracks]);

  async function send(blob) {
    setStage('checking');
    try {
      const wav = await toWav(blob);
      const params = new URLSearchParams({ local_date: todayString() });
      if (dishName.trim()) params.set('dish', dishName.trim());
      if (dish && dish.name === dishName && dish.description) params.set('description', dish.description);
      const response = await axios.post(`/api/gluten/voice?${params}`, wav, { headers: { 'Content-Type': 'audio/wav' } });
      if (!mounted.current) return;
      setResult(response.data);
      if (response.data.remaining !== undefined) onUsage('voice', response.data.remaining);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, err.message || 'We couldn’t check that recording. Please try again.'));
    } finally {
      if (mounted.current) setStage('idle');
    }
  }

  async function start() {
    setError('');
    setResult(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError('FridgeBook needs the microphone to hear the server. Allow it in your browser settings and try again.');
      return;
    }
    const chunks = [];
    const rec = new window.MediaRecorder(stream.current);
    recorder.current = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stopTracks();
      send(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    };
    rec.start();
    setSeconds(0);
    setStage('recording');
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS && rec.state === 'recording') rec.stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
  }

  const look = result ? verdictLook(result.verdict, strict) : null;
  return (
    <section className="fb-card" aria-labelledby="gf-voice-title">
      <div className="fb-card-header">
        <h2 id="gf-voice-title"><span className="fb-card-icon" aria-hidden="true">🎤</span>Ask the waiter</h2>
        {usage && <span className="fb-count">{usage.voice.remaining} left today</span>}
      </div>
      <p className="fb-gf-muted fb-gf-intro">
        Ask how the dish is made, then record the answer. Let your server know you’re recording to check for gluten.
        Google’s Gemini transcribes the clip once; the audio isn’t saved.
      </p>
      <label className="fb-field"><span>Dish (optional)</span>
        <input className="fb-input" value={dishName} maxLength={120} placeholder="e.g. Chicken katsu" onChange={(e) => setDishName(e.target.value)} />
      </label>
      {!supported ? (
        <p className="fb-banner fb-banner-inline" role="alert">This browser can’t record audio. Try Safari or Chrome on your phone.</p>
      ) : stage === 'recording' ? (
        <button type="button" className="fb-btn-danger fb-gf-record is-recording" onClick={stop}>
          ■ Stop recording ({MAX_RECORDING_SECONDS - seconds}s left)
        </button>
      ) : (
        <button type="button" className="fb-btn fb-gf-record" onClick={start} disabled={stage === 'checking'}>
          {stage === 'checking' ? 'Listening to the recording…' : '● Start recording'}
        </button>
      )}
      {error && <p className="fb-banner fb-banner-inline" role="alert">{error}</p>}

      {result && (
        <div className="fb-gf-voice-result" aria-live="polite">
          <p className="fb-gf-voice-verdict"><span className={`fb-badge fb-badge-${look.tone}`}>{look.label}</span> {result.reason}</p>
          {result.ingredients.length > 0 && (
            <>
              <h3>Ingredients you heard</h3>
              <ul className="fb-gf-heard">
                {result.ingredients.map((item, i) => {
                  const il = item.gluten_status === 'may_contain' && strict
                    ? { tone: 'expired', label: 'Not safe: may contain gluten' }
                    : INGREDIENT_LOOK[item.gluten_status] || INGREDIENT_LOOK.unknown;
                  return (
                    <li key={i}>
                      <span>{item.name}</span>
                      <span className={`fb-badge fb-badge-${il.tone}`} title={item.gluten_reason || undefined}>{il.label}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {result.preparation.length > 0 && (
            <>
              <h3>How it’s made</h3>
              <ul className="fb-gf-findings">
                {result.preparation.map((p, i) => (
                  <li key={i} className={p.risk === 'ok' ? 'is-good' : 'is-bad'}>
                    <span aria-hidden="true">{p.risk === 'ok' ? '✓' : '⚠'}</span><span>{p.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.typical && result.typical.questions.length > 0 && (
            <>
              <h3>Worth asking about {dishName || 'this dish'}</h3>
              <ul className="fb-gf-questions">{result.typical.questions.map((q) => <li key={q}>{q}</li>)}</ul>
            </>
          )}
          {result.transcript && (
            <details className="fb-gf-dish-more">
              <summary>What we heard</summary>
              <p>{result.transcript}</p>
            </details>
          )}
          <Disclaimer text={result.disclaimer} />
        </div>
      )}
    </section>
  );
}

const TABS = [
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'photo', label: 'Menu photo', phoneOnly: true },
  { key: 'voice', label: 'Ask the waiter', phoneOnly: true }
];

function GlutenCheck() {
  const { user } = useAuth();
  const strict = !!(user && user.celiac_strict);
  const [phone] = useState(isPhone);
  const [tab, setTab] = useState('restaurant');
  const [usage, setUsage] = useState(null);
  const [restaurantResult, setRestaurantResult] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);
  const [voiceDish, setVoiceDish] = useState(null);

  useEffect(() => {
    axios.get(`/api/gluten/usage?local_date=${todayString()}`)
      .then((response) => setUsage(response.data))
      .catch(() => {});
  }, []);

  const onUsage = useCallback((kind, remaining) => {
    setUsage((current) => (current ? { ...current, [kind]: { ...current[kind], remaining } } : current));
  }, []);

  const askWaiter = phone ? (dish) => {
    setVoiceDish(dish);
    setTab('voice');
    if (window.scrollTo) window.scrollTo(0, 0);
  } : null;

  const tabs = TABS.filter((t) => phone || !t.phoneOnly);
  return (
    <main className="fb-page fb-gf-page">
      <header className="fb-page-header">
        <h1>Gluten check</h1>
        <p>Eating out with celiac disease: estimates to help you choose and what to ask. Always confirm with staff.</p>
      </header>
      {!(user && user.celiac_mode) && (
        <p className="fb-notice">Tip: turn on Celiac Mode in Settings to see gluten labels across FridgeBook.</p>
      )}
      {tabs.length > 1 && (
        <div className="fb-gf-tabs" role="tablist" aria-label="Gluten checks">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`fb-chip${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
      )}
      {tab === 'restaurant' && (
        <RestaurantSearch usage={usage} onUsage={onUsage} result={restaurantResult} setResult={setRestaurantResult} strict={strict} onAskWaiter={askWaiter} />
      )}
      {tab === 'photo' && phone && (
        <MenuPhoto usage={usage} onUsage={onUsage} result={photoResult} setResult={setPhotoResult} strict={strict} onAskWaiter={askWaiter} />
      )}
      {tab === 'voice' && phone && <WaiterVoice dish={voiceDish} usage={usage} onUsage={onUsage} strict={strict} />}
    </main>
  );
}

export default GlutenCheck;
