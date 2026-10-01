import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InventoryItem from './InventoryItem';
import { addDays } from '../utils/dates';

const milk = { id: 7, name: 'Milk', quantity: 2, date_start: addDays(0), date_expire: addDays(1), fridge_bool: true };

function setup(overrides = {}) {
  const actions = {
    updateIngredient: jest.fn().mockResolvedValue(true),
    changeQuantity: jest.fn().mockResolvedValue(true),
    deleteIngredient: jest.fn(),
    ...overrides
  };
  render(<ul><InventoryItem item={milk} {...actions} /></ul>);
  return actions;
}

it('shows the name, quantity and an expiry badge', () => {
  setup();
  expect(screen.getByText('Milk')).toBeInTheDocument();
  expect(screen.getByLabelText('Quantity 2')).toBeInTheDocument();
  expect(screen.getByText('Tomorrow')).toBeInTheDocument();
});

it('−/+ change the quantity by one', () => {
  const { changeQuantity } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'One less Milk' }));
  fireEvent.click(screen.getByRole('button', { name: 'One more Milk' }));
  expect(changeQuantity.mock.calls).toEqual([[7, -1], [7, 1]]);
});

it('edits name, quantity, date and location, then closes', async () => {
  const { updateIngredient } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Milk' }));
  const form = screen.getByRole('form', { name: 'Edit Milk' });
  fireEvent.change(screen.getByLabelText('Item'), { target: { value: '  Oat milk ' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Expires'), { target: { value: '2026-12-01' } });
  fireEvent.click(screen.getByLabelText('Pantry'));
  fireEvent.submit(form);
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  expect(updateIngredient).toHaveBeenCalledWith(7, { name: 'Oat milk', quantity: 5, date_expire: '2026-12-01', fridge_bool: false });
});

it('stays in edit mode when saving fails', async () => {
  const { updateIngredient } = setup({ updateIngredient: jest.fn().mockResolvedValue(false) });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Milk' }));
  fireEvent.submit(screen.getByRole('form', { name: 'Edit Milk' }));
  await waitFor(() => expect(updateIngredient).toHaveBeenCalled());
  expect(screen.getByRole('form', { name: 'Edit Milk' })).toBeInTheDocument();
});

it('cancel leaves the item unchanged', () => {
  const { updateIngredient } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Milk' }));
  fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'Something else' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Milk')).toBeInTheDocument();
  expect(updateIngredient).not.toHaveBeenCalled();
});

it('asks before removing', () => {
  const confirm = jest.spyOn(window, 'confirm');
  const { deleteIngredient } = setup();
  confirm.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Milk' }));
  expect(deleteIngredient).not.toHaveBeenCalled();
  confirm.mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Milk' }));
  expect(deleteIngredient).toHaveBeenCalledWith(7);
  confirm.mockRestore();
});
