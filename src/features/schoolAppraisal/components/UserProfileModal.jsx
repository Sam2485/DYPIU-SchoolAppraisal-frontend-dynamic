import { initialsFromName } from "../../../utils/initials";
import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../../../api/client";
import { changeCurrentUserPassword, fetchCurrentUser, uploadCurrentUserAvatar } from "../../../api/users";
import { getAttachmentUrl } from "../../../utils/attachment";

const AVATAR_EDITOR_SIZE = 220;
const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_ZOOM_STEP = 0.08;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateBaseSize(naturalWidth = 200, naturalHeight = 200, viewportSize = AVATAR_EDITOR_SIZE) {
  // Containment: scale down so entire logo/photo fits comfortably within viewport with margin
  const fitScale = Math.min(
    (viewportSize * 0.92) / Math.max(1, naturalWidth),
    (viewportSize * 0.92) / Math.max(1, naturalHeight)
  );
  return {
    width: Math.max(10, Math.round(naturalWidth * fitScale)),
    height: Math.max(10, Math.round(naturalHeight * fitScale)),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createAdjustedAvatarFile(src, crop, baseSize) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

  const ratio = AVATAR_OUTPUT_SIZE / AVATAR_EDITOR_SIZE;
  const nw = image.naturalWidth || 200;
  const nh = image.naturalHeight || 200;
  const currentBase = (baseSize && baseSize.width && baseSize.height)
    ? baseSize
    : calculateBaseSize(nw, nh, AVATAR_EDITOR_SIZE);

  const zoom = Number(crop?.zoom) || 1;
  const scaledWidth = currentBase.width * zoom * ratio;
  const scaledHeight = currentBase.height * zoom * ratio;
  const drawX = (AVATAR_OUTPUT_SIZE - scaledWidth) / 2 + (crop?.x || 0) * ratio;
  const drawY = (AVATAR_OUTPUT_SIZE - scaledHeight) / 2 + (crop?.y || 0) * ratio;

  context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not prepare profile photo."));
        return;
      }
      resolve(new File([blob], "profile-photo.png", { type: "image/png" }));
    }, "image/png");
  });
}

function LockIcon() {
  return (
    <Lock size={12} strokeWidth={1.8} />
  );
}

function LockedProfileField({ label, value }) {
  return (
    <div style={styles.readOnlyField}>
      <span style={styles.lockedLabelRow}>
        <LockIcon />
        {label}
      </span>
      <div style={styles.lockedValue} title="Contact an administrator to change this">{value}</div>
    </div>
  );
}

