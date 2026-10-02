import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import axios from 'axios';
import Recipes from './Recipes';
import { GlobalContext } from '../context/GlobalState';

jest.mock('axios', () => ({ post: jest.fn() }));

const recipe = {
  id: 'r1',
  title: 'Lemony chicken and spinach',
  description: 'A quick skillet dinner.',
  minutes: 25,
  servings: 2,
  ingredients: [
    { name: 'chicken thighs', amount: '1 lb', have: true },
    { name: 'parmesan', amount: '1/4 cup', have: false },
    { name: 'lemon', amount: '1', have: false }
  ],
  steps: ['Sear the chicken.', 'Finish with parmesan.'],
  missing_count: 2
};

function setup(overrides = {}) {
  const value = {
    ingredients: [],
    searchIngredients: [{ id: 1, value: 'chicken' }],
    addSearchIngredient: jest.fn(),
    deleteSearchIngredient: jest.fn(),
    addShoppingItems: jest.fn().mockResolvedValue(true),
    ...overrides
  };
  render(<GlobalContext.Provider value={value}><Recipes /></GlobalContext.Provider>);
  return value;
}

beforeEach(() => jest.clearAllMocks());

it('searches with the chosen ingredients and shows what you have and need', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19, cached: false } });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  const card = await screen.findByRole('article', { name: 'Lemony chicken and spinach' });
  expect(axios.post).toHaveBeenCalledWith('/api/recipes/suggest', { ingredients: ['chicken'] });
  expect(within(card).getByText('⏱ 25 min')).toBeInTheDocument();
  expect(within(card).getByText('Missing 2')).toBeInTheDocument();
  const list = within(card).getByRole('list', { name: /Ingredients for/ });
  expect(within(list).getAllByText(/^(Have|Need):$/).map((el) => el.textContent.trim())).toEqual(['Have:', 'Need:', 'Need:']);
  expect(screen.getByText('19 searches left today')).toBeInTheDocument();
  expect(screen.getByText(/AI-generated with Gemini/)).toBeInTheDocument();
});

it('with nothing chosen, offers to search from the kitchen', () => {
  setup({ searchIngredients: [] });
  expect(screen.getByRole('button', { name: 'Find recipes from my kitchen' })).toBeInTheDocument();
});

it('adds only the missing ingredients to the shopping list', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19 } });
  const { addShoppingItems } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add 2 missing to shopping list' }));
  expect(addShoppingItems).toHaveBeenCalledWith([
    { name: 'parmesan', note: '1/4 cup', source: 'recipe' },
    { name: 'lemon', note: '1', source: 'recipe' }
  ]);
  expect(await screen.findByRole('button', { name: 'Added to shopping list' })).toBeDisabled();
});

it('explains the daily limit', async () => {
  axios.post.mockRejectedValue({ response: { status: 429, data: { error: "You've used all 20 recipe searches for today. They reset tomorrow.", remaining: 0 } } });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('used all 20 recipe searches');
  expect(screen.getByText('0 searches left today')).toBeInTheDocument();
});

it('shows a friendly message when the service is down', async () => {
  axios.post.mockRejectedValue(new Error('Network Error'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Recipe ideas are unavailable right now');
});
