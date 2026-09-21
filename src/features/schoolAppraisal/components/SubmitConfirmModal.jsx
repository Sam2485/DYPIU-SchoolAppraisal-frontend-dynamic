import { FileCheck, CircleAlert } from "lucide-react";
import React, { useEffect } from "react";

/**
 * SubmitConfirmModal
 * A white-and-blue themed confirmation modal for appraisal submissions.
 * Used across Director, User, Administrative, and Auditor submission workflows.
 */
export default function SubmitConfirmModal({
  isOpen,
  title = "Confirm Submission",
  message = "Are you sure you want to submit? Once submitted, the appraisal form will be locked for further edits and forwarded for review.",
  warningNote,
  confirmText = "Yes, Submit",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  submitting = false,
}) {
  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !submitting) {
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onCancel?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-confirm-modal-title"
    >
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.iconCircle}>
            <FileCheck size={24} color="#2563eb" strokeWidth={2.2} />
          </div>
          <div>
            <h3 id="submit-confirm-modal-title" style={styles.title}>
              {title}
            </h3>
            <p style={styles.subtitle}>DYPIU School Appraisal System</p>
          </div>
        </div>

        <div style={styles.body}>
          <p style={styles.messageText}>{message}</p>
          {warningNote && (
            <div style={styles.warningBox}>
              <CircleAlert size={16} color="#1d4ed8" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{warningNote}</span>
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={onCancel}
            disabled={submitting}
          >
            {cancelText}
          </button>
          <button
            type="button"
            style={{
              ...styles.confirmBtn,
              ...(submitting ? styles.confirmBtnDisabled : {}),
            }}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <svg
                  style={styles.spinner}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="31.4 31.4"
                    fill="none"
                  />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    padding: "16px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    boxShadow:
      "0 20px 25px -5px rgba(15, 23, 42, 0.2), 0 8px 10px -6px rgba(15, 23, 42, 0.1)",
    border: "1px solid #dbeafe",
    width: "100%",
    maxWidth: "460px",
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  iconCircle: {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 1.3,
  },
  subtitle: {
    margin: "3px 0 0 0",
    fontSize: "12px",
    fontWeight: "500",
    color: "#64748b",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  messageText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "1.55",
    color: "#334155",
  },
  warningBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 12px",
    backgroundColor: "#f0f7ff",
    border: "1px solid #bae6fd",
    borderRadius: "8px",
    fontSize: "13px",
    lineHeight: "1.45",
    color: "#0369a1",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "4px",
  },
  cancelBtn: {
    padding: "9px 18px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#334155",
    fontSize: "13.5px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  confirmBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 20px",
    borderRadius: "8px",
    border: "1px solid #1d4ed8",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontSize: "13.5px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(37, 99, 235, 0.3)",
    transition: "all 0.15s ease",
  },
  confirmBtnDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  spinner: {
    animation: "spin 1s linear infinite",
  },
};
