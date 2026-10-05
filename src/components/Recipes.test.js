import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import axios from 'axios';
import Recipes from './Recipes';
import { GlobalContext } from '../context/GlobalState';
import { AuthContext } from '../context/AuthContext';
import { todayString, addDays } from '../utils/dates';

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

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
    addShoppingItem: jest.fn().mockResolvedValue(true),
    planMeal: jest.fn().mockResolvedValue(true),
    ...overrides
  };
  const view = render(
    <AuthContext.Provider value={{ user: { id: 7, name: 'Alice Smith' }, loading: false }}>
      <GlobalContext.Provider value={value}><Recipes /></GlobalContext.Provider>
    </AuthContext.Provider>
  );
  return { ...value, view };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  axios.get.mockResolvedValue({ data: { limit: 20, remaining: 20 } });
});

it('searches with the chosen ingredients and shows what you have and need', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19, cached: false } });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  const card = await screen.findByRole('article', { name: 'Lemony chicken and spinach' });
  expect(axios.post).toHaveBeenCalledWith('/api/recipes/suggest', { dish: '', ingredients: ['chicken'], local_date: todayString() });
  expect(within(card).getByText('⏱ 25 min')).toBeInTheDocument();
  expect(within(card).getByText('Missing 2')).toBeInTheDocument();
  const list = within(card).getByRole('list', { name: /Ingredients for/ });
  expect(within(list).getAllByText(/^(Have|Need):$/).map((el) => el.textContent.trim())).toEqual(['Have:', 'Need:', 'Need:']);
  expect(screen.getByText(/^19 searches left today · resets in \d+(h \d+)?m$/)).toBeInTheDocument();
  expect(screen.getByText(/Recipes come from published sources where possible/)).toBeInTheDocument();
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
  expect(screen.getByText(/^0 searches left today/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Find recipes' })).toBeDisabled();
});

it('shows a friendly message when the service is down', async () => {
  axios.post.mockRejectedValue(new Error('Network Error'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Recipe ideas are unavailable right now');
});

it('shows how many searches are left before searching', async () => {
  axios.get.mockResolvedValue({ data: { limit: 20, remaining: 12 } });
  setup();
  expect(await screen.findByText(/^12 searches left today/)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(`/api/recipes/usage?local_date=${todayString()}`);
});

it('keeps earlier searches below the newest one, and after a reload', async () => {
  axios.post
    .mockResolvedValueOnce({ data: { recipes: [recipe], remaining: 19 } })
    .mockResolvedValueOnce({ data: { recipes: [{ ...recipe, id: 'r2', title: 'Shrimp pasta' }], remaining: 18 } });
  const first = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  await screen.findByRole('article', { name: 'Lemony chicken and spinach' });
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  await screen.findByRole('article', { name: 'Shrimp pasta' });
  expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Shrimp pasta', 'Lemony chicken and spinach']);

  first.view.unmount();
  setup();
  expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Shrimp pasta', 'Lemony chicken and spinach']);
  fireEvent.click(screen.getByRole('button', { name: 'Clear ideas' }));
  expect(screen.queryAllByRole('article')).toEqual([]);
});

it('adds a recipe to the calendar, defaulting to tomorrow', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19 } });
  const { planMeal } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  fireEvent.click(await screen.findByRole('button', { name: '📅 Add to calendar' }));
  const form = screen.getByRole('form', { name: 'Plan Lemony chicken and spinach' });
  expect(within(form).getByLabelText('Day')).toHaveValue(addDays(1));
  fireEvent.submit(form);
  expect(await screen.findByRole('button', { name: 'Add to another day' })).toBeInTheDocument();
  expect(planMeal).toHaveBeenCalledWith(recipe, addDays(1));
});

it('searches for a dish by name', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [{ ...recipe, title: 'Classic ratatouille' }], remaining: 19 } });
  setup({ searchIngredients: [] });
  fireEvent.change(screen.getByLabelText(/What do you want to make/), { target: { value: 'Ratatouille' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  await screen.findByRole('article', { name: 'Classic ratatouille' });
  expect(axios.post).toHaveBeenCalledWith('/api/recipes/suggest', { dish: 'Ratatouille', ingredients: [], local_date: todayString() });
  expect(screen.getByRole('heading', { name: /^Ratatouille · / })).toBeInTheDocument();
});

it('includes an ingredient that was typed but not added yet', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19 } });
  const { addSearchIngredient } = setup({ searchIngredients: [] });
  fireEvent.change(screen.getByLabelText('Add an ingredient'), { target: { value: 'Eggplant' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  await screen.findByRole('article', { name: 'Lemony chicken and spinach' });
  expect(axios.post).toHaveBeenCalledWith('/api/recipes/suggest', { dish: '', ingredients: ['eggplant'], local_date: todayString() });
  expect(addSearchIngredient).toHaveBeenCalledWith(expect.objectContaining({ value: 'eggplant' }));
});

it('pressing Enter adds any typed ingredient', () => {
  const { addSearchIngredient } = setup({ searchIngredients: [] });
  const box = screen.getByLabelText('Add an ingredient');
  fireEvent.change(box, { target: { value: 'Za\'atar' } });
  fireEvent.submit(box.closest('form'));
  expect(addSearchIngredient).toHaveBeenCalledWith(expect.objectContaining({ value: "za'atar" }));
  expect(box).toHaveValue('');
});

it('adds any single ingredient to the shopping list, even one you have', async () => {
  axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19 } });
  const { addShoppingItem } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add chicken thighs to the shopping list' }));
  expect(addShoppingItem).toHaveBeenCalledWith({ name: 'chicken thighs', note: '1 lb', source: 'recipe' }, { notify: true });
  expect(await screen.findByLabelText('chicken thighs is on your shopping list')).toBeInTheDocument();
});

