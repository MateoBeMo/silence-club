import React, { useEffect, useState, useRef } from "react";

export default function BookingModal({ booking, selected, customer, setCustomer, onConfirm, onCancel }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef(null); // 'confirm' | 'cancel' | null

  useEffect(() => {
    if (booking && selected) {
      // defer mounting to avoid synchronous setState inside effect
      setTimeout(() => {
        setMounted(true);
        // next tick to allow CSS transition
        requestAnimationFrame(() => setVisible(true));
      }, 0);
    }
  }, [booking, selected]);

  function handleCloseRequest(type) {
    // start exit animation, set pending action
    pendingRef.current = type;
    setVisible(false);
  }

  function onOverlayTransitionEnd(e) {
    // only respond to opacity transition on the overlay
    if (e.target !== e.currentTarget) return;
    if (visible) return; // opening finished
    const pending = pendingRef.current;
    pendingRef.current = null;
    setMounted(false);
    if (pending === "confirm") {
      if (typeof onConfirm === "function") onConfirm();
    } else if (pending === "cancel") {
      if (typeof onCancel === "function") onCancel();
    }
  }

  if (!mounted || !selected) return null;

  return (
    <div className={`overlay ${visible ? "visible" : ""}`} onTransitionEnd={onOverlayTransitionEnd}>
      <div className={`modal ${visible ? "visible" : ""}`} role="dialog" aria-modal="true">
        <h3>Book {selected.label}</h3>
        <label>
          Name
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button onClick={() => handleCloseRequest("confirm")} className="btn-primary">Confirm</button>
          <button onClick={() => handleCloseRequest("cancel")} className="btn-muted">Cancel</button>
        </div>
      </div>
    </div>
  );
}