function ChangePasswordSection() {
  const [expanded, setExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleUpdatePassword = async () => {
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Fill in all three fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await changeCurrentUserPassword({ currentPassword, newPassword });
      setSuccess("Password updated.");
      resetFields();
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't update your password. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.passwordSection}>
      <button
        type="button"
        style={styles.passwordToggleButton}
        onClick={() => {
          setExpanded((open) => !open);
          setError("");
          setSuccess("");
        }}
      >
        Change password
        <span style={styles.passwordToggleChevron}>{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div style={{ ...styles.passwordFieldsGrid, marginTop: 14 }}>
          <label style={{ ...styles.readOnlyField, gridColumn: "1 / -1" }}>
            <span style={styles.readOnlyLabel}>Current password</span>
            <input
              style={styles.editableInput}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label style={styles.readOnlyField}>
            <span style={styles.readOnlyLabel}>New password</span>
            <input
              style={styles.editableInput}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label style={styles.readOnlyField}>
            <span style={styles.readOnlyLabel}>Confirm new password</span>
            <input
              style={styles.editableInput}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error && <p style={{ ...styles.profileModalError, gridColumn: "1 / -1" }}>{error}</p>}
          {success && <p style={{ ...styles.passwordSuccessText, gridColumn: "1 / -1" }}>{success}</p>}

          <button
            type="button"
            style={{ ...styles.saveButton, gridColumn: "1 / -1" }}
            onClick={handleUpdatePassword}
            disabled={saving}
          >
            {saving ? "Updating..." : "Update password"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function UserProfileModal({ profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || "");
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarCrop, setAvatarCrop] = useState({ zoom: 1, x: 0, y: 0 });
  const [avatarImageSize, setAvatarImageSize] = useState({ width: 0, height: 0 });
  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const selectedObjectUrlRef = useRef("");
  const dragRef = useRef(null);

  useEffect(() => {
    let isActive = true;
    fetchCurrentUser()
      .then(({ data }) => {
        if (!isActive) return;
        const remote = data?.data || data || {};
        if (remote.name) setName(remote.name);
        if (remote.email) setEmail(remote.email);
        if (remote.avatarUrl && !selectedObjectUrlRef.current) {
          setAvatarUrl(remote.avatarUrl);
          setAvatarPreview(remote.avatarUrl);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isActive) setLoadingProfile(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => () => {
    if (selectedObjectUrlRef.current) {
      URL.revokeObjectURL(selectedObjectUrlRef.current);
    }
  }, []);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (selectedObjectUrlRef.current) {
      URL.revokeObjectURL(selectedObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    selectedObjectUrlRef.current = objectUrl;
    setAvatarFile(file);
    setAvatarPreview(objectUrl);
    setAvatarCrop({ zoom: 1, x: 0, y: 0 });
    setBaseSize({ width: 0, height: 0 });
    event.target.value = "";
  };

  const setAvatarZoom = (zoom) => {
    const clamped = clamp(Number(zoom) || 1, 0.2, 3.0);
    const nextZoom = Number(clamped.toFixed(2));
    setAvatarCrop((current) => {
      const currentW = (baseSize.width || AVATAR_EDITOR_SIZE) * nextZoom;
      const currentH = (baseSize.height || AVATAR_EDITOR_SIZE) * nextZoom;
      const maxPanX = Math.max(AVATAR_EDITOR_SIZE * 0.8, (currentW + AVATAR_EDITOR_SIZE) / 2);
      const maxPanY = Math.max(AVATAR_EDITOR_SIZE * 0.8, (currentH + AVATAR_EDITOR_SIZE) / 2);
      return {
        zoom: nextZoom,
        x: clamp(current.x, -maxPanX, maxPanX),
        y: clamp(current.y, -maxPanY, maxPanY),
      };
    });
  };

  const handleAvatarPointerDown = (event) => {
    if (!avatarFile) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: avatarCrop.x,
      cropY: avatarCrop.y,
    };
  };

  const handleAvatarPointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const currentW = (baseSize.width || AVATAR_EDITOR_SIZE) * avatarCrop.zoom;
    const currentH = (baseSize.height || AVATAR_EDITOR_SIZE) * avatarCrop.zoom;
    const maxPanX = Math.max(AVATAR_EDITOR_SIZE * 0.8, (currentW + AVATAR_EDITOR_SIZE) / 2);
    const maxPanY = Math.max(AVATAR_EDITOR_SIZE * 0.8, (currentH + AVATAR_EDITOR_SIZE) / 2);
    const nextX = clamp(dragRef.current.cropX + event.clientX - dragRef.current.startX, -maxPanX, maxPanX);
    const nextY = clamp(dragRef.current.cropY + event.clientY - dragRef.current.startY, -maxPanY, maxPanY);
    setAvatarCrop((current) => ({ ...current, x: nextX, y: nextY }));
  };

  const handleAvatarPointerUp = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarFile) {
        const adjustedAvatarFile = await createAdjustedAvatarFile(avatarPreview, avatarCrop, baseSize);
        nextAvatarUrl = (await uploadCurrentUserAvatar(adjustedAvatarFile)) || avatarUrl;
      }
      onSaved({ name, email, avatarUrl: nextAvatarUrl });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't save your profile. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.profileModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalTitle}>My Profile</div>

        <div style={styles.profileModalAvatarRow}>
          {avatarFile && avatarPreview ? (
            <div style={styles.avatarEditor}>
              <div
                style={styles.avatarCropViewport}
                onPointerDown={handleAvatarPointerDown}
                onPointerMove={handleAvatarPointerMove}
                onPointerUp={handleAvatarPointerUp}
                onPointerCancel={handleAvatarPointerUp}
              >
                <img
                  src={avatarPreview}
                  alt=""
                  draggable="false"
                  onLoad={(event) => {
                    const nw = event.currentTarget.naturalWidth || 200;
                    const nh = event.currentTarget.naturalHeight || 200;
                    setAvatarImageSize({ width: nw, height: nh });
                    const initialBase = calculateBaseSize(nw, nh, AVATAR_EDITOR_SIZE);
                    setBaseSize(initialBase);
                    setAvatarCrop({ zoom: 1, x: 0, y: 0 });
                  }}
                  style={{
                    ...styles.avatarCropImage,
                    width: baseSize.width ? `${baseSize.width}px` : "auto",
                    height: baseSize.height ? `${baseSize.height}px` : "auto",
                    transform: `translate(-50%, -50%) translate(${avatarCrop.x}px, ${avatarCrop.y}px) scale(${avatarCrop.zoom})`,
                    transformOrigin: "center center",
                  }}
                />
                <div style={styles.avatarCropGrid} />
              </div>
              <div style={styles.avatarEditorControls}>
                <label style={styles.zoomControl}>
                  <span style={styles.readOnlyLabel}>Zoom</span>
                  <div style={styles.zoomSliderRow}>
                    <button type="button" style={styles.zoomButton} onClick={() => setAvatarZoom(avatarCrop.zoom - 0.1)} aria-label="Zoom out">-</button>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.02"
                      value={avatarCrop.zoom}
                      onChange={(event) => setAvatarZoom(event.target.value)}
                      style={styles.zoomSlider}
                    />
                    <button type="button" style={styles.zoomButton} onClick={() => setAvatarZoom(avatarCrop.zoom + 0.1)} aria-label="Zoom in">+</button>
                  </div>
                </label>
                <div style={styles.avatarEditorActions}>
                  <button type="button" style={styles.secondaryPhotoButton} onClick={() => fileInputRef.current?.click()}>
                    Replace
                  </button>
                  <button type="button" style={styles.secondaryPhotoButton} onClick={() => setAvatarCrop({ zoom: 1, x: 0, y: 0 })}>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.profileModalAvatar}>
                {avatarPreview ? (
                  <img src={getAttachmentUrl(avatarPreview)} alt="" style={styles.profileModalAvatarImg} />
                ) : (
                  <span>{initialsFromName(name) || "?"}</span>
                )}
              </div>
              <div>
                <button type="button" style={styles.uploadButton} onClick={() => fileInputRef.current?.click()}>
                  Change photo
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={styles.hiddenFileInput}
            onChange={handlePhotoChange}
          />
        </div>

        <div style={styles.profileModalFields}>
          <LockedProfileField label="Name" value={name} />
          <LockedProfileField label="Email" value={email} />
          <LockedProfileField label="Role" value={profile.designation || profile.role} />
          {profile.school && <LockedProfileField label="School" value={profile.school} />}
        </div>

        {error && <p style={styles.profileModalError}>{error}</p>}

        <div style={styles.modalActions}>
          <button type="button" onClick={onClose} style={styles.cancelButton} disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSave} style={styles.saveButton} disabled={saving || loadingProfile || !avatarFile}>
            {saving ? "Saving..." : "Save photo"}
          </button>
        </div>

        <ChangePasswordSection />
      </div>
    </div>
  );
}

const styles = {
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.62)",
    backdropFilter: "blur(8px)",
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 18,
  },
  profileModal: {
    width: "min(600px, 95vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "var(--card)",
    borderRadius: 12,
    padding: "26px 28px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  modalTitle: {
    color: "var(--ink)",
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 8,
  },
  profileModalAvatarRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  avatarEditor: {
    width: "100%",
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    alignItems: "center",
  },
  avatarCropViewport: {
    position: "relative",
    width: AVATAR_EDITOR_SIZE,
    height: AVATAR_EDITOR_SIZE,
    overflow: "hidden",
    borderRadius: "50%",
    background: "var(--card)",
    boxShadow: "0 0 0 1px #d7dee9, 0 0 0 8px var(--bg)",
    touchAction: "none",
    cursor: "grab",
    userSelect: "none",
  },
  avatarCropImage: {
    position: "absolute",
    left: "50%",
    top: "50%",
    maxWidth: "none",
    maxHeight: "none",
    userSelect: "none",
    pointerEvents: "none",
  },
  avatarCropGrid: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: [
      "linear-gradient(to right, transparent 32.8%, rgba(255,255,255,.82) 33%, transparent 33.4%, transparent 66.2%, rgba(255,255,255,.82) 66.5%, transparent 66.9%)",
      "linear-gradient(to bottom, transparent 32.8%, rgba(255,255,255,.82) 33%, transparent 33.4%, transparent 66.2%, rgba(255,255,255,.82) 66.5%, transparent 66.9%)",
      "radial-gradient(circle, transparent 68%, rgba(15,23,42,.24) 69%, rgba(15,23,42,.24) 70%, transparent 71%)",
    ].join(", "),
  },
  avatarEditorControls: {
    flex: "1 1 220px",
    minWidth: 220,
    display: "grid",
    gap: 14,
  },
  zoomControl: {
    display: "grid",
    gap: 7,
  },
  zoomSliderRow: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr) 34px",
    gap: 8,
    alignItems: "center",
  },
  zoomButton: {
    width: 34,
    height: 34,
    border: "1px solid #d7dee9",
    borderRadius: 8,
    background: "var(--card)",
    color: "#1e293b",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  zoomSlider: {
    width: "100%",
    accentColor: "var(--primary)",
  },
  avatarEditorActions: {
    display: "flex",
    gap: 8,
  },
  secondaryPhotoButton: {
    flex: 1,
    minHeight: 36,
    border: "1px solid #d7dee9",
    borderRadius: 8,
    background: "var(--bg)",
    color: "#334155",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  profileModalAvatar: {
    width: 64,
    height: 64,
    flex: "0 0 64px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: "50%",
    color: "#1e3a8a",
    background: "linear-gradient(145deg, #dbeafe, #93c5fd)",
    fontSize: 20,
    fontWeight: 800,
  },
  profileModalAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  uploadButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    border: "1px solid var(--primary)",
    borderRadius: 9,
    padding: "9px 13px",
    color: "var(--card)",
    background: "var(--primary)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: "inherit",
  },
  hiddenFileInput: {
    display: "none",
  },
  profileModalFields: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px 16px",
    marginBottom: 18,
  },
  passwordFieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px 16px",
  },
  readOnlyField: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  readOnlyLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 650,
  },
  editableInput: {
    width: "100%",
    minHeight: 42,
    border: "1px solid #d7dee9",
    borderRadius: 8,
    padding: "9px 11px",
    color: "var(--ink)",
    background: "var(--card)",
    outline: "none",
    fontSize: 12.5,
    lineHeight: 1.45,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  lockedLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#334155",
    fontSize: 12,
    fontWeight: 650,
  },
  lockedValue: {
    width: "100%",
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "9px 11px",
    color: "var(--muted)",
    background: "var(--bg-alt)",
    fontSize: 12.5,
    lineHeight: 1.45,
    cursor: "not-allowed",
    boxSizing: "border-box",
  },
  profileModalError: {
    margin: "12px 0 0",
    color: "var(--red-600)",
    fontSize: 12.5,
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    border: "none",
    borderRadius: 8,
    background: "var(--bg-alt)",
    color: "#475569",
    padding: 10,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  saveButton: {
    flex: 1,
    border: "none",
    borderRadius: 8,
    background: "var(--primary)",
    color: "var(--card)",
    padding: 10,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  passwordSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTop: "1px solid var(--border)",
  },
  passwordToggleButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    border: "none",
    background: "transparent",
    padding: 0,
    color: "var(--ink)",
    fontSize: 13.5,
    fontWeight: 750,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  passwordToggleChevron: {
    color: "var(--primary)",
    fontSize: 16,
    fontWeight: 800,
  },
  passwordSuccessText: {
    margin: "12px 0 0",
    color: "var(--green-550)",
    fontSize: 12.5,
    lineHeight: 1.5,
  },
};