describe('recipe pop-up', () => {
  async function openFirst() {
    axios.post.mockResolvedValue({ data: { recipes: [recipe], remaining: 19 } });
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
    await screen.findByRole('article', { name: 'Lemony chicken and spinach' });
    return ctx;
  }

  it('opens from the title with the full recipe and numbered steps', async () => {
    await openFirst();
    fireEvent.click(screen.getByRole('button', { name: 'Lemony chicken and spinach' }));
    const dialog = screen.getByRole('dialog', { name: 'Lemony chicken and spinach' });
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(expect.arrayContaining(['Sear the chicken.', 'Finish with parmesan.']));
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('opens when the card itself is clicked, but not from its buttons', async () => {
    await openFirst();
    fireEvent.click(screen.getByRole('button', { name: 'Add chicken thighs to the shopping list' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('A quick skillet dinner.'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes with Esc, the close button or a click outside, and returns focus', async () => {
    await openFirst();
    const opener = screen.getByRole('button', { name: 'View recipe →' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();

    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(opener);
    fireEvent.mouseDown(document.querySelector('.fb-modal-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adding from the pop-up shows on the card too', async () => {
    const { addShoppingItem, planMeal } = await openFirst();
    fireEvent.click(screen.getByRole('button', { name: 'View recipe →' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add parmesan to the shopping list' }));
    await waitFor(() => expect(addShoppingItem).toHaveBeenCalled());
    fireEvent.click(within(dialog).getByRole('button', { name: '📅 Add to calendar' }));
    fireEvent.submit(within(dialog).getByRole('form', { name: 'Plan Lemony chicken and spinach' }));
    await waitFor(() => expect(planMeal).toHaveBeenCalled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByLabelText('parmesan is on your shopping list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to another day' })).toBeInTheDocument();
  });
});

describe('recipe sources', () => {
  const spoonRecipe = { ...recipe, provider: 'spoonacular', id: '715415', title: 'Classic Ratatouille', image: 'https://img/715415.jpg',
    source_name: 'Serious Eats', source_url: 'https://www.seriouseats.com/ratatouille' };

  it('links to the source and credits Spoonacular', async () => {
    axios.post.mockResolvedValue({ data: { recipes: [spoonRecipe], provider: 'spoonacular', remaining: 19 } });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
    const card = await screen.findByRole('article', { name: 'Classic Ratatouille' });
    expect(within(card).getByRole('link', { name: 'From Serious Eats ↗' })).toHaveAttribute('href', 'https://www.seriouseats.com/ratatouille');
    expect(screen.getByRole('link', { name: 'powered by spoonacular' })).toHaveAttribute('href', 'https://spoonacular.com/food-api');
  });

  it('labels AI-written recipes', async () => {
    axios.post.mockResolvedValue({ data: { recipes: [{ ...recipe, provider: 'ai' }], provider: 'ai', remaining: 19 } });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
    const card = await screen.findByRole('article', { name: 'Lemony chicken and spinach' });
    expect(within(card).getByText('AI-suggested recipe')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'powered by spoonacular' })).toBeNull();
  });

  it('after a reload, Spoonacular recipes load their details again when opened', async () => {
    axios.post.mockResolvedValue({ data: { recipes: [spoonRecipe], provider: 'spoonacular', remaining: 19 } });
    const first = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Find recipes' }));
    await screen.findByRole('article', { name: 'Classic Ratatouille' });
    first.view.unmount();

    axios.get.mockImplementation((url) => url.startsWith('/api/recipes/details/')
      ? Promise.resolve({ data: spoonRecipe })
      : Promise.resolve({ data: { limit: 20, remaining: 19 } }));
    setup();
    const card = screen.getByRole('article', { name: 'Classic Ratatouille' });
    expect(within(card).queryByRole('list')).toBeNull(); // only the title, image and link were kept
    fireEvent.click(within(card).getByRole('button', { name: 'Show ingredients and steps →' }));
    const dialog = await screen.findByRole('dialog', { name: 'Classic Ratatouille' });
    expect(axios.get).toHaveBeenCalledWith(`/api/recipes/details/spoonacular/715415?local_date=${todayString()}`);
    expect(within(dialog).getByRole('link', { name: 'View the full recipe on Serious Eats ↗' })).toBeInTheDocument();
  });
});
