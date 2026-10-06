// Gluten check: a restaurant, a photo of a menu, or what the server says about a dish
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { WAV_RECORDING } from '../../lib/recording';
import { readFile, request, runCheck } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { todayString } from '../../lib/dates';
import { DISCLAIMER, ingredientLook, verdictLook } from '../../lib/gluten';
import { colors } from '../../lib/theme';
import { Badge, Button, Card, CardTitle, ErrorText, Field, Muted, Segmented } from '../../components/ui';
import { DishList, ScoreCard } from '../../components/GlutenResults';

const MAX_RECORDING_SECONDS = 60;
const MAX_PHOTO_SIDE = 1600;

function useMounted() {
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return mounted;
}

function Progress({ busy, steps }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!busy) { setStep(0); return undefined; }
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 5000);
    return () => clearInterval(timer);
  }, [busy, steps.length]);
  return busy ? <Text style={styles.progress} accessibilityLiveRegion="polite">{steps[step]}</Text> : null;
}

function Restaurant({ usage, onUsage, result, setResult, strict, onAskWaiter }) {
  const byName = !usage || usage.restaurant_by_name;
  const [mode, setMode] = useState('name');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();

  useEffect(() => { if (!byName) setMode('link'); }, [byName]);

  async function check() {
    const body = mode === 'link' ? { url: link.trim() } : { name: name.trim(), city: city.trim() };
    if (mode === 'link' ? !body.url : !body.name) return setError(mode === 'link' ? 'Paste a link to the menu.' : 'Enter the restaurant’s name.');
    setBusy(true);
    setError('');
    try {
      const data = await runCheck(() => request('/api/gluten/restaurant', { method: 'POST', body: { ...body, local_date: todayString() } }), () => !mounted.current);
      if (!mounted.current || !data) return;
      setResult(data);
      if (data.remaining !== undefined) onUsage('restaurant', data.remaining);
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardTitle icon="🏪" title="Check a restaurant" right={usage ? `${usage.restaurant.remaining} left today` : null} />
        <Muted style={styles.intro}>We read the menu, estimate each dish’s chance of gluten, and look for what celiac diners say about cross-contact.</Muted>
        {byName ? (
          <Segmented label="Find the restaurant by" value={mode} onChange={setMode}
            options={[{ label: 'Name and city', value: 'name' }, { label: 'Menu link', value: 'link' }]} />
        ) : <Muted style={styles.intro}>Searching by name isn’t switched on yet. Paste a link to the menu instead.</Muted>}
        {mode === 'name' ? (
          <>
            <Field label="Restaurant name" value={name} onChangeText={setName} placeholder="e.g. Sunny Thai Kitchen" maxLength={120} />
            <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. Pasadena, CA" maxLength={120} />
          </>
        ) : (
          <Field label="Link to the menu" value={link} onChangeText={setLink} placeholder="https://…/menu" autoCapitalize="none"
            autoCorrect={false} keyboardType="url" maxLength={500} />
        )}
        <Button title="Check gluten safety" onPress={check} busy={busy} />
        <Progress busy={busy} steps={['Finding the menu…', 'Checking each dish…', 'Cross-checking recipes…', 'Reading what celiac diners say…', 'Almost done… (up to a minute)']} />
        <ErrorText>{error}</ErrorText>
      </Card>
      {result ? <><ScoreCard result={result} strict={strict} /><DishList dishes={result.dishes} strict={strict} onAskWaiter={onAskWaiter} /></> : null}
    </>
  );
}

// Shrinks a phone photo so it uploads quickly
async function preparePhoto(asset) {
  const big = Math.max(asset.width || 0, asset.height || 0) > MAX_PHOTO_SIDE;
  let context = ImageManipulator.manipulate(asset.uri);
  if (big) context = context.resize(asset.width >= asset.height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
}

function MenuPhoto({ usage, onUsage, result, setResult, strict, onAskWaiter }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();

  async function pick(fromCamera) {
    setError('');
    const permission = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!permission.granted) return setError('FridgeBook needs the camera to read the menu. You can allow it in Settings.');
    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (picked.canceled || !picked.assets || !picked.assets.length) return;
    setBusy(true);
    try {
      const uri = await preparePhoto(picked.assets[0]);
      const photo = await readFile(uri);
      const data = await runCheck(() => request(`/api/gluten/menu-photo?local_date=${todayString()}`, { method: 'POST', raw: photo, contentType: 'image/jpeg' }), () => !mounted.current);
      if (!mounted.current || !data) return;
      setResult(data);
      if (data.remaining !== undefined) onUsage('menu', data.remaining);
    } catch (err) {
      if (mounted.current) setError(err.message || 'We couldn’t read that menu. Please try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardTitle icon="📷" title="Scan a menu" right={usage ? `${usage.menu.remaining} left today` : null} />
        <Muted style={styles.intro}>Take a photo of one menu page, flat and in good light. Google’s Gemini reads it; the photo isn’t saved.</Muted>
        <View style={styles.buttons}>
          <Button title="Take a photo" onPress={() => pick(true)} busy={busy} />
          <Button title="Choose from Photos" variant="ghost" onPress={() => pick(false)} disabled={busy} />
        </View>
        <Progress busy={busy} steps={['Uploading the photo…', 'Reading the menu…', 'Checking each dish…', 'Almost done…']} />
        <ErrorText>{error}</ErrorText>
      </Card>
      {result ? <><ScoreCard result={result} strict={strict} /><DishList dishes={result.dishes} strict={strict} onAskWaiter={onAskWaiter} /></> : null}
    </>
  );
}

function AskWaiter({ dish, usage, onUsage, strict }) {
  const recorder = useAudioRecorder(WAV_RECORDING);
  const [dishName, setDishName] = useState(dish ? dish.name : '');
  const [stage, setStage] = useState('idle'); // idle | recording | checking
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const mounted = useMounted();
  const supported = Platform.OS === 'ios';

  useEffect(() => { if (dish) setDishName(dish.name); }, [dish]);
  useEffect(() => () => clearInterval(timer.current), []);

  const stop = useCallback(async () => {
    clearInterval(timer.current);
    if (!recorder.isRecording && stage !== 'recording') return;
    setStage('checking');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const audio = await readFile(recorder.uri);
      const params = [`local_date=${todayString()}`];
      if (dishName.trim()) params.push(`dish=${encodeURIComponent(dishName.trim())}`);
      if (dish && dish.name === dishName && dish.description) params.push(`description=${encodeURIComponent(dish.description)}`);
      const { data } = await request(`/api/gluten/voice?${params.join('&')}`, { method: 'POST', raw: audio, contentType: 'audio/wav' });
      if (!mounted.current) return;
      setResult(data);
      if (data.remaining !== undefined) onUsage('voice', data.remaining);
    } catch (err) {
      if (mounted.current) setError(err.message || 'We couldn’t check that recording. Please try again.');
    } finally {
      if (mounted.current) setStage('idle');
    }
  }, [recorder, stage, dishName, dish, mounted, onUsage]);

  // stop automatically at the time limit
  useEffect(() => { if (stage === 'recording' && seconds >= MAX_RECORDING_SECONDS) stop(); }, [seconds, stage, stop]);

  async function start() {
    setError('');
    setResult(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return setError('FridgeBook needs the microphone to hear the server. You can allow it in Settings.');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setStage('recording');
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError('Recording didn’t start. Please try again.');
    }
  }

  const look = result ? verdictLook(result.verdict, strict) : null;
  return (
    <Card>
      <CardTitle icon="🎤" title="Ask the waiter" right={usage ? `${usage.voice.remaining} left today` : null} />
      <Muted style={styles.intro}>Ask how the dish is made, then record the answer. Let your server know you’re recording to check for gluten. Google’s Gemini transcribes the clip once; the audio isn’t saved.</Muted>
      <Field label="Dish (optional)" value={dishName} onChangeText={setDishName} placeholder="e.g. Chicken katsu" maxLength={120} />
      {!supported ? <ErrorText>Recording works on iPhone for now.</ErrorText>
        : stage === 'recording'
          ? <Button variant="danger" title={`■ Stop recording (${MAX_RECORDING_SECONDS - seconds}s left)`} onPress={stop} />
          : <Button title={stage === 'checking' ? 'Listening to the recording…' : '● Start recording'} onPress={start} busy={stage === 'checking'} />}
      <ErrorText>{error}</ErrorText>
      {result ? (
        <View style={styles.voice}>
          <View style={styles.verdict}><Badge tone={look.tone} label={look.label} /></View>
          <Text style={styles.body}>{result.reason}</Text>
          {result.ingredients.length ? <Text style={styles.h3}>Ingredients you heard</Text> : null}
          {result.ingredients.map((item, i) => {
            const il = ingredientLook(item.gluten_status, strict);
            return (
              <View key={i} style={styles.heard}>
                <Text style={[styles.body, styles.flex]}>{item.name}</Text>
                <Badge tone={il.tone} label={il.label} />
              </View>
            );
          })}
          {result.preparation.length ? <Text style={styles.h3}>How it’s made</Text> : null}
          {result.preparation.map((p, i) => <Text key={i} style={styles.body}>{p.risk === 'ok' ? '✓ ' : '⚠ '}{p.text}</Text>)}
          {result.typical && result.typical.questions.length ? <Text style={styles.h3}>Worth asking</Text> : null}
          {result.typical ? result.typical.questions.map((q) => <Text key={q} style={styles.body}>• {q}</Text>) : null}
          {result.transcript ? <Muted style={styles.transcript}>“{result.transcript}”</Muted> : null}
          <Muted style={styles.disclaimer}>{result.disclaimer || DISCLAIMER}</Muted>
        </View>
      ) : null}
    </Card>
  );
}

export default function GlutenCheck() {
  const { user } = useAuth();
  const strict = !!(user && user.celiac_strict);
  const scroll = useRef(null);
  const [tab, setTab] = useState('restaurant');
  const [usage, setUsage] = useState(null);
  const [restaurantResult, setRestaurantResult] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);
  const [voiceDish, setVoiceDish] = useState(null);

  useEffect(() => {
    request(`/api/gluten/usage?local_date=${todayString()}`).then(({ data }) => setUsage(data)).catch(() => {});
  }, []);

  const onUsage = useCallback((kind, remaining) => {
    setUsage((current) => (current ? { ...current, [kind]: { ...current[kind], remaining } } : current));
  }, []);

  const askWaiter = useCallback((dish) => {
    setVoiceDish(dish);
    setTab('voice');
    if (scroll.current) scroll.current.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Segmented label="Gluten checks" value={tab} onChange={setTab}
        options={[{ label: 'Restaurant', value: 'restaurant' }, { label: 'Menu photo', value: 'photo' }, { label: 'Waiter', value: 'voice' }]} />
      {tab === 'restaurant' && <Restaurant usage={usage} onUsage={onUsage} result={restaurantResult} setResult={setRestaurantResult} strict={strict} onAskWaiter={askWaiter} />}
      {tab === 'photo' && <MenuPhoto usage={usage} onUsage={onUsage} result={photoResult} setResult={setPhotoResult} strict={strict} onAskWaiter={askWaiter} />}
      {tab === 'voice' && <AskWaiter dish={voiceDish} usage={usage} onUsage={onUsage} strict={strict} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48 },
  flex: { flex: 1 },
  intro: { marginBottom: 14 },
  buttons: { gap: 10 },
  progress: { marginTop: 12, fontWeight: '700', color: colors.mintDark },
  voice: { marginTop: 16, gap: 8 },
  verdict: { flexDirection: 'row' },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink },
  h3: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 8 },
  heard: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transcript: { fontStyle: 'italic', marginTop: 8 },
  disclaimer: { marginTop: 8, fontSize: 13, fontWeight: '600' }
});
