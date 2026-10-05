import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import axios from 'axios';
import App, { SLOW_LOAD_NOTE_DELAY_MS } from './App';
import { act } from 'react-dom/test-utils';
import { addDays } from './utils/dates';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));

const milk = { id: 1, name: 'Milk', quantity: 2, date_start: addDays(0), date_expire: addDays(1), fridge_bool: true };
const rice = { id: 2, name: 'Rice', quantity: 1, date_start: addDays(0), date_expire: addDays(200), fridge_bool: false };
const spinach = { id: 3, name: 'Spinach', quantity: 1, date_start: addDays(-5), date_expire: addDays(-2), fridge_bool: true };

function mockServer({ user = null, ingredients = [], celiac = false } = {}) {
  axios.get.mockImplementation((url) => {
    if (url === '/profile') return Promise.resolve({ data: user ? { user_id: 1, user_name: user, celiac_mode: celiac, celiac_strict: false } : '' });
    if (url === '/api/ingredient') return Promise.resolve({ data: ingredients });
    if (url === '/api/shopping') return Promise.resolve({ data: [] });
    if (url.startsWith('/api/recipes/usage')) return Promise.resolve({ data: { limit: 20, remaining: 20 } });
    if (url.startsWith('/api/meals')) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function visit(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  // reset, not just clear: a test's fake responses (like one that never answers) mustn't leak into the next
  jest.resetAllMocks();
  axios.post.mockResolvedValue({ data: [] });
  localStorage.clear();
});

describe('when logged out', () => {
  it('shows the landing page with a Google sign-in link', async () => {
    mockServer();
    visit('/');
    const link = await screen.findByRole('link', { name: /sign in with google/i });
    expect(link).toHaveAttribute('href', 'http://localhost:8080/auth/google');
  });

  it('sends private pages back to the landing page', async () => {
    mockServer();
    visit('/kitchen');
    await screen.findByRole('link', { name: /sign in with google/i });
    expect(window.location.pathname).toBe('/');
    expect(axios.get).not.toHaveBeenCalledWith('/api/ingredient');
  });

  it('explains a failed sign-in', async () => {
    mockServer();
    visit('/?login=failed');
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't finish/i);
  });
});

describe('when logged in', () => {
  it('goes from the landing page to the dashboard and greets the user', async () => {
    mockServer({ user: 'Alice Smith' });
    visit('/');
    expect(await screen.findByRole('heading', { name: /^good (morning|afternoon|evening), alice$/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it("shows the user's own kitchen from the server, split into fridge and pantry", async () => {
    mockServer({ user: 'Alice Smith', ingredients: [rice, milk] });
    visit('/kitchen');
    const fridge = await screen.findByRole('region', { name: 'Fridge' });
    const pantry = screen.getByRole('region', { name: 'Pantry' });
    expect(within(fridge).getByText('Milk')).toBeInTheDocument();
    expect(within(fridge).getByText('Tomorrow')).toBeInTheDocument();
    expect(within(pantry).getByText('Rice')).toBeInTheDocument();
    expect(within(pantry).queryByText('Milk')).toBeNull();
  });

  it('imports items saved in this browser before accounts, once', async () => {
    localStorage.setItem('ingredients', JSON.stringify([
      { id: 'a', name: 'Carrot', quantity: 3, date_expire: '2026-10-15', fridge_bool: true },
      { id: 9, value: 'garlic' }
    ]));
    axios.post.mockResolvedValue({ data: { imported: 1, skipped: 0 } });
    mockServer({ user: 'Alice Smith' });
    visit('/dashboard');
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/ingredient'));
    expect(axios.post).toHaveBeenCalledWith('/api/ingredient/import', {
      ingredients: [{ id: 'a', name: 'Carrot', quantity: 3, date_expire: '2026-10-15', fridge_bool: true }]
    });
    expect(localStorage.getItem('ingredients')).toBeNull();
    expect(JSON.parse(localStorage.getItem('recipeSearch'))).toEqual([{ id: 9, value: 'garlic' }]);
  });
});

describe('dashboard', () => {
  it('counts items and lists what to use soon, expired first', async () => {
    mockServer({ user: 'Alice Smith', ingredients: [rice, milk, spinach] });
    visit('/dashboard');
    const summary = await screen.findByRole('region', { name: 'Kitchen summary' });
    await waitFor(() => expect(within(summary).getByText('In the fridge').previousSibling).toHaveTextContent('2'));
    expect(within(summary).getByText('Expired').previousSibling).toHaveTextContent('1');
    const soon = screen.getByRole('region', { name: 'Use these soon' });
    const names = within(soon).getAllByText(/^(Spinach|Milk|Rice)$/).map((el) => el.textContent);
    expect(names).toEqual(['Spinach', 'Milk']);
  });
});

describe('recipes', () => {
  it("fills the search with what's expiring", async () => {
    mockServer({ user: 'Alice Smith', ingredients: [spinach, milk, rice] });
    visit('/recipes');
    await waitFor(() => expect(screen.getByRole('button', { name: /use what's expiring/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /use what's expiring/i }));
    const chosen = screen.getByRole('list', { name: 'Chosen ingredients' });
    // expired spinach is skipped; the rest go in soonest-first
    expect(within(chosen).getAllByRole('button').map((b) => b.textContent.replace('×', '').trim())).toEqual(['milk', 'rice']);
  });
});

describe('kitchen to shopping list', () => {
  it('adds a kitchen item to the shopping list and confirms', async () => {
    mockServer({ user: 'Alice Smith', ingredients: [milk] });
    axios.post.mockResolvedValue({ data: { id: 50, name: 'Milk', quantity: 1, note: null, checked: false, source: 'kitchen' } });
    visit('/kitchen');
    fireEvent.click(await screen.findByRole('button', { name: 'Add Milk to the shopping list' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Added Milk to your shopping list.');
    expect(axios.post).toHaveBeenCalledWith('/api/shopping', { name: 'Milk', quantity: 1, source: 'kitchen' });
  });
});

describe('loading screen', () => {
  it('explains a slow first load, but only once it is actually slow', () => {
    jest.useFakeTimers();
    axios.get.mockImplementation(() => new Promise(() => {})); // the server is still waking up
    const view = visit('/');
    try {
      expect(screen.queryByText(/free server and database/i)).toBeNull();
      act(() => { jest.advanceTimersByTime(SLOW_LOAD_NOTE_DELAY_MS); });
      expect(screen.getByRole('status')).toHaveTextContent(/free server and database, so it's starting up/i);
    } finally {
      // tear down while the fake clock is still in place, and let React's scheduler finish
      // anything it queued on it, or later tests' effects never run
      view.unmount();
      act(() => { jest.runOnlyPendingTimers(); });
      jest.useRealTimers();
    }
  });
});

describe('Celiac Mode', () => {
  const bread = { id: 9, name: 'Sourdough bread', quantity: 1, date_start: addDays(0), date_expire: addDays(3), fridge_bool: false, gluten_status: 'contains', gluten_reason: 'Bread has wheat.' };
  const cereal = { id: 10, name: 'Cereal', quantity: 1, date_start: addDays(0), date_expire: addDays(90), fridge_bool: false, gluten_status: null, gluten_reason: null };

  it('labels the kitchen, checks unlabeled items once, and counts gluten on the dashboard', async () => {
    axios.post.mockResolvedValue({ data: [{ id: 10, gluten_status: 'may_contain', gluten_reason: 'Many cereals use malt.' }] });
    mockServer({ user: 'Alice Smith', ingredients: [bread, cereal, milk], celiac: true });
    visit('/kitchen');
    expect(await screen.findByText('🌾 Contains gluten')).toBeInTheDocument();
    expect(await screen.findByText('🌾 May contain gluten')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith('/api/gluten/classify-kitchen', { local_date: expect.any(String) });
    expect(axios.post.mock.calls.filter(([url]) => url === '/api/gluten/classify-kitchen')).toHaveLength(1);
  });

  it('shows nothing about gluten when Celiac Mode is off', async () => {
    mockServer({ user: 'Alice Smith', ingredients: [bread] });
    visit('/kitchen');
    await screen.findByText('Sourdough bread');
    expect(screen.queryByText(/Contains gluten/)).toBeNull();
    expect(axios.post).not.toHaveBeenCalledWith('/api/gluten/classify-kitchen', expect.anything());
  });

  it('adds a gluten tile to the dashboard', async () => {
    mockServer({ user: 'Alice Smith', ingredients: [bread, milk], celiac: true });
    visit('/dashboard');
    const summary = await screen.findByRole('region', { name: 'Kitchen summary' });
    await waitFor(() => expect(within(summary).getByText('Contain gluten').previousSibling).toHaveTextContent('1'));
  });
});
