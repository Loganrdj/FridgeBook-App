import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));

const milk = { id: 1, name: 'Milk', quantity: 2, date_start: '2026-10-01', date_expire: '2026-10-02', fridge_bool: true };
const rice = { id: 2, name: 'Rice', quantity: 1, date_start: '2026-10-01', date_expire: '2027-01-01', fridge_bool: false };

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
    expect(await screen.findByText('Welcome, Alice')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it("shows the user's own kitchen from the server, split into fridge and pantry", async () => {
    mockServer({ user: 'Alice Smith', ingredients: [rice, milk] });
    visit('/kitchen');
    await screen.findByText('Milk');
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(screen.getByText('10/2/2026')).toBeInTheDocument();
    expect(screen.getByText('1/1/2027')).toBeInTheDocument();
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
