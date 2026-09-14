import { useEffect, useRef, useState } from "react";
import { fetchUniversityBranding, updateUniversityBranding } from "../../../api/config";
import { uploadAttachment } from "../../../api/submissions";
import { getApiErrorMessage } from "../../../api/client";
import { getAttachmentUrl } from "../../../utils/attachment";

const EMPTY_FORM = { universityName: "", domain: "", address: "", act: "", logoUrl: "", iqacLogoUrl: "" };

const field = { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 };
const label = { fontSize: 12.5, fontWeight: 650, color: "#1e293b" };
const input = { border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 11px", fontSize: 13, background: "#fff" };
const logoBox = { border: "1px solid #bfdbfe", borderRadius: 10, background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)", padding: 16, boxShadow: "0 1px 3px rgba(15, 23, 42, .05)" };
const logoBoxTitle = { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontWeight: 700, fontSize: 14, color: "#0f172a" };
const logoIconWrap = { width: 30, height: 30, flex: "0 0 30px", display: "grid", placeItems: "center", borderRadius: 8, background: "#dbeafe", border: "1px solid #93c5fd", fontSize: 15 };
const readRow = { marginBottom: 16 };
const readLabel = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 };
const readValue = { fontSize: 14, color: "#0f172a" };

function LogoPicker({ title, icon, value, onChange, uploadingKey, onUploadingChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onUploadingChange?.(uploadingKey, true);
    setUploadError("");
    try {
      const uploaded = await uploadAttachment(file);
      if (uploaded.url) onChange(uploaded.url);
      else setUploadError("Upload succeeded but no URL was returned.");
    } catch (err) {
      setUploadError(getApiErrorMessage(err, "Failed to upload logo."));
    } finally {
      setUploading(false);
      onUploadingChange?.(uploadingKey, false);
      e.target.value = "";
    }
  };

  return (
    <div style={logoBox}>
      <div style={logoBoxTitle}>
        <span style={logoIconWrap}>{icon}</span>
        <span>{title}</span>
      </div>

      {value && (
        <img
          src={getAttachmentUrl(value)}
          alt={`${title} preview`}
          style={{ display: "block", height: 64, marginBottom: 12, objectFit: "contain", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: 6 }}
        />
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ width: "100%", border: "1px solid #2563eb", borderRadius: 6, background: uploading ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 650, fontSize: 13, padding: "9px 11px", cursor: uploading ? "not-allowed" : "pointer", marginBottom: 8, boxShadow: "0 1px 2px rgba(37, 99, 235, .25)" }}
      >
        {uploading ? "Uploading..." : `Upload ${title}`}
      </button>
      {uploadError && <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b91c1c" }}>{uploadError}</p>}

      <input
        style={{ ...input, fontSize: 12 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste direct logo URL (https://...)"
      />
    </div>
  );
}

function LogoDisplay({ title, icon, value }) {
  return (
    <div style={logoBox}>
      <div style={logoBoxTitle}>
        <span style={logoIconWrap}>{icon}</span>
        <span>{title}</span>
      </div>
      {value ? (
        <img
          src={getAttachmentUrl(value)}
          alt={`${title} preview`}
          style={{ display: "block", height: 64, objectFit: "contain", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: 6 }}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 64, border: "1px dashed #93c5fd", borderRadius: 6, background: "#fff", fontSize: 12.5, color: "#94a3b8" }}>
          No logo uploaded yet
        </div>
      )}
    </div>
  );
}

export default function UniversityControlsPanel({ onSaved }) {
  const [saved, setSaved] = useState(EMPTY_FORM);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogos, setUploadingLogos] = useState({});
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchUniversityBranding()
      .then((data) => {
        if (!active || !data) return;
        const next = {
          universityName: data.universityName || "",
          domain: data.domain || "",
          address: data.address || "",
          act: data.act || "",
          logoUrl: data.logoUrl || "",
          iqacLogoUrl: data.iqacLogoUrl || "",
        };
        setSaved(next);
        setForm(next);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setLogo = (key) => (url) => setForm((f) => ({ ...f, [key]: url }));
  const markUploading = (key, value) => setUploadingLogos((u) => ({ ...u, [key]: value }));
  const anyUploading = Object.values(uploadingLogos).some(Boolean);

  const startEditing = () => {
    setForm(saved);
    setStatus(null);
    setError("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setForm(saved);
    setError("");
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError("");
    try {
      await updateUniversityBranding(form);
      setSaved(form);
      setIsEditing(false);
      setStatus("University details updated successfully.");
      await onSaved?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update university details."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: "#64748b" }}>Loading university details...</div>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "#0f172a" }}>University Controls</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {isEditing ? "Update your university's name, domain, address, and header logos." : "Current university details on record."}
          </p>
        </div>
        {!isEditing && (
          <button type="button" className="btn btn-primary" onClick={startEditing} style={{ flexShrink: 0 }}>
            Edit Details
          </button>
        )}
      </div>

      {status && <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 6, background: "#ecfdf5", color: "#0f766e", fontSize: 13 }}>{status}</div>}
      {error && <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 6, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>{error}</div>}

      {isEditing ? (
        <form onSubmit={handleSave}>
          <div className="university-controls-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 28 }}>
            <div>
              <div style={field}>
                <label style={label}>University Full Name</label>
                <input style={input} value={form.universityName} onChange={update("universityName")} />
              </div>
              <div style={field}>
                <label style={label}>Domain</label>
                <input style={input} value={form.domain} onChange={update("domain")} placeholder="e.g. dypiu.ac.in" />
              </div>
              <div style={field}>
                <label style={label}>Campus Address</label>
                <textarea style={{ ...input, resize: "vertical" }} rows={2} value={form.address} onChange={update("address")} />
              </div>
              <div style={{ ...field, marginBottom: 0 }}>
                <label style={label}>Establishment Act / Authority</label>
                <input style={input} value={form.act} onChange={update("act")} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <LogoPicker title="University Logo" icon="🏛️" value={form.logoUrl} onChange={setLogo("logoUrl")} uploadingKey="logo" onUploadingChange={markUploading} />
              <LogoPicker title="IQAC Logo" icon="✨" value={form.iqacLogoUrl} onChange={setLogo("iqacLogoUrl")} uploadingKey="iqacLogo" onUploadingChange={markUploading} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving || anyUploading}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="university-controls-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 28 }}>
          <div>
            <div style={readRow}><span style={readLabel}>University Full Name</span><span style={readValue}>{saved.universityName || "—"}</span></div>
            <div style={readRow}><span style={readLabel}>Domain</span><span style={readValue}>{saved.domain || "—"}</span></div>
            <div style={readRow}><span style={readLabel}>Campus Address</span><span style={readValue}>{saved.address || "—"}</span></div>
            <div style={{ ...readRow, marginBottom: 0 }}><span style={readLabel}>Establishment Act / Authority</span><span style={readValue}>{saved.act || "—"}</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LogoDisplay title="University Logo" icon="🏛️" value={saved.logoUrl} />
            <LogoDisplay title="IQAC Logo" icon="✨" value={saved.iqacLogoUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
