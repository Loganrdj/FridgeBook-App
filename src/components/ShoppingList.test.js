import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ShoppingList from './ShoppingList';
import { GlobalContext } from '../context/GlobalState';
import { addDays, todayString } from '../utils/dates';
import axios from 'axios';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: [] });
});

const bananas = { id: 1, name: 'Bananas', quantity: 6, note: 'ripe', checked: false, source: 'manual' };
const milk = { id: 2, name: 'Milk', quantity: 1, note: null, checked: true, source: 'kitchen' };
const rice = { id: 3, name: 'Rice', quantity: 2, note: null, checked: true, source: 'manual' };

function setup(shopping = [bananas, milk, rice], overrides = {}) {
  const actions = {
    addShoppingItem: jest.fn().mockResolvedValue(true),
    updateShoppingItem: jest.fn().mockResolvedValue(true),
    deleteShoppingItem: jest.fn(),
    clearCheckedShopping: jest.fn(),
    moveShoppingToKitchen: jest.fn().mockResolvedValue(true),
    addShoppingItems: jest.fn().mockResolvedValue(true),
    ...overrides
  };
  render(
    <GlobalContext.Provider value={{ shopping, shoppingLoaded: true, ...actions }}>
      <ShoppingList />
    </GlobalContext.Provider>
  );
  return actions;
}

it('splits the list into to-buy and in-the-cart', () => {
  setup();
  const toBuy = screen.getByRole('region', { name: 'To buy' });
  expect(within(toBuy).getByRole('checkbox', { name: /Bananas/ })).not.toBeChecked();
  expect(within(toBuy).getByText('ripe')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'In the cart (2)' })).toBeInTheDocument();
});

it('checks items off and changes quantities', () => {
  const { updateShoppingItem } = setup();
  fireEvent.click(screen.getByRole('checkbox', { name: /Bananas/ }));
  fireEvent.click(screen.getByRole('button', { name: 'One more Bananas' }));
  fireEvent.click(screen.getByRole('button', { name: 'One less Bananas' }));
  expect(updateShoppingItem.mock.calls).toEqual([[1, { checked: true }], [1, { quantity: 7 }], [1, { quantity: 5 }]]);
});

it("can't go below 1 with the minus button", () => {
  setup();
  expect(screen.getByRole('button', { name: 'One less Milk' })).toBeDisabled();
});

it('adds an item and clears the form', async () => {
  const { addShoppingItem } = setup([]);
  expect(screen.getByText('Your list is empty.')).toBeInTheDocument();
  const form = screen.getByRole('form', { name: 'Add to list' });
  fireEvent.change(within(form).getByLabelText('Item'), { target: { value: ' Coffee ' } });
  fireEvent.change(within(form).getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.submit(form);
  await waitFor(() => expect(within(form).getByLabelText('Item')).toHaveValue(''));
  expect(addShoppingItem).toHaveBeenCalledWith({ name: 'Coffee', quantity: 2, note: null });
});

it('clears checked items', () => {
  const { clearCheckedShopping } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(clearCheckedShopping).toHaveBeenCalled();
});

it('puts away checked items with a date and place for each', async () => {
  const { moveShoppingToKitchen } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Move to kitchen' }));
  const putAway = screen.getByRole('form', { name: 'Put away' });

  fireEvent.click(within(putAway).getByRole('group', { name: 'Quick expiration dates for Milk' }).querySelector('button'));
  fireEvent.change(within(putAway).getAllByLabelText('Expires')[1], { target: { value: '2027-06-01' } });
  fireEvent.click(within(within(putAway).getByRole('radiogroup', { name: 'Where Rice goes' })).getByLabelText('Pantry'));
  fireEvent.change(within(putAway).getAllByLabelText('Quantity')[1], { target: { value: '3' } });
  fireEvent.click(within(putAway).getByRole('button', { name: 'Add 2 to kitchen' }));

  await waitFor(() => expect(screen.queryByRole('form', { name: 'Put away' })).toBeNull());
  expect(moveShoppingToKitchen).toHaveBeenCalledWith([
    { id: 2, quantity: 1, date_expire: addDays(3), fridge_bool: true },
    { id: 3, quantity: 3, date_expire: '2027-06-01', fridge_bool: false }
  ]);
});

it('keeps the put-away form open if moving fails', async () => {
  const { moveShoppingToKitchen } = setup(undefined, { moveShoppingToKitchen: jest.fn().mockResolvedValue(false) });
  fireEvent.click(screen.getByRole('button', { name: 'Move to kitchen' }));
  const putAway = screen.getByRole('form', { name: 'Put away' });
  within(putAway).getAllByLabelText('Expires').forEach((input) => fireEvent.change(input, { target: { value: '2026-12-01' } }));
  fireEvent.submit(putAway);
  await waitFor(() => expect(moveShoppingToKitchen).toHaveBeenCalled());
  expect(screen.getByRole('form', { name: 'Put away' })).toBeInTheDocument();
});

describe('for planned meals', () => {
  const needs = [
    { meal_id: 4, meal_title: 'Shrimp pasta', date: addDays(2), name: 'shrimp', amount: '1 lb', reason: 'missing', expires: null, on_list: false },
    { meal_id: 4, meal_title: 'Shrimp pasta', date: addDays(2), name: 'parsley', amount: null, reason: 'expires_before', expires: addDays(1), on_list: false },
    { meal_id: 4, meal_title: 'Shrimp pasta', date: addDays(2), name: 'pasta', amount: '8 oz', reason: 'missing', expires: null, on_list: true }
  ];

  it('lists what planned meals need, separately from the list', async () => {
    axios.get.mockResolvedValue({ data: needs });
    setup();
    const section = await screen.findByRole('region', { name: 'For planned meals' });
    expect(axios.get).toHaveBeenCalledWith(`/api/meals/needs?local_date=${todayString()}`);
    const group = within(section).getByRole('group', { name: /^Shrimp pasta, / });
    expect(within(group).getAllByText('Not in your kitchen')).toHaveLength(2);
    expect(within(group).getByText(/^Yours expires /)).toBeInTheDocument();
    expect(within(group).getByText('On your list ✓')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Add all (2)' })).toBeInTheDocument();
  });

  it('adds one, adds all, or dismisses with "I have it"', async () => {
    axios.get.mockResolvedValue({ data: needs });
    axios.post.mockResolvedValue({ data: {} });
    const { addShoppingItem, addShoppingItems } = setup();
    const section = await screen.findByRole('region', { name: 'For planned meals' });

    fireEvent.click(within(section).getByRole('button', { name: 'Add shrimp to the shopping list' }));
    await waitFor(() => expect(addShoppingItem).toHaveBeenCalledWith({ name: 'shrimp', note: '1 lb · for Shrimp pasta', source: 'meal' }, { notify: true }));

    await waitFor(() => expect(within(section).getByRole('button', { name: 'Add all (2)' })).not.toBeDisabled());
    fireEvent.click(within(section).getByRole('button', { name: 'Add all (2)' }));
    await waitFor(() => expect(addShoppingItems).toHaveBeenCalledWith([
      { name: 'shrimp', note: '1 lb · for Shrimp pasta', source: 'meal' },
      { name: 'parsley', note: 'for Shrimp pasta', source: 'meal' }
    ]));

    await waitFor(() => expect(within(section).getByRole('button', { name: 'I have parsley' })).not.toBeDisabled());
    fireEvent.click(within(section).getByRole('button', { name: 'I have parsley' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/meals/4/dismiss', { name: 'parsley' }));
  });

  it('stays hidden when nothing is needed', async () => {
    setup();
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'For planned meals' })).toBeNull();
  });
});
