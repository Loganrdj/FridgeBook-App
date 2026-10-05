import React from 'react';
import { useAuth } from '../context/AuthContext';

const LABELS = {
  contains: { tone: 'expired', label: 'Contains gluten' },
  may_contain: { tone: 'today', label: 'May contain gluten' },
  gluten_free: { tone: 'ok', label: 'Gluten-free' },
  unknown: { tone: 'none', label: 'Gluten unknown' }
};

// Gluten label for Celiac Mode. In Strict mode "may contain" counts as unsafe.
export function glutenLook(status, strict) {
  if (!status) return { tone: 'none', label: 'Checking gluten…' };
  if (status === 'may_contain' && strict) return { tone: 'expired', label: 'Not safe: may contain gluten' };
  return LABELS[status] || LABELS.unknown;
}

// Whether an item should be flagged as a problem
export function isGlutenRisk(status, strict) {
  return status === 'contains' || (strict && status === 'may_contain');
}

// Shows only what needs attention by default; gluten-free items stay unlabeled
function GlutenBadge({ status, reason, showSafe = false }) {
  const { user } = useAuth();
  if (!user || !user.celiac_mode) return null;
  if (status === 'gluten_free' && !showSafe) return null;
  const { tone, label } = glutenLook(status, user.celiac_strict);
  return <span className={`fb-badge fb-badge-${tone} fb-gluten-badge`} title={reason || undefined}>🌾 {label}</span>;
}

export default GlutenBadge;
