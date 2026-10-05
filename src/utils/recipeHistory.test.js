import { loadHistory, saveHistory, addBatch } from './recipeHistory';

const batch = (id, day) => ({ id, day, at: `${day}T12:00:00`, terms: [], recipes: [{ id: `r${id}`, title: `Recipe ${id}` }] });

beforeEach(() => localStorage.clear());

it('keeps only today\'s searches', () => {
  saveHistory(7, [batch(2, '2026-10-02'), batch(1, '2026-10-01')]);
  expect(loadHistory(7, '2026-10-02').map((b) => b.id)).toEqual([2]);
  expect(loadHistory(7, '2026-10-03')).toEqual([]);
});

it('keeps each account\'s history separate on a shared device', () => {
  saveHistory(1, [batch(1, '2026-10-02')]);
  saveHistory(2, [batch(2, '2026-10-02')]);
  expect(loadHistory(1, '2026-10-02').map((b) => b.id)).toEqual([1]);
  expect(loadHistory(2, '2026-10-02').map((b) => b.id)).toEqual([2]);
  expect(loadHistory(undefined, '2026-10-02')).toEqual([]);
});

it('puts the newest search first and keeps at most 10', () => {
  let batches = [];
  for (let i = 1; i <= 12; i++) batches = addBatch(batches, batch(i, '2026-10-02'));
  expect(batches.map((b) => b.id)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
});

it('survives corrupted storage', () => {
  localStorage.setItem('recipeHistory:7', '{not json');
  expect(loadHistory(7, '2026-10-02')).toEqual([]);
});

it('saves Spoonacular recipes as references only', () => {
  const full = { provider: 'spoonacular', id: '7', title: 'Ratatouille', image: 'https://img/7.jpg', source_name: 'Site', source_url: 'https://site/r',
    ingredients: [{ name: 'eggplant', amount: '1', have: false }], steps: ['Bake.'], minutes: 45 };
  const web = { provider: 'web', id: 'w1', title: 'Web one', ingredients: [{ name: 'x', amount: '1' }], steps: ['y'] };
  saveHistory(3, [{ id: 1, day: '2026-10-05', at: '', terms: [], recipes: [full, web] }]);
  const [batch] = loadHistory(3, '2026-10-05');
  expect(batch.recipes[0]).toEqual({ provider: 'spoonacular', id: '7', title: 'Ratatouille', image: 'https://img/7.jpg', source_name: 'Site', source_url: 'https://site/r' });
  expect(batch.recipes[1]).toEqual(web);
});
