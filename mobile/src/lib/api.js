// Talks to the FridgeBook server (the same API the website uses). The app signs
// in with a token, sent as "Authorization: Bearer ..." and kept in the iPhone's
// secure storage (the Keychain).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.apiUrl) || 'https://fridge-book.com').replace(/\/$/, '');

const TOKEN_KEY = 'fridgebook.token';
let token = null;
let signedOutHandler = null;

// The Keychain on iPhone; the browser's storage when previewing the app on the web
const storage = Platform.OS === 'web'
  ? {
    get: async (k) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(k)),
    set: async (k, v) => localStorage.setItem(k, v),
    remove: async (k) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); }
  }
  : { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, remove: SecureStore.deleteItemAsync };

export async function loadToken() {
  token = await storage.get(TOKEN_KEY);
  return token;
}

export async function saveToken(value) {
  token = value;
  await storage.set(TOKEN_KEY, value);
}

export async function clearToken() {
  token = null;
  await storage.remove(TOKEN_KEY);
}

export const hasToken = () => !!token;

// Called when the server says the sign-in has expired, so the app can show the sign-in screen
export function onSignedOut(handler) {
  signedOutHandler = handler;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function messageFor(status, data) {
  if (data && data.error) return data.error;
  if (data && Array.isArray(data.errors)) return data.errors.join(' ');
  if (status === 401) return 'Please sign in again.';
  if (status === 429) return "You've reached today's limit. It resets at midnight.";
  if (status >= 500) return 'FridgeBook is having trouble right now. Please try again in a minute.';
  return 'Something went wrong. Please try again.';
}

/**
 * request('/api/ingredient', { method, body }) -> { status, data }
 * raw + contentType send a file (a photo or a recording) as the body.
 * Throws ApiError with a message that's fine to show the person.
 */
export async function request(path, { method = 'GET', body, raw, contentType } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    headers['Content-Type'] = contentType;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(API_URL + path, { method, headers, body: payload });
  } catch (err) {
    throw new ApiError("Can't reach FridgeBook. Check your connection and try again.", 0, null);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

  if (response.status === 401 && token) {
    await clearToken();
    if (signedOutHandler) signedOutHandler();
  }
  if (!response.ok) throw new ApiError(messageFor(response.status, data), response.status, data);
  return { status: response.status, data };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Slow checks (a restaurant, a menu photo) answer 202 { job }; this waits for
 * the result. isCancelled() lets a screen stop waiting when it closes.
 */
export async function runCheck(start, isCancelled = () => false, pollMs = 2500) {
  const first = await start();
  if (first.status !== 202 || !first.data || !first.data.job) return first.data;
  const began = Date.now();
  while (Date.now() - began < 4 * 60 * 1000) {
    await wait(pollMs);
    if (isCancelled()) return null;
    const poll = await request(`/api/gluten/jobs/${first.data.job}`);
    if (!poll.data || poll.data.state !== 'running') return poll.data;
  }
  throw new ApiError('That check is taking too long. Please try again.', 0, null);
}

// Reads a local file (a photo or recording the app just made) so it can be uploaded
export async function readFile(uri) {
  const response = await fetch(uri);
  return response.blob();
}
