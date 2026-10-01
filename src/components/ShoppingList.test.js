import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ShoppingList from './ShoppingList';
import { GlobalContext } from '../context/GlobalState';
import { addDays } from '../utils/dates';

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
