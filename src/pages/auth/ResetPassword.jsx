import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import { getApiErrorMessage } from "../../api/client";
import backgroundImage from "../../assets/images/dyp.jpeg";
import iqacLogo from "../../assets/images/IQAS.png";
import { InlineSpinner } from "../../features/schoolAppraisal/components/LoadingState";
import universityLogo from "../../assets/images/image.png";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(token ? "" : "Invalid or missing reset token.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    const password = newPassword.trim();
    const confirmation = confirmPassword.trim();

    if (!password || !confirmation) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (password !== confirmation) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(token, password);
      navigate("/login", {
        replace: true,
        state: { message: "Password reset successfully. Please login with your new credentials." },
      });
    } catch (resetError) {
      setError(getApiErrorMessage(resetError, "Could not reset password."));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") handleSubmit();
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; }

        .dyp-input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid rgba(255,255,255,0.55);
          border-radius: 4px;
          font-size: 14px;
          color: white;
          background: rgba(255,255,255,0.08);
          margin-bottom: 14px;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .dyp-input::placeholder { color: rgba(255,255,255,0.5); }
        .dyp-input:focus {
          border-color: white;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.15);
        }
        .dyp-btn {
          width: 100%;
          padding: 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s;
          margin-bottom: 12px;
          letter-spacing: 0.2px;
        }
        .dyp-btn:hover:not(:disabled) { background: #1d4ed8; }
        .dyp-btn:disabled { opacity: 0.72; cursor: not-allowed; }
        .dyp-link {
          background: none;
          border: none;
          font-size: 13px;
          color: rgba(255,255,255,0.75);
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          text-align: center;
          width: 100%;
          transition: color 0.2s;
        }
        .dyp-link:hover { color: white; text-decoration: underline; }

        @media (max-width: 900px) {
          .school-reset-card {
            width: min(100%, 520px) !important;
            flex-direction: column;
          }
          .school-reset-left {
            padding: 120px 24px 24px !important;
          }
          .school-reset-right {
            width: 100% !important;
            border-left: 0 !important;
            border-top: 1px solid rgba(255,255,255,0.15);
          }
          .school-reset-logo {
            height: 72px !important;
          }
        }
      `}</style>

      <div style={s.wrap}>
        <img className="school-reset-logo" src={universityLogo} alt="University Logo" style={s.topLeftLogo} />
        <img className="school-reset-logo" src={iqacLogo} alt="IQAC Logo" style={s.topRightLogo} />
        <div style={s.overlay} />

        <div className="school-reset-card" style={s.card}>
          <div className="school-reset-left" style={s.left}>
            <h1 style={s.uniName}>Reset Password</h1>
            <h2 style={{ ...s.uniName, fontSize: "1.3rem", fontWeight: 500, opacity: 0.9 }}>
              {sessionStorage.getItem("universityName") || localStorage.getItem("universityName") || "Faculty Appraisal System"}
            </h2>
            <p style={s.desc}>
              Set a new password for your School Appraisal System account.
            </p>
          </div>

          <div className="school-reset-right" style={s.right}>
            <h2 style={s.panelTitle}>Create your new password.</h2>

            {error && <div style={s.error}>{error}</div>}

            <input
              className="dyp-input"
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
              disabled={!token || loading}
            />

            <input
              className="dyp-input"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
              disabled={!token || loading}
            />

            <button className="dyp-btn" type="button" onClick={handleSubmit} disabled={!token || loading} aria-busy={loading}>
              {loading && <InlineSpinner label="Resetting password" />}
              {loading ? "Resetting password..." : "Reset Password"}
            </button>

            <button className="dyp-link" type="button" onClick={() => navigate("/login", { replace: true })}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const s = {
  topLeftLogo: {
    position: "absolute",
    top: 20,
    left: 20,
    height: 100,
    zIndex: 2,
  },
  topRightLogo: {
    position: "absolute",
    top: 20,
    right: 20,
    height: 100,
    zIndex: 2,
  },
  wrap: {
    minHeight: "100vh",
    width: "100%",
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    position: "relative",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(8, 16, 38, 0.30)",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "65%",
    maxWidth: 1280,
    display: "flex",
    alignItems: "stretch",
    borderRadius: 8,
    background: "rgba(15, 25, 50, 0.72)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    overflow: "hidden",
    minHeight: 260,
  },
  left: {
    flex: 1,
    color: "white",
    padding: "24px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    justifyContent: "center",
  },
  uniName: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.3,
    color: "white",
  },
  desc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.8,
    margin: 0,
    maxWidth: 500,
  },
  right: {
    width: 320,
    flexShrink: 0,
    background: "transparent",
    borderLeft: "1px solid rgba(255,255,255,0.15)",
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  panelTitle: {
    fontSize: 15.5,
    fontWeight: 700,
    color: "white",
    marginBottom: 22,
    marginTop: 0,
    lineHeight: 1.45,
  },
  error: {
    background: "rgba(185,28,28,0.25)",
    border: "1px solid rgba(252,165,165,0.5)",
    color: "#fca5a5",
    padding: "9px 12px",
    borderRadius: 4,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 1.5,
  },
};
