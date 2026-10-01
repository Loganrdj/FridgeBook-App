import React from 'react';

// FridgeBook mark + wordmark: a smiling fridge whose open door is a book page
// (same artwork as public/favicon.svg)
function Logo({ className = '' }) {
  return (
    <span className={`fb-logo ${className}`}>
      <svg className="fb-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="16" fill="#2BB39A"/>
        <rect x="13" y="54" width="4" height="3.5" rx="1.5" fill="#12332E" opacity="0.55"/>
        <rect x="29" y="54" width="4" height="3.5" rx="1.5" fill="#12332E" opacity="0.55"/>
        <rect x="10" y="8" width="25" height="47" rx="8" fill="#F7FBFA"/>
        <rect x="13.5" y="13" width="2.6" height="5.5" rx="1.3" fill="#12332E"/>
        <circle cx="21" cy="16.5" r="1.4" fill="#12332E"/>
        <circle cx="28" cy="16.5" r="1.4" fill="#12332E"/>
        <path d="M22.6 19.2 Q24.5 21 26.4 19.2" fill="none" stroke="#12332E" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="19" cy="19.6" r="1.5" fill="#FF7A59" opacity="0.45"/>
        <circle cx="30" cy="19.6" r="1.5" fill="#FF7A59" opacity="0.45"/>
        <rect x="12.5" y="24.5" width="20" height="28" rx="4" fill="#E3F6F1"/>
        <line x1="14.5" y1="33.5" x2="30.5" y2="33.5" stroke="#2BB39A" strokeWidth="2" strokeLinecap="round"/>
        <line x1="14.5" y1="43" x2="30.5" y2="43" stroke="#2BB39A" strokeWidth="2" strokeLinecap="round"/>
        <rect x="16" y="26.5" width="4" height="6" rx="2" fill="#12332E" opacity="0.85"/>
        <circle cx="26" cy="30" r="3" fill="#FF7A59"/>
        <circle cx="25" cy="29" r="0.9" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="20" cy="39.7" r="2.8" fill="#FFD66B"/>
        <circle cx="27.5" cy="40.2" r="2.3" fill="#7CCF8A"/>
        <path d="M34.5 24 C40 21 46.5 21.5 53 25 L53 52 C46.5 49 40 48.5 34.5 52 Z" fill="#FFF8EC"/>
        <g stroke="#12332E" strokeWidth="2" strokeLinecap="round" opacity="0.45">
          <line x1="38.5" y1="30" x2="49" y2="31"/>
          <line x1="38.5" y1="36" x2="49" y2="37"/>
        </g>
        <path d="M43.6 41.6 c-1.3-1.6-3.6-0.6-2.9 1.3 0.4 1.1 1.7 2 2.9 2.8 1.2-0.8 2.5-1.7 2.9-2.8 0.7-1.9-1.6-2.9-2.9-1.3z" fill="#FF7A59"/>
        <line x1="34.5" y1="24" x2="34.5" y2="52" stroke="#12332E" strokeWidth="1.4" opacity="0.35"/>
      </svg>
      <span className="fb-logo-word">Fridge<strong>Book</strong></span>
    </span>
  );
}

export default Logo;
