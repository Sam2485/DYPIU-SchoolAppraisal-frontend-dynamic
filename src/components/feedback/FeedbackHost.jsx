import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { subscribeFeedback } from "./feedbackBus";
import "./feedback.css";

const TONE_ICON = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
};

const DEFAULT_DURATION = { success: 4500, info: 5000, warning: 7000, error: 9000 };
const MAX_VISIBLE_TOASTS = 4;

function ToastItem({ toast, onClose }) {
  const Icon = TONE_ICON[toast.tone] || Info;
  const duration = toast.duration ?? DEFAULT_DURATION[toast.tone] ?? 5000;
  const timerRef = useRef(null);
  const remainingRef = useRef(duration);
  const startedRef = useRef(0);
  // Keep the latest onClose without restarting the timer on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const start = useCallback(() => {
    if (!Number.isFinite(remainingRef.current) || remainingRef.current <= 0) return;
    startedRef.current = Date.now();
    timerRef.current = setTimeout(() => onCloseRef.current(), remainingRef.current);
  }, []);

  const pause = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current -= Date.now() - startedRef.current;
  };

  useEffect(() => {
    start();
    return () => clearTimeout(timerRef.current);
  }, [start]);

  return (
    <div
      className={`app-toast app-toast--${toast.tone}`}
      role={toast.tone === "error" || toast.tone === "warning" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={start}
    >
      <span className="app-toast__icon" aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>
      <div className="app-toast__body">
        {toast.title && <strong className="app-toast__title">{toast.title}</strong>}
        <span className="app-toast__message">{toast.message}</span>
      </div>
      <button type="button" className="app-toast__close" onClick={onClose} aria-label="Dismiss notification">
        <X size={15} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function ConfirmDialog({ confirm, onResolve }) {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const danger = confirm.tone === "danger";

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    // Default focus goes to the safe action for destructive prompts.
    (danger ? cancelButtonRef.current : confirmButtonRef.current)?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onResolve(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll("button:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    };
  }, [danger, onResolve]);

  const Icon = danger ? AlertTriangle : Info;

  return (
    <div
      className="app-confirm__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div
        ref={dialogRef}
        className={`app-confirm${danger ? " app-confirm--danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-message"
      >
        <div className="app-confirm__accent" />
        <div className="app-confirm__content">
          <span className="app-confirm__icon" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
          <div>
            <h3 id="app-confirm-title" className="app-confirm__title">{confirm.title || "Please confirm"}</h3>
            <p id="app-confirm-message" className="app-confirm__message">{confirm.message}</p>
          </div>
        </div>
        <div className="app-confirm__actions">
          <button ref={cancelButtonRef} type="button" className="app-confirm__btn app-confirm__btn--ghost" onClick={() => onResolve(false)}>
            {confirm.cancelLabel || "Cancel"}
          </button>
          <button ref={confirmButtonRef} type="button" className="app-confirm__btn app-confirm__btn--primary" onClick={() => onResolve(true)}>
            {confirm.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [confirmQueue, setConfirmQueue] = useState([]);

  useEffect(() => subscribeFeedback((event) => {
    if (event.type === "toast") {
      setToasts((current) => [...current, event.toast].slice(-MAX_VISIBLE_TOASTS));
    } else if (event.type === "dismiss") {
      setToasts((current) => current.filter((item) => item.id !== event.id));
    } else if (event.type === "confirm") {
      setConfirmQueue((current) => [...current, event.confirm]);
    }
  }), []);

  const activeConfirm = confirmQueue[0];

  const resolveConfirm = useCallback((value) => {
    setConfirmQueue((current) => {
      const [head, ...rest] = current;
      head?.resolve(value);
      return rest;
    });
  }, []);

  return (
    <>
      <div className="app-toast-region" aria-live="polite">
        {toasts.map((item) => (
          <ToastItem
            key={item.id}
            toast={item}
            onClose={() => setToasts((current) => current.filter((entry) => entry.id !== item.id))}
          />
        ))}
      </div>
      {activeConfirm && <ConfirmDialog key={activeConfirm.id} confirm={activeConfirm} onResolve={resolveConfirm} />}
    </>
  );
}
