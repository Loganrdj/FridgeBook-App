import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddItemForm from './AddItemForm';
import { addDays } from '../utils/dates';

it('quick dates fill the expiration', () => {
  render(<AddItemForm addIngredient={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '1 week' }));
  expect(screen.getByLabelText('Expires')).toHaveValue(addDays(7));
});

it('saves a trimmed item, then clears the form but keeps the location', async () => {
  const addIngredient = jest.fn().mockResolvedValue(true);
  render(<AddItemForm addIngredient={addIngredient} />);
  fireEvent.click(screen.getByLabelText('Pantry'));
  fireEvent.change(screen.getByLabelText('Item'), { target: { value: ' Rice ' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Expires'), { target: { value: '2027-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to kitchen' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Added Rice to your pantry.');
  expect(addIngredient).toHaveBeenCalledWith({ name: 'Rice', quantity: 2, date_expire: '2027-01-01', fridge_bool: false });
  expect(screen.getByLabelText('Item')).toHaveValue('');
  expect(screen.getByLabelText('Pantry')).toBeChecked();
});

it('keeps what was typed when saving fails', async () => {
  const addIngredient = jest.fn().mockResolvedValue(false);
  render(<AddItemForm addIngredient={addIngredient} />);
  fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'Milk' } });
  fireEvent.change(screen.getByLabelText('Expires'), { target: { value: '2026-10-05' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to kitchen' }));
  await waitFor(() => expect(addIngredient).toHaveBeenCalled());
  expect(screen.getByLabelText('Item')).toHaveValue('Milk');
  expect(screen.queryByRole('status')).toBeNull();
});
