import { buildFallbackRecipes } from './recipeFallback';

describe('buildFallbackRecipes', () => {
  it('returns sample recipes even when no ingredients are provided', () => {
    const recipes = buildFallbackRecipes([]);

    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0].title).toContain('Recipe');
  });

  it('includes the provided ingredient names in the generated suggestions', () => {
    const recipes = buildFallbackRecipes(['tomato', 'basil']);

    expect(recipes[0].title).toContain('tomato');
    expect(recipes[0].missingIngredients[0].name).toContain('basil');
  });
});
