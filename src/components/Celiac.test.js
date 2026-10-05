import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Settings from './Settings';
import GlutenBadge, { glutenLook, isGlutenRisk } from './GlutenBadge';
import { AuthContext } from '../context/AuthContext';

jest.mock('axios', () => ({ patch: jest.fn(), get: jest.fn(), post: jest.fn() }));

const withUser = (user, ui, extra = {}) => (
  <AuthContext.Provider value={{ user: { id: 1, name: 'Alice Smith', celiac_mode: false, celiac_strict: false, ...user }, loading: false, updateUser: jest.fn(), ...extra }}>
    {ui}
  </AuthContext.Provider>
);

beforeEach(() => jest.clearAllMocks());

describe('Settings', () => {
  it('turns Celiac Mode on and then shows the Strict switch', async () => {
    const updateUser = jest.fn();
    axios.patch.mockResolvedValue({ data: { celiac_mode: true, celiac_strict: false } });
    const { rerender } = render(withUser({}, <Settings />, { updateUser }));
    expect(screen.getByRole('switch', { name: 'Celiac Mode' })).not.toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Strict' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Celiac Mode' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ celiac_mode: true, celiac_strict: false }));
    expect(axios.patch).toHaveBeenCalledWith('/api/me/settings', { celiac_mode: true });
    rerender(withUser({ celiac_mode: true }, <Settings />, { updateUser }));
    expect(screen.getByRole('switch', { name: 'Strict' })).toBeInTheDocument();
    expect(screen.getByText(/not medical advice/)).toBeInTheDocument();
  });

  it('says so when saving fails', async () => {
    axios.patch.mockRejectedValue(new Error('down'));
    render(withUser({}, <Settings />));
    fireEvent.click(screen.getByRole('switch', { name: 'Celiac Mode' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });
});

describe('gluten badges', () => {
  it('only appear in Celiac Mode', () => {
    const { rerender } = render(withUser({}, <GlutenBadge status="contains" />));
    expect(screen.queryByText(/gluten/i)).toBeNull();
    rerender(withUser({ celiac_mode: true }, <GlutenBadge status="contains" reason="Bread has wheat." />));
    expect(screen.getByText('🌾 Contains gluten')).toHaveAttribute('title', 'Bread has wheat.');
  });

  it('Strict mode turns "may contain" red', () => {
    expect(glutenLook('may_contain', false)).toEqual({ tone: 'today', label: 'May contain gluten' });
    expect(glutenLook('may_contain', true)).toEqual({ tone: 'expired', label: 'Not safe: may contain gluten' });
    expect(glutenLook(null, false).label).toBe('Checking gluten…');
    expect(isGlutenRisk('may_contain', false)).toBe(false);
    expect(isGlutenRisk('may_contain', true)).toBe(true);
    expect(isGlutenRisk('contains', false)).toBe(true);
  });
});

it('leaves gluten-free items unlabeled unless asked', () => {
  const { rerender } = render(withUser({ celiac_mode: true }, <GlutenBadge status="gluten_free" />));
  expect(screen.queryByText(/Gluten-free/)).toBeNull();
  rerender(withUser({ celiac_mode: true }, <GlutenBadge status="gluten_free" showSafe />));
  expect(screen.getByText('🌾 Gluten-free')).toBeInTheDocument();
});
