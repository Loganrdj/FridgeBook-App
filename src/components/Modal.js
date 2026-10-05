import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

// Accessible pop-up: focus moves in and stays in, Esc or a click outside closes
// it, and focus returns to whatever opened it
function Modal({ labelledBy, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    if (closeRef.current) closeRef.current.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (opener && opener.focus) opener.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fb-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="fb-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={dialogRef}>
        <button type="button" className="fb-modal-close" aria-label="Close" ref={closeRef} onClick={onClose}>×</button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
