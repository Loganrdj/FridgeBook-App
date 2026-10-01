import React from 'react';

// FridgeBook mark + wordmark: a fridge whose open door is a book page
// (same artwork as public/favicon.svg)
function Logo({ className = '' }) {
  return (
    <span className={`fb-logo ${className}`}>
      <svg className="fb-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="16" fill="#2BB39A"/>
        <rect x="30" y="9" width="23" height="46" rx="5" fill="#F7FBFA"/>
        <rect x="47" y="13" width="2.6" height="6" rx="1.3" fill="#12332E"/>
        <rect x="32.5" y="24.5" width="18" height="28" rx="2.5" fill="#E3F6F1"/>
        <line x1="34" y1="33" x2="49" y2="33" stroke="#2BB39A" strokeWidth="2" strokeLinecap="round"/>
        <line x1="34" y1="42.5" x2="49" y2="42.5" stroke="#2BB39A" strokeWidth="2" strokeLinecap="round"/>
        <rect x="36" y="26.5" width="3.6" height="6" rx="1.2" fill="#12332E" opacity="0.85"/>
        <circle cx="45" cy="30" r="2.8" fill="#FF7A59"/>
        <circle cx="40" cy="39.5" r="2.6" fill="#FFD66B"/>
        <path d="M30.5 24 C25 21.5 18.5 22 12 25 L12 54 C18.5 51 25 50.5 30.5 53 Z" fill="#FFF8EC"/>
        <g stroke="#12332E" strokeWidth="2" strokeLinecap="round" opacity="0.5">
          <line x1="16" y1="31" x2="27" y2="30"/>
          <line x1="16" y1="37" x2="27" y2="36"/>
          <line x1="16" y1="43" x2="23" y2="42.5"/>
        </g>
        <line x1="30.5" y1="24" x2="30.5" y2="53" stroke="#12332E" strokeWidth="1.4" opacity="0.4"/>
      </svg>
      <span className="fb-logo-word">Fridge<strong>Book</strong></span>
    </span>
  );
}

export default Logo;
