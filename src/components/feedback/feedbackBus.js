// Framework-free notification + confirmation bus.
// <FeedbackHost /> subscribes once at the app root; any module (component,
// handler, API helper) can call toast.*() or confirmAction() without context.
// If no host is mounted the calls fall back to the native dialogs, so behaviour
// is never lost.

const listeners = new Set();
let nextId = 1;

const emit = (event) => {
  listeners.forEach((listener) => listener(event));
};

export const subscribeFeedback = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const hasHost = () => listeners.size > 0;

const show = (tone, message, options = {}) => {
  const text = message == null ? "" : String(message);
  if (!hasHost()) {
    if (typeof window !== "undefined") window.alert(text);
    return null;
  }
  const id = nextId++;
  emit({ type: "toast", toast: { id, tone, message: text, ...options } });
  return id;
};

export const toast = {
  success: (message, options) => show("success", message, options),
  error: (message, options) => show("error", message, options),
  warning: (message, options) => show("warning", message, options),
  info: (message, options) => show("info", message, options),
  dismiss: (id) => emit({ type: "dismiss", id }),
};

/**
 * Promise-based replacement for window.confirm().
 * Resolves true when confirmed, false when cancelled / dismissed.
 * options: { title, confirmLabel, cancelLabel, tone: "default" | "danger" }
 */
export const confirmAction = (message, options = {}) => {
  const text = message == null ? "" : String(message);
  if (!hasHost()) {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(text) : false);
  }
  return new Promise((resolve) => {
    emit({ type: "confirm", confirm: { id: nextId++, message: text, resolve, ...options } });
  });
};
