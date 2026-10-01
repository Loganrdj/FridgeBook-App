import AppReducer from './AppReducer';

const item = (id, date_expire, extra = {}) => ({ id, name: `item ${id}`, quantity: 1, date_expire, fridge_bool: true, ...extra });
const base = { ingredients: [], ingredientsLoaded: false, error: 'old error', searchIngredients: [] };

describe('AppReducer', () => {
  it('loads ingredients sorted by expiration date', () => {
    const state = AppReducer(base, { type: 'SET_INGREDIENTS', payload: [item(1, '2026-10-09'), item(2, '2026-10-02')] });
    expect(state.ingredients.map((i) => i.id)).toEqual([2, 1]);
    expect(state.ingredientsLoaded).toBe(true);
  });

  it('keeps the list sorted when adding and updating', () => {
    let state = AppReducer(base, { type: 'SET_INGREDIENTS', payload: [item(1, '2026-10-05')] });
    state = AppReducer(state, { type: 'ADD_INGREDIENT', payload: item(2, '2026-10-01') });
    expect(state.ingredients.map((i) => i.id)).toEqual([2, 1]);
    expect(state.error).toBeNull();

    state = AppReducer(state, { type: 'UPDATE_INGREDIENT', payload: item(2, '2026-10-30', { name: 'renamed' }) });
    expect(state.ingredients.map((i) => i.id)).toEqual([1, 2]);
    expect(state.ingredients[1].name).toBe('renamed');
  });

  it('deletes by id', () => {
    const state = AppReducer({ ...base, ingredients: [item(1, '2026-10-05'), item(2, '2026-10-06')] }, { type: 'DELETE_INGREDIENT', payload: 1 });
    expect(state.ingredients.map((i) => i.id)).toEqual([2]);
  });

  it('keeps recipe search terms separate from the kitchen', () => {
    let state = AppReducer(base, { type: 'ADD_SEARCH_INGREDIENT', payload: { id: 7, value: 'garlic' } });
    expect(state.searchIngredients).toEqual([{ id: 7, value: 'garlic' }]);
    expect(state.ingredients).toEqual([]);
    state = AppReducer(state, { type: 'DELETE_SEARCH_INGREDIENT', payload: 7 });
    expect(state.searchIngredients).toEqual([]);
  });
});
