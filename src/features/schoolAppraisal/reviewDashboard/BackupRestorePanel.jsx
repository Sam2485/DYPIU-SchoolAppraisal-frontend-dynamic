import { TriangleAlert, Download, Upload } from "lucide-react";
import { useState, useRef } from "react";
import apiClient, { getApiErrorMessage } from "../../../api/client";

export default function BackupRestorePanel() {
  const [dbLoading, setDbLoading] = useState(false);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [dbRestoring, setDbRestoring] = useState(false);
  const [uploadsRestoring, setUploadsRestoring] = useState(false);
  
  const [dbProgress, setDbProgress] = useState(0);
  const [uploadsProgress, setUploadsProgress] = useState(0);

  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const dbInputRef = useRef(null);
  const uploadsInputRef = useRef(null);

  // ────────────────────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────────────────────

  const handleDownloadDb = async () => {
    setDbLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await apiClient.get("/api/backup/db", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `db_dump_${Date.now()}.sql`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Database dump downloaded successfully.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Failed to download database dump."));
    } finally {
      setDbLoading(false);
    }
  };

  const handleDownloadUploads = async () => {
    setUploadsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await apiClient.get("/api/backup/uploads", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uploads_backup_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Uploads ZIP backup downloaded successfully.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Failed to download uploads ZIP backup."));
    } finally {
      setUploadsLoading(false);
    }
  };

  const handleDbUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".sql")) {
      setErrorMessage("Only .sql files are allowed.");
      return;
    }

    setDbRestoring(true);
    setDbProgress(0);
    setErrorMessage(null);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiClient.post("/api/backup/db/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setDbProgress(percentCompleted);
        },
      });
      setStatusMessage(response.data?.message || "Database successfully restored.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Failed to restore database."));
    } finally {
      setDbRestoring(false);
      setDbProgress(0);
      if (dbInputRef.current) dbInputRef.current.value = "";
    }
  };

  const handleUploadsUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      setErrorMessage("Only .zip files are allowed.");
      return;
    }

    setUploadsRestoring(true);
    setUploadsProgress(0);
    setErrorMessage(null);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiClient.post("/api/backup/uploads/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadsProgress(percentCompleted);
        },
      });
      setStatusMessage(response.data?.message || "Uploads ZIP successfully restored.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Failed to restore uploads ZIP."));
    } finally {
      setUploadsRestoring(false);
      setUploadsProgress(0);
      if (uploadsInputRef.current) uploadsInputRef.current.value = "";
    }
  };

  return (
    <div style={styles.container}>
      {/* Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerIcon}>
          <TriangleAlert size={20} strokeWidth={2} />
        </div>
        <div style={styles.bannerText}>
          <strong style={styles.bannerTitle}>BROWSER UPLOAD & SIZE LIMITATIONS</strong>
          <p style={styles.bannerDescription}>
            Web-based file transfers are subject to network timeouts and container memory allocation. 
            For large media/file sizes, please use direct server command-line tools (SCP/SFTP and SSH) as described in the system docs.
          </p>
        </div>
      </div>

      {statusMessage && <div style={styles.successAlert}>{statusMessage}</div>}
      {errorMessage && <div style={styles.errorAlert}>{errorMessage}</div>}

      {/* Cards Grid */}
      <div style={styles.grid}>
        {/* PostgreSQL Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>PostgreSQL Database</h2>
          <p style={styles.cardSubtitle}>SQL data dumps and schema recovery</p>

          <div style={styles.divider} />

          {/* Export Section */}
          <div style={styles.section}>
            <span style={styles.sectionHeader}>EXPORT DATABASE DUMP</span>
            <p style={styles.sectionDescription}>
              Generates a full PostgreSQL database dump containing all tables, appraisal forms, snapshot configurations, and user credentials.
            </p>
            <button
              onClick={handleDownloadDb}
              disabled={dbLoading}
              style={dbLoading ? styles.buttonDisabled : styles.button}
            >
              <Download size={16} strokeWidth={2} style={styles.btnIcon} />
              {dbLoading ? "Generating SQL..." : "Download Database SQL"}
            </button>
          </div>

          <div style={styles.divider} />

          {/* Restore Section */}
          <div style={styles.section}>
            <span style={styles.sectionHeader}>RESTORE / IMPORT DATABASE</span>
            
            <div style={styles.criticalWarning}>
              <strong>CRITICAL WARNING:</strong> Restoring database dumps replaces the live schema. All data registered since the backup date will be permanently deleted.
            </div>

            <input
              type="file"
              accept=".sql"
              ref={dbInputRef}
              onChange={handleDbUpload}
              style={{ display: "none" }}
            />
            
            <button
              onClick={() => dbInputRef.current?.click()}
              disabled={dbRestoring}
              style={dbRestoring ? styles.dropzoneDisabled : styles.dropzone}
            >
              <Upload size={24} strokeWidth={2} style={styles.dropzoneIcon} />
              <span>{dbRestoring ? "Restoring Database..." : "Click to choose SQL dump file"}</span>
              <small style={styles.dropzoneSmall}>Only .sql files are allowed</small>
            </button>

            {dbRestoring && (
              <div style={styles.progressContainer}>
                <div style={{ ...styles.progressBar, width: `${dbProgress}%` }} />
                <span style={styles.progressText}>
                  {dbProgress === 100 ? "Restoring schema & data..." : `Uploading: ${dbProgress}%`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Uploads Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Uploaded Proof Files</h2>
          <p style={styles.cardSubtitle}>PDF documents, attachments, and uploads backup</p>

          <div style={styles.divider} />

          {/* Export Section */}
          <div style={styles.section}>
            <span style={styles.sectionHeader}>EXPORT UPLOADED DOCUMENTS</span>
            <p style={styles.sectionDescription}>
              Zips the entire storage uploads directory containing all faculty-provided PDF attachments and proof files.
            </p>
            <button
              onClick={handleDownloadUploads}
              disabled={uploadsLoading}
              style={uploadsLoading ? styles.buttonDisabled : styles.button}
            >
              <Download size={16} strokeWidth={2} style={styles.btnIcon} />
              {uploadsLoading ? "Zipping files..." : "Download Uploads ZIP"}
            </button>
          </div>

          <div style={styles.divider} />

          {/* Restore Section */}
          <div style={styles.section}>
            <span style={styles.sectionHeader}>RESTORE / IMPORT UPLOADS</span>
            
            <div style={styles.noteWarning}>
              <strong>NOTE:</strong> Restoring uploads will overwrite files with matching names inside the uploads directory. Existing unique files will not be deleted.
            </div>

            <input
              type="file"
              accept=".zip"
              ref={uploadsInputRef}
              onChange={handleUploadsUpload}
              style={{ display: "none" }}
            />

            <button
              onClick={() => uploadsInputRef.current?.click()}
              disabled={uploadsRestoring}
              style={uploadsRestoring ? styles.dropzoneDisabled : styles.dropzone}
            >
              <Upload size={24} strokeWidth={2} style={styles.dropzoneIcon} />
              <span>{uploadsRestoring ? "Uploading & Restoring..." : "Click to choose ZIP backup archive"}</span>
              <small style={styles.dropzoneSmall}>Only .zip files are allowed</small>
            </button>

            {uploadsRestoring && (
              <div style={styles.progressContainer}>
                <div style={{ ...styles.progressBar, width: `${uploadsProgress}%` }} />
                <span style={styles.progressText}>
                  {uploadsProgress === 100 ? "Extracting backup ZIP..." : `Uploading: ${uploadsProgress}%`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "12px 0 4px",
    color: "#0f172a",
  },
  banner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "16px",
  },
  bannerIcon: {
    width: "32px",
    height: "32px",
    display: "grid",
    placeItems: "center",
    borderRadius: "9px",
    color: "#2563eb",
    background: "#dbeafe",
    flexShrink: 0,
  },
  bannerText: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  bannerTitle: {
    color: "#1d4ed8",
    fontSize: "12px",
    letterSpacing: "0.5px",
  },
  bannerDescription: {
    color: "#475569",
    fontSize: "12.5px",
    margin: 0,
    lineHeight: "1.45",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "18px",
    alignItems: "stretch",
  },
  card: {
    minWidth: 0,
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: "14px",
    padding: "18px",
    boxShadow: "0 18px 38px rgba(15, 23, 42, 0.08)",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#0f172a",
    margin: "0 0 4px 0",
  },
  cardSubtitle: {
    fontSize: "12.5px",
    color: "#64748b",
    margin: 0,
  },
  divider: {
    height: "1px",
    background: "#e2e8f0",
    margin: "16px 0",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionHeader: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "1px",
  },
  sectionDescription: {
    fontSize: "13px",
    color: "#475569",
    lineHeight: "1.45",
    margin: 0,
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37, 99, 235, 0.18)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  },
  buttonDisabled: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "#cbd5e1",
    color: "#475569",
    border: "none",
    borderRadius: "8px",
    padding: "11px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "not-allowed",
    opacity: 0.7,
  },
  btnIcon: {
    flexShrink: 0,
  },
  criticalWarning: {
    fontSize: "12px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#be123c",
    lineHeight: "1.45",
  },
  noteWarning: {
    fontSize: "12px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#92400e",
    lineHeight: "1.45",
  },
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    background: "#f8fafc",
    border: "1px dashed #94a3b8",
    borderRadius: "8px",
    padding: "18px 14px",
    cursor: "pointer",
    color: "#334155",
    transition: "border-color 0.2s, background 0.2s",
    outline: "none",
    width: "100%",
  },
  dropzoneDisabled: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    background: "#f1f5f9",
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "18px 14px",
    cursor: "not-allowed",
    color: "#64748b",
    width: "100%",
    opacity: 0.7,
  },
  dropzoneIcon: {
    color: "#2563eb",
  },
  dropzoneSmall: {
    fontSize: "11px",
    color: "#64748b",
  },
  successAlert: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  errorAlert: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  progressContainer: {
    width: "100%",
    height: "22px",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    marginTop: "10px",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    transition: "width 0.15s ease-out",
  },
  progressText: {
    position: "relative",
    zIndex: 1,
    fontSize: "11px",
    fontWeight: "750",
    color: "#1e293b",
    textShadow: "0 0 2px #fff",
  },
};
