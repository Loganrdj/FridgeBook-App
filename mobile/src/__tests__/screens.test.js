import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthContext } from '../lib/auth';
import { request, runCheck } from '../lib/api';
import Kitchen from '../app/(tabs)/index';
import GlutenCheck from '../app/(tabs)/gluten';
import Settings from '../app/(tabs)/settings';
import SignIn from '../app/sign-in';

jest.mock('../lib/api', () => ({
  API_URL: 'https://fridge-book.com',
  request: jest.fn(),
  runCheck: jest.fn(),
  readFile: jest.fn(async () => 'file-blob')
}));
// screens refresh when they come into view; here, once on mount
jest.mock('expo-router', () => {
  const ReactLib = require('react');
  return { useFocusEffect: (cb) => ReactLib.useEffect(cb, [cb]) };
});
jest.mock('expo-audio', () => ({
  AudioQuality: { MEDIUM: 64 },
  IOSOutputFormat: { LINEARPCM: 'lpcm' },
  useAudioRecorder: () => ({ isRecording: false, uri: 'file:///clip.wav', prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn()
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function withUser(ui, user = {}, extra = {}) {
  const value = {
    user: { user_id: 1, user_name: 'Logan Moss', celiac_mode: false, celiac_strict: false, ...user },
    loading: false, signIn: jest.fn(), signOut: jest.fn(), updateUser: jest.fn(), ...extra
  };
  return { value, ui: <AuthContext.Provider value={value}>{ui}</AuthContext.Provider> };
}

beforeEach(() => jest.clearAllMocks());

describe('Kitchen', () => {
  const items = [
    { id: 2, name: 'Rice', quantity: 1, date_expire: day(200), fridge_bool: false, gluten_status: 'gluten_free' },
    { id: 1, name: 'Milk', quantity: 2, date_expire: day(1), fridge_bool: true, gluten_status: 'gluten_free' },
    { id: 3, name: 'Bagels', quantity: 6, date_expire: day(4), fridge_bool: false, gluten_status: 'contains' }
  ];

  it('lists items soonest first and filters by fridge or pantry', async () => {
    request.mockResolvedValue({ status: 200, data: items });
    const { ui } = withUser(<Kitchen />);
    await render(ui);
    expect(await screen.findByText('Milk')).toBeOnTheScreen();
    const names = screen.getAllByText(/^(Milk|Bagels|Rice)$/).map((n) => n.props.children);
    expect(names).toEqual(['Milk', 'Bagels', 'Rice']);
    expect(screen.getByText('3 items · 1 to use soon')).toBeOnTheScreen();
    // gluten labels only in Celiac Mode
    expect(screen.queryByText('🌾 Contains gluten')).toBeNull();

    // the second Pantry option is the list filter (the first is in the add form)
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Pantry' })[1]);
    expect(screen.queryByText('Milk')).toBeNull();
    expect(screen.getByText('Rice')).toBeOnTheScreen();
  });

  it('adds an item with a quick expiry choice', async () => {
    request.mockResolvedValueOnce({ status: 200, data: [] });
    const { ui } = withUser(<Kitchen />);
    await render(ui);
    await screen.findByText(/Your kitchen is empty/);
    request.mockResolvedValueOnce({ status: 201, data: { id: 9, name: 'Greek yogurt', quantity: 2, date_expire: day(14), fridge_bool: true } });
    await fireEvent.changeText(screen.getByLabelText('Item'), 'Greek yogurt');
    await fireEvent.changeText(screen.getByLabelText('Quantity'), '2');
    await fireEvent.press(screen.getByRole('button', { name: '2 weeks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Greek yogurt')).toBeOnTheScreen();
    expect(request).toHaveBeenLastCalledWith('/api/ingredient', {
      method: 'POST',
      body: { name: 'Greek yogurt', quantity: 2, date_start: expect.any(String), date_expire: day(14), fridge_bool: true }
    });
  });

  it('changes quantities and asks before removing', async () => {
    request.mockResolvedValue({ status: 200, data: [items[1]] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { ui } = withUser(<Kitchen />);
    await render(ui);
    await fireEvent.press(await screen.findByRole('button', { name: 'One more Milk' }));
    expect(request).toHaveBeenCalledWith('/api/ingredient/1', { method: 'PATCH', body: { quantity: 3 } });
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Milk' }));
    expect(alert).toHaveBeenCalledWith('Remove Milk?', expect.any(String), expect.any(Array));
  });

  it('in Celiac Mode, labels gluten and checks unlabeled items', async () => {
    request.mockImplementation(async (path) => (path === '/api/ingredient'
      ? { status: 200, data: [...items, { id: 4, name: 'Cereal', quantity: 1, date_expire: day(30), fridge_bool: false, gluten_status: null }] }
      : { status: 200, data: [{ id: 4, gluten_status: 'may_contain', gluten_reason: 'Malt.' }] }));
    const { ui } = withUser(<Kitchen />, { celiac_mode: true });
    await render(ui);
    expect(await screen.findByText('🌾 Contains gluten')).toBeOnTheScreen();
    expect(await screen.findByText('🌾 May contain gluten')).toBeOnTheScreen();
    expect(request).toHaveBeenCalledWith('/api/gluten/classify-kitchen', { method: 'POST', body: { local_date: expect.any(String) } });
  });
});

describe('Gluten check', () => {
  const usage = { restaurant: { limit: 3, remaining: 3 }, menu: { limit: 10, remaining: 10 }, voice: { limit: 20, remaining: 20 }, restaurant_by_name: true };
  const result = {
    restaurant: { name: 'Sunny Thai', location: 'Pasadena, CA' },
    score: { total: 2, counts: { likely_gluten: 1, unknown: 0, ask: 0, low_risk: 1 }, ingredient_score: 50, cross_contact_cap: 40, overall_score: 40, capped: true },
    cross_contact: { level: 'high', summary: 'Shared fryer.', findings: [{ text: 'A diner reports a shared fryer.', tone: 'bad', source_url: 'https://x.example' }] },
    dishes: [
      { name: 'Pad Thai', verdict: 'likely_gluten', gluten_chance: 67, reason: 'Soy sauce.', sources: ['soy sauce'], questions: ['Tamari?'], cautions: [], recipes: null },
      { name: 'Mango Sticky Rice', verdict: 'low_risk', gluten_chance: 5, reason: 'Rice.', sources: [], questions: [], cautions: [], recipes: null }
    ],
    sources: [], remaining: 2
  };

  it('checks a restaurant and shows the capped two-part score', async () => {
    request.mockResolvedValue({ status: 200, data: usage });
    runCheck.mockResolvedValue(result);
    const { ui } = withUser(<GlutenCheck />, { celiac_mode: true });
    await render(ui);
    expect(await screen.findByText('3 left today')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Restaurant name'), 'Sunny Thai');
    await fireEvent.press(screen.getByRole('button', { name: 'Check gluten safety' }));
    expect(await screen.findByText('40%')).toBeOnTheScreen();
    expect(screen.getByText(/Capped at 40% because of the high cross-contact risk/)).toBeOnTheScreen();
    expect(screen.getByText('2 left today')).toBeOnTheScreen();

    // a dish opens to show why and what to ask, and can go to the waiter check
    await fireEvent.press(screen.getByRole('button', { name: 'Pad Thai, Likely gluten' }));
    expect(screen.getByText('• Tamari?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '🎤 Record what the server says' }));
    expect(screen.getByLabelText('Dish (optional)').props.value).toBe('Pad Thai');
  });

  it('asks for a restaurant name first', async () => {
    request.mockResolvedValue({ status: 200, data: usage });
    const { ui } = withUser(<GlutenCheck />, { celiac_mode: true });
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Check gluten safety' }));
    expect(await screen.findByText('Enter the restaurant’s name.')).toBeOnTheScreen();
    expect(runCheck).not.toHaveBeenCalled();
  });
});

describe('Settings and sign-in', () => {
  it('turns Celiac Mode on and signs out', async () => {
    request.mockResolvedValue({ status: 200, data: { celiac_mode: true, celiac_strict: false } });
    const { ui, value } = withUser(<Settings />);
    await render(ui);
    await fireEvent(screen.getByLabelText('Celiac Mode'), 'valueChange', true);
    await waitFor(() => expect(value.updateUser).toHaveBeenCalledWith({ celiac_mode: true, celiac_strict: false }));
    expect(request).toHaveBeenCalledWith('/api/me/settings', { method: 'PATCH', body: { celiac_mode: true } });
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(value.signOut).toHaveBeenCalled();
  });

  it('signs in with Google and shows a friendly error if it fails', async () => {
    const { ui, value } = withUser(<SignIn />, {}, { signIn: jest.fn().mockRejectedValue(new Error("Can't reach FridgeBook.")) });
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(value.signIn).toHaveBeenCalled();
    expect(await screen.findByText("Can't reach FridgeBook.")).toBeOnTheScreen();
  });
});
