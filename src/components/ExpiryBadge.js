import React from 'react';
import { expiryStatus } from '../utils/dates';

function ExpiryBadge({ date }) {
    const { tone, label } = expiryStatus(date);
    return <span className={`fb-badge fb-badge-${tone}`}>{label}</span>;
}

export default ExpiryBadge;
