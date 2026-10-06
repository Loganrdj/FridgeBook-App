import * as SecureStore from 'expo-secure-store';
import { base64url, readReturnUrl } from '../lib/auth';
import { API_URL, ApiError, clearToken, onSignedOut, request, runCheck, saveToken } from '../lib/api';
import { verdictLook, sortDishes } from '../lib/gluten';

jest.mock('expo-secure-store', () => {
  const store = {};
  return {
    getItemAsync: jest.fn(async (k) => store[k] || null),
    setItemAsync: jest.fn(async (k, v) => { store[k] = v; }),
    deleteItemAsync: jest.fn(async (k) => { delete store[k]; })
  };
});

const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, text: async () => (data === undefined ? '' : JSON.stringify(data)) });

beforeEach(async () => {
  global.fetch = jest.fn();
  await clearToken();
});

test('base64url matches the standard encoding PKCE needs', () => {
  for (const bytes of [[], [0], [251, 255], [1, 2, 3], [255, 254, 253, 252, 251, 250, 249]]) {
    const expected = Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(base64url(Uint8Array.from(bytes))).toBe(expected);
  }
});

test('reads the code or error the browser comes back with', () => {
  expect(readReturnUrl('fridgebook://auth?code=abc_-123')).toEqual({ code: 'abc_-123' });
  expect(readReturnUrl('exp://192.168.1.5:8081/--/auth?error=cancelled')).toEqual({ error: 'cancelled' });
  expect(readReturnUrl('fridgebook://auth')).toEqual({});
});

test('sends the saved token and JSON, and returns the data', async () => {
  await saveToken('fbm_secret');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fridgebook.token', 'fbm_secret');
  fetch.mockResolvedValue(reply(201, { id: 1 }));
  const res = await request('/api/ingredient', { method: 'POST', body: { name: 'Eggs' } });
  expect(res).toEqual({ status: 201, data: { id: 1 } });
  expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/ingredient`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: 'Bearer fbm_secret', 'Content-Type': 'application/json' },
    body: '{"name":"Eggs"}'
  });
});

test('an expired sign-in clears the token and signs the app out', async () => {
  const signedOut = jest.fn();
  onSignedOut(signedOut);
  await saveToken('fbm_old');
  fetch.mockResolvedValue(reply(401, { error: 'Your sign-in has expired. Please sign in again.' }));
  await expect(request('/api/ingredient')).rejects.toEqual(expect.objectContaining({ status: 401, message: 'Your sign-in has expired. Please sign in again.' }));
  expect(signedOut).toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fridgebook.token');
});

test('friendly errors when offline or the server fails', async () => {
  fetch.mockRejectedValue(new Error('Network request failed'));
  await expect(request('/profile')).rejects.toEqual(expect.objectContaining({ status: 0, message: expect.stringMatching(/Can’t reach|Can't reach/) }));
  fetch.mockResolvedValue(reply(422, { errors: ['name must be 1-100 characters'] }));
  await expect(request('/api/ingredient', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
  await expect(request('/api/ingredient', { method: 'POST', body: {} })).rejects.toHaveProperty('message', 'name must be 1-100 characters');
});

test('waits for slow checks to finish', async () => {
  fetch
    .mockResolvedValueOnce(reply(200, { state: 'running' }))
    .mockResolvedValueOnce(reply(200, { score: { total: 1 } }));
  const data = await runCheck(async () => ({ status: 202, data: { job: 'j1' } }), () => false, 0);
  expect(data).toEqual({ score: { total: 1 } });
  expect(fetch.mock.calls.map((c) => c[0])).toEqual([`${API_URL}/api/gluten/jobs/j1`, `${API_URL}/api/gluten/jobs/j1`]);
});

test('gluten labels match the website', () => {
  expect(verdictLook('ask', false).label).toBe('Ask first');
  expect(verdictLook('ask', true).tone).toBe('expired');
  expect(sortDishes([{ verdict: 'likely_gluten' }, { verdict: 'low_risk' }, { verdict: 'ask' }]).map((d) => d.verdict))
    .toEqual(['low_risk', 'ask', 'likely_gluten']);
});
