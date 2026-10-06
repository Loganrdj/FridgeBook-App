// How gluten results look, matching the website (src/components/GlutenCheck.js)
import { colors } from './theme';

export const TONES = {
  expired: { bg: '#FFE3DA', fg: '#A8371B' },
  today: { bg: '#FFE8C2', fg: '#8A5300' },
  soon: { bg: '#FFF3C4', fg: '#6E5200' },
  ok: { bg: colors.mintTint, fg: '#1E6E5E' },
  none: { bg: '#EFEFEF', fg: '#555555' }
};

const VERDICTS = {
  likely_gluten: { tone: 'expired', label: 'Likely gluten', order: 0 },
  unknown: { tone: 'expired', label: 'Unknown: assume gluten', order: 1 },
  ask: { tone: 'today', label: 'Ask first', order: 2 },
  low_risk: { tone: 'ok', label: 'Low ingredient risk', order: 3 }
};

// In Strict mode "ask first" counts as not safe
export function verdictLook(verdict, strict) {
  if (verdict === 'ask' && strict) return { tone: 'expired', label: 'Not safe in Strict mode', order: 2 };
  return VERDICTS[verdict] || VERDICTS.unknown;
}

const INGREDIENT = {
  contains: { tone: 'expired', label: 'Contains gluten' },
  may_contain: { tone: 'today', label: 'May contain gluten' },
  gluten_free: { tone: 'ok', label: 'Gluten-free' },
  unknown: { tone: 'none', label: 'Gluten unknown' }
};

export function ingredientLook(status, strict) {
  if (!status) return { tone: 'none', label: 'Checking gluten…' };
  if (status === 'may_contain' && strict) return { tone: 'expired', label: 'Not safe: may contain gluten' };
  return INGREDIENT[status] || INGREDIENT.unknown;
}

export const isGlutenRisk = (status, strict) => status === 'contains' || (strict && status === 'may_contain');

export const CROSS_CONTACT = {
  lower: { tone: 'ok', label: 'Lower' },
  moderate: { tone: 'soon', label: 'Moderate' },
  high: { tone: 'today', label: 'High' },
  very_high: { tone: 'expired', label: 'Very high' }
};

// Safest-looking dishes first, as on the website
export function sortDishes(dishes) {
  return dishes.slice().sort((a, b) => (VERDICTS[b.verdict] || VERDICTS.unknown).order - (VERDICTS[a.verdict] || VERDICTS.unknown).order);
}

export const scoreColor = (n) => (n >= 70 ? colors.mintDark : n >= 40 ? '#B07400' : '#C2421F');

export const DISCLAIMER = 'Guidance only, not medical advice. We can’t see what the kitchen actually uses, so always tell staff you have celiac disease and ask how your food is made.';
