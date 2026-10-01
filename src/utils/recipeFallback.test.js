import { buildFallbackRecipes } from './recipeFallback';

describe('buildFallbackRecipes', () => {
  it('returns sample recipes even when no ingredients are provided', () => {
    const recipes = buildFallbackRecipes([]);

    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0].title).toContain('eggs');
  });

  it('builds titles and missing ingredients from the provided names', () => {
    const recipes = buildFallbackRecipes(['tomato', 'basil']);

    expect(recipes[0].title).toContain('tomato');
    expect(recipes[0].missedIngredients.map((i) => i.name)).toEqual(['basil']);
  });
});
