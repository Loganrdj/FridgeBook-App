// Signing in: the app opens the website's Google sign-in in a secure browser
// sheet and gets back a one-time code, which it swaps for its own token.
// PKCE (a secret only this app knows) makes a stolen code useless.
// See lib/mobileAuth.js on the server for the other half.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, request, loadToken, saveToken, clearToken, onSignedOut, hasToken } from './api';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Base64url without padding (the encoding PKCE uses)
export function base64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '';
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

export async function makePkce() {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
  return { verifier, challenge: digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
}

// The query parameters of the address the browser came back to
export function readReturnUrl(url) {
  const query = String(url || '').split('?')[1] || '';
  const params = {};
  for (const part of query.split('#')[0].split('&')) {
    if (!part) continue;
    const [key, value = ''] = part.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return params;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true });

  const setUser = useCallback((user) => setState({ user, loading: false }), []);

  // On launch: a saved token means we're signed in, if the server still agrees
  useEffect(() => {
    onSignedOut(() => setUser(null));
    (async () => {
      try {
        if (!(await loadToken())) return setUser(null);
        const { data } = await request('/profile');
        setUser(data && data.user_name ? data : null);
      } catch (err) {
        // offline: keep the person signed in; anything else means sign in again
        setUser(err.status === 0 && hasToken() ? { user_name: '', offline: true } : null);
      }
    })();
  }, [setUser]);

  const signIn = useCallback(async () => {
    const { verifier, challenge } = await makePkce();
    const redirectUri = Linking.createURL('auth');
    const startUrl = `${API_URL}/auth/mobile/start?redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}`;
    const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
    if (result.type !== 'success') return { cancelled: true };
    const params = readReturnUrl(result.url);
    if (!params.code) return { cancelled: params.error === 'cancelled', error: params.error && params.error !== 'cancelled' ? 'Sign-in didn’t finish. Please try again.' : null };
    const { data } = await request('/auth/mobile/token', {
      method: 'POST',
      body: { code: params.code, code_verifier: verifier, device_name: Device.deviceName || Device.modelName || 'iPhone' }
    });
    await saveToken(data.token);
    setUser(data.user);
    return { user: data.user };
  }, [setUser]);

  const signOut = useCallback(async () => {
    try { await request('/auth/mobile/token', { method: 'DELETE' }); } catch (err) { /* signed out locally either way */ }
    await clearToken();
    setUser(null);
  }, [setUser]);

  // Applies changed settings (like Celiac Mode) without asking the server again
  const updateUser = useCallback((fields) => {
    setState((current) => (current.user ? { ...current, user: { ...current.user, ...fields } } : current));
  }, []);

  const value = useMemo(() => ({ ...state, signIn, signOut, updateUser }), [state, signIn, signOut, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
