import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import axios from 'axios';
import App from './App';
import { addDays } from './utils/dates';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));

const milk = { id: 1, name: 'Milk', quantity: 2, date_start: addDays(0), date_expire: addDays(1), fridge_bool: true };
const rice = { id: 2, name: 'Rice', quantity: 1, date_start: addDays(0), date_expire: addDays(200), fridge_bool: false };
const spinach = { id: 3, name: 'Spinach', quantity: 1, date_start: addDays(-5), date_expire: addDays(-2), fridge_bool: true };

function mockServer({ user = null, ingredients = [] } = {}) {
  axios.get.mockImplementation((url) => {
    if (url === '/profile') return Promise.resolve({ data: user ? { user_name: user } : '' });
    if (url === '/api/ingredient') return Promise.resolve({ data: ingredients });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function visit(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  jest.clearAllMocks();
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
