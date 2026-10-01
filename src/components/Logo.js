import React from 'react';

// FridgeBook mark + wordmark (same artwork as public/favicon.svg)
function Logo({ className = '' }) {
  return (
    <span className={`fb-logo ${className}`}>
      <svg className="fb-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="16" fill="#2BB39A" />
        <rect x="18" y="10" width="28" height="44" rx="7" fill="#F7FBFA" />
        <line x1="18" y1="25" x2="46" y2="25" stroke="#2BB39A" strokeWidth="3" />
        <rect x="38" y="15" width="3.5" height="6" rx="1.75" fill="#12332E" />
        <rect x="38" y="30" width="3.5" height="11" rx="1.75" fill="#12332E" />
        <circle cx="25" cy="45" r="3.5" fill="#FF7A59" />
      </svg>
      <span className="fb-logo-word">Fridge<strong>Book</strong></span>
    </span>
  );
}

export default Logo;
