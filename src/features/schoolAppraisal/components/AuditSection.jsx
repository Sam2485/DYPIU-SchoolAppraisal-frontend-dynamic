//renders a section of the audit form, like part A, part B, etc. It can contain fields and tables
import AuditTable from "./AuditTable";
import DateInput from "./DateInput";
import { columnsWithSerial, serialColumnFor, numberedRowFor, withSerialNumbers, emptyRowFor } from "./tableHelpers";
import { getAttachmentUrl } from "../../../utils/attachment";
import { formatDateDDMMYYYY } from "../../../utils/dateFormat";
import { uploadAttachments } from "../../../api/submissions";
import { resolveFieldValue } from "../../../utils/fieldResolver";

const parseIfJson = (value) => {
  if (typeof value === "string" && (value.trim().startsWith("[") || value.trim().startsWith("{"))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const isAttachmentValue = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (value.url || value.publicUrl || value.downloadUrl || value.name || value.fileName);

const hasPartEValues = (values = {}) => {
  if (!values || typeof values !== "object") return false;
  return (
    ["auditObservations", "auditRecommendations", "auditDocumentation", "remarks", "reviewRemarks"].some((fieldId) => {
      const value = values?.[fieldId];
      if (Array.isArray(value)) return value.length > 0;
      if (isAttachmentValue(value)) return true;
      return String(value || "").trim().length > 0;
    }) ||
    Object.entries(values).some(([k, v]) => {
      if (k.startsWith("__") || k === "status" || k === "auditType") return false;
      if (Array.isArray(v)) return v.length > 0;
      if (isAttachmentValue(v)) return true;
      return typeof v === "string" && v.trim().length > 0;
    })
  );
};

const safeObjectValue = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const assignmentPartEValues = (assignment = {}) => {
  const values = safeObjectValue(assignment.values || assignment.valuesData || assignment.reviewValues || assignment.reviewValuesData);
  return {
    ...values,
    auditObservations: assignment.auditObservations || assignment.remarks || values.auditObservations || values.remarks || "",
    auditRecommendations: assignment.auditRecommendations || values.auditRecommendations || "",
    auditDocumentation: assignment.auditDocumentation || values.auditDocumentation || "",
    remarks: assignment.remarks || assignment.auditObservations || values.remarks || values.auditObservations || "",
  };
};

const assignmentAuditor = (assignment = {}) => ({
  name: assignment.auditorName || assignment.name || "",
  designation: assignment.auditorDesignation || assignment.designation || "",
  role: assignment.auditorRole || assignment.role || assignment.auditorType || "",
  email: assignment.auditorEmail || assignment.email || "",
  date: assignment.submittedAt || assignment.auditorReviewedOn || "",
});

const getTableRows = (tables = {}, table = {}) => {
  if (!tables || typeof tables !== "object") return [];
  const keysToTry = [
    table.tableKey,
    table.idString,
    table.id != null ? String(table.id) : null,
    table.id,
    table.title,
    table.name,
  ].filter((k) => k !== undefined && k !== null && k !== "");

  for (const k of keysToTry) {
    if (Array.isArray(tables[k]) && tables[k].length > 0) return tables[k];
  }
  for (const k of keysToTry) {
    if (tables[k] !== undefined) return Array.isArray(tables[k]) ? tables[k] : [];
  }
  const tableEntries = Object.entries(tables);
  for (const k of keysToTry) {
    const kLower = String(k).toLowerCase().trim();
    const kSlug = kLower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const kNoSpace = kLower.replace(/[^a-z0-9]+/g, "");

    const found = tableEntries.find(([entryKey]) => {
      const eLower = String(entryKey).toLowerCase().trim();
      const eSlug = eLower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const eNoSpace = eLower.replace(/[^a-z0-9]+/g, "");
      return eLower === kLower || eSlug === kSlug || eNoSpace === kNoSpace;
    });
    if (found && Array.isArray(found[1]) && found[1].length > 0) return found[1];
    if (found && Array.isArray(found[1])) return found[1];
  }
  return [];
};

const rowHasData = (row) => {
  if (!row || typeof row !== "object") return false;
  return Object.entries(row).some(([k, v]) => {
    const keyClean = String(k).toLowerCase().replace(/[\s_-]/g, "");
    if (keyClean === "srno" || keyClean === "sno" || keyClean === "id" || keyClean === "_id") return false;
    if (v && typeof v === "object") return isAttachmentValue(v);
    return String(v || "").trim() !== "";
  });
};

export const isAuditorSection = (section) =>
  Boolean(
    section &&
    (
      section.ownerRole === "auditor" ||
      String(section.ownerRole || "").toLowerCase().includes("auditor") ||
      section.isAuditorSection === true ||
      section.auditorSection === true ||
      (typeof section.title === "string" && (
        section.title.toLowerCase().includes("observations") ||
        section.title.toLowerCase().includes("recommendations")
      )) ||
      (typeof section.id === "string" && (
        section.id.toLowerCase().includes("observation") ||
        section.id.toLowerCase().includes("auditor")
      ))
    )
  );

const safeJsonParse = (value, fallback = {}) => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const titleCase = (value = "") =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  if (!value) return "";
  try {
    return formatDateDDMMYYYY(value);
  } catch {
    return String(value);
  }
};

const normalizeCategory = (value = "") => String(value || "").toLowerCase().trim();
const normalizeStatus = (value = "") => String(value || "").toLowerCase().trim();

const normalizeAuditCycleCategory = (value = "") => {
  const v = String(value || "").toLowerCase().trim();
  if (v.includes("external")) return "external";
  return "internal";
};

const assignmentsForType = (assignments = [], auditorType = "") =>
  (Array.isArray(assignments) ? assignments : []).filter((assignment) =>
    normalizeCategory(assignment.auditorType || assignment.forwardedAuditorType || assignment.type || "").includes(auditorType) &&
    (
      assignment.status === "submitted" ||
      assignment.reviewStatus === "submitted" ||
      assignment.status === "completed" ||
      hasPartEValues(assignmentPartEValues(assignment)) ||
      Boolean(assignment.submittedAt || assignment.auditorReviewedOn)
    )
  );

const latestSubmittedAssignment = (assignments = []) =>
  [...assignments].sort((first, second) =>
    new Date(second.submittedAt || second.auditorReviewedOn || 0) -
    new Date(first.submittedAt || first.auditorReviewedOn || 0)
  )[0];

const getAuditorSignOff = (entry = {}) => {
  const e = entry || {};
  const signOff = e.values?.__auditSignOff || {};
  const auditedBy = signOff.auditedBy || signOff.auditorBy || {};
  return {
    name: auditedBy.name || e.auditorReviewedBy || "",
    designation: auditedBy.designation || e.auditorReviewedByDesignation || "",
    role: auditedBy.role || e.auditorReviewedByRole || "",
    email: auditedBy.email || e.auditorReviewedByEmail || "",
    date: auditedBy.date || e.auditorReviewedOn || "",
  };
};

export const buildAuditorSectionReview = (draft = {}, history = []) => {
  const status = normalizeStatus(draft.overallStatus || draft.status);
  const reportCategory = normalizeAuditCycleCategory(draft.reportCategory || draft.cycleType);
  const assignments = Array.isArray(draft.auditorAssignments) ? draft.auditorAssignments : [];

  const sortedHistory = [...history].sort((first, second) => Number(second.version || 0) - Number(first.version || 0));
  const previousInternal = sortedHistory.find((entry) =>
    (
      normalizeAuditCycleCategory(entry.reportCategory || entry.cycleType) === "internal" ||
      (reportCategory === "external" && Number(entry.version || 0) < Number(draft.version || 0))
    ) &&
    (hasPartEValues(entry.values) || (entry.tables && Object.keys(entry.tables).length > 0) || (entry.auditorAssignments && entry.auditorAssignments.length > 0))
  );

  const currentHasPartE = hasPartEValues(draft.values);

  if (reportCategory === "internal") {
    const rawInternalAssignments = assignmentsForType(assignments, "internal");
    const internalAssignments = [...rawInternalAssignments];

    if (internalAssignments.length === 0 && (status === "approved" || status === "auditor-completed") && (currentHasPartE || Boolean(draft.remarks))) {
      internalAssignments.push({
        auditorName: draft.auditorName || "Internal Auditor",
        auditorEmail: draft.auditorEmail || "",
        auditorType: "internal",
        school: draft.school || draft.schoolName || "",
        status: "submitted",
        submittedAt: draft.submittedAt || draft.auditorReviewedOn || "",
        values: draft.values || {},
        tables: draft.tables || safeJsonParse(draft.tablesData, {}),
        remarks: draft.remarks || "",
      });
    }

    const hasAnyInternalData = internalAssignments.length > 0;
    const firstAssignment = internalAssignments[0];

    return {
      isApproved: hasAnyInternalData || status === "approved" || status === "auditor-completed",
      reportCategory: "internal",
      internalAssignments,
      externalAssignments: [],
      internalValues: firstAssignment ? (firstAssignment.values || assignmentPartEValues(firstAssignment)) : {},
      internalTables: firstAssignment ? (firstAssignment.tables || safeJsonParse(firstAssignment.tablesData, {})) : {},
      internalRemarks: firstAssignment?.remarks || firstAssignment?.auditObservations || "",
      externalValues: {},
      externalTables: {},
      externalRemarks: "",
      iqacRemarks: (status === "approved" || status === "auditor-completed") ? (draft.remarks || "") : "",
      previousIqacRemarks: "",
      internalAuditor: firstAssignment ? assignmentAuditor(firstAssignment) : (status === "approved" ? getAuditorSignOff(draft) : null),
      externalAuditor: null,
      auditorAssignments: internalAssignments,
      previousInternalAssignments: internalAssignments,
    };
  }

  // External cycle:
  const currentInternalAssignments = assignmentsForType(assignments, "internal");
  const previousInternalAssignments = Array.isArray(previousInternal?.auditorAssignments)
    ? assignmentsForType(previousInternal.auditorAssignments, "internal")
    : [];

  const internalAssignments = currentInternalAssignments.length > 0
    ? currentInternalAssignments
    : previousInternalAssignments;

  if (
    internalAssignments.length === 0 &&
    previousInternal &&
    (hasPartEValues(previousInternal.values) || (previousInternal.tables && Object.keys(previousInternal.tables).length > 0) || Boolean(previousInternal.remarks))
  ) {
    internalAssignments.push({
      auditorName: previousInternal.auditorName || "Internal Auditor",
      auditorEmail: previousInternal.auditorEmail || "",
      auditorType: "internal",
      school: previousInternal.school || previousInternal.schoolName || "",
      status: "submitted",
      submittedAt: previousInternal.submittedAt || previousInternal.auditorReviewedOn || "",
      values: previousInternal.values || {},
      tables: previousInternal.tables || safeJsonParse(previousInternal.tablesData, {}),
      remarks: previousInternal.remarks || "",
    });
  }

  const rawExternalAssignments = assignmentsForType(assignments, "external");
  const externalAssignments = [...rawExternalAssignments];

  if (externalAssignments.length === 0 && (status === "approved" || status === "auditor-completed") && (currentHasPartE || Boolean(draft.remarks))) {
    externalAssignments.push({
      auditorName: draft.auditorName || "External Auditor",
      auditorEmail: draft.auditorEmail || "",
      auditorType: "external",
      school: draft.school || draft.schoolName || "",
      status: "submitted",
      submittedAt: draft.submittedAt || draft.auditorReviewedOn || "",
      values: draft.values || {},
      tables: draft.tables || safeJsonParse(draft.tablesData, {}),
      remarks: draft.remarks || "",
    });
  }

  const firstInternal = internalAssignments[0];
  const firstExternal = externalAssignments[0];
  const hasAnyData = internalAssignments.length > 0 || externalAssignments.length > 0;

  return {
    isApproved: hasAnyData || status === "approved" || status === "auditor-completed",
    reportCategory: "external",
    internalAssignments,
    externalAssignments,
    internalValues: firstInternal ? (firstInternal.values || assignmentPartEValues(firstInternal)) : {},
    internalTables: firstInternal ? (firstInternal.tables || safeJsonParse(firstInternal.tablesData, {})) : {},
    internalRemarks: firstInternal?.remarks || firstInternal?.auditObservations || previousInternal?.remarks || "",
    externalValues: firstExternal ? (firstExternal.values || assignmentPartEValues(firstExternal)) : {},
    externalTables: firstExternal ? (firstExternal.tables || safeJsonParse(firstExternal.tablesData, {})) : {},
    externalRemarks: firstExternal?.remarks || firstExternal?.auditObservations || "",
    iqacRemarks: (status === "approved" || status === "auditor-completed") ? (draft.remarks || "") : "",
    previousIqacRemarks: previousInternal?.remarks || "",
    internalAuditor: firstInternal ? assignmentAuditor(firstInternal) : getAuditorSignOff(previousInternal),
    externalAuditor: firstExternal ? assignmentAuditor(firstExternal) : (status === "approved" ? getAuditorSignOff(draft) : null),
    auditorAssignments: [...internalAssignments, ...externalAssignments],
    previousInternalAssignments: internalAssignments,
  };
};

const getCellValue = (row = {}, column = "", table = {}) => {
  if (!row || typeof row !== "object") return "";
  if (row[column] !== undefined && row[column] !== null && String(row[column]).trim() !== "") return row[column];

  const colLower = String(column).toLowerCase().trim();
  const colSlug = colLower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const colNoSpace = colLower.replace(/[^a-z0-9]+/g, "");

  // 1. Direct case-insensitive or slugified match on row keys
  const rowEntries = Object.entries(row);
  for (const [k, v] of rowEntries) {
    if (v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "")) {
      const kLower = String(k).toLowerCase().trim();
      const kSlug = kLower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const kNoSpace = kLower.replace(/[^a-z0-9]+/g, "");
      if (kLower === colLower || kSlug === colSlug || kNoSpace === colNoSpace) {
        return v;
      }
    }
  }

  // 2. Check table.fields definitions for label, fieldKey, id
  if (Array.isArray(table?.fields)) {
    const field = table.fields.find((f) => {
      if (!f) return false;
      const fLabel = String(f.label || "").toLowerCase().trim();
      const fKey = String(f.fieldKey || f.key || "").toLowerCase().trim();
      const fId = String(f.id || "").toLowerCase().trim();
      const fIdString = String(f.idString || "").toLowerCase().trim();
      return (
        fLabel === colLower ||
        fKey === colLower ||
        fKey === colSlug ||
        fId === colLower ||
        fIdString === colLower ||
        fLabel.replace(/[^a-z0-9]+/g, "") === colNoSpace
      );
    });
    if (field) {
      const candidateKeys = [field.fieldKey, field.key, field.label, field.idString, field.id];
      for (const ck of candidateKeys) {
        if (ck && row[ck] !== undefined && row[ck] !== null && (Array.isArray(row[ck]) ? row[ck].length > 0 : String(row[ck]).trim() !== "")) {
          return row[ck];
        }
      }
      for (const ck of candidateKeys) {
        if (!ck) continue;
        const ckLower = String(ck).toLowerCase().trim();
        const ckNoSpace = ckLower.replace(/[^a-z0-9]+/g, "");
        for (const [k, v] of rowEntries) {
          if (v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "")) {
            const kLower = String(k).toLowerCase().trim();
            const kNoSpace = kLower.replace(/[^a-z0-9]+/g, "");
            if (kLower === ckLower || kNoSpace === ckNoSpace) return v;
          }
        }
      }
    }
  }

  // 3. Serial column fallback
  const isSerial = Boolean(serialColumnFor([column]));
  if (isSerial) {
    for (const [k, v] of rowEntries) {
      const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (["srno", "sno", "sn", "id", "serialno", "serialnumber"].includes(kClean)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
    }
  }

  // 4. Default return
  if (row[column] !== undefined) return row[column];
  for (const [k, v] of rowEntries) {
    const kLower = String(k).toLowerCase().trim();
    if (kLower === colLower) return v;
  }
  return "";
};

const resolveTableColumns = (table = {}) => {
  const raw = (Array.isArray(table.columns) && table.columns.length > 0)
    ? table.columns
    : (Array.isArray(table.fields) && table.fields.length > 0)
      ? table.fields.map((f) => f.label || f.fieldKey || f.id)
      : [];
  return columnsWithSerial(raw);
};

function renderTableCellValue(rawValue) {
  const value = parseIfJson(rawValue);

  if (Array.isArray(value)) {
    return value.length ? (
      <div style={styles.attachmentList}>
        {value.map((file, index) => (
          <div key={`${file?.url || file?.name || "attachment"}-${index}`}>
            {renderTableCellValue(file)}
          </div>
        ))}
      </div>
    ) : "-";
  }

  if (isAttachmentValue(value)) {
    const name = value.name || value.fileName || value.filename || "Attachment";
    const url = value.url || value.publicUrl || value.downloadUrl;
    return url ? (
      <a href={getAttachmentUrl(url)} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
        {name}
      </a>
    ) : (
      <span>{name}</span>
    );
  }

  return value !== undefined && value !== null && String(value).trim() !== "" ? String(value).trim() : "-";
}

function ReadOnlyTable({ table, rows = [], values = {} }) {
  const columns = resolveTableColumns(table);
  const visibleRows = (Array.isArray(rows) && rows.length > 0)
    ? withSerialNumbers(columns, rows)
    : [numberedRowFor(columns, 0)];

  return (
    <div style={styles.readOnlyTableBlock}>
      {table.showTitle !== false && <h4 style={styles.readOnlyTableTitle}>{table.title}</h4>}
      {!!table.notes?.length && (
        <div style={styles.readOnlyNotes}>
          {table.notes.map((note) => (
            <div key={note}>{note}</div>
          ))}
        </div>
      )}
      <div style={styles.readOnlyScroller}>
        <table className="audit-data-table" style={styles.readOnlyTable}>
          <thead>
            <tr>
              {columns.map((column) => {
                const isSerial = Boolean(serialColumnFor([column]));
                return (
                  <th
                    key={column}
                    style={{
                      ...styles.readOnlyTh,
                      ...(isSerial ? { width: "65px", maxWidth: "70px", textAlign: "center" } : {}),
                    }}
                  >
                    {column}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={`${table.id || table.tableKey || "tbl"}-readonly-${rowIndex}`}>
                {columns.map((column) => {
                  const isSerial = Boolean(serialColumnFor([column]));
                  return (
                    <td
                      key={column}
                      style={{
                        ...styles.readOnlyTd,
                        ...(isSerial ? { width: "65px", maxWidth: "70px", textAlign: "center" } : {}),
                      }}
                    >
                      {renderTableCellValue(isSerial ? (row[column] || row["Sr. no"] || row["Sr.no"] || row["Sr No"] || String(rowIndex + 1)) : getCellValue(row, column, table))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldGrid({ fields, values, onFieldChange, readOnly = false, onUploadAttachment }) {
  return (
    <div className="audit-field-grid" style={styles.fieldGrid}>
      {fields.map((field) => {
        if (field.kind === "heading") {
          return (
            <h3 key={field.id} style={styles.subheading}>
              {field.label}
            </h3>
          );
        }

        const rawType = String(field.fieldType || field.type || "text").trim().toLowerCase();
        const isFile = rawType === "file" || rawType === "attachment" || rawType === "document";
        const val = resolveFieldValue(field, values);

        if (isFile) {
          const rawAttachments = resolveFieldValue(field, values);
          const attachments = Array.isArray(rawAttachments) ? rawAttachments : (rawAttachments ? [rawAttachments] : []);
          return (
            <div className="audit-field" key={field.id} style={styles.wideField}>
              <span style={styles.label}>{field.label}</span>
              {!readOnly && (
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="file"
                    multiple
                    className="audit-control"
                    style={styles.input}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      try {
                        if (onUploadAttachment) {
                          const uploaded = await onUploadAttachment(files);
                          onFieldChange(field.id, [...attachments, ...(Array.isArray(uploaded) ? uploaded : [uploaded])]);
                        } else {
                          const uploaded = await uploadAttachments(files);
                          onFieldChange(field.id, [...attachments, ...uploaded]);
                        }
                      } catch (err) {
                        console.error("Upload failed", err);
                      }
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
              {attachments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {attachments.map((file, idx) => {
                    const name = typeof file === "object" ? (file.name || file.fileName || "File") : String(file);
                    const url = typeof file === "object" ? (file.url || file.publicUrl || file.downloadUrl) : (String(file).startsWith("http") ? String(file) : null);
                    return (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13 }}>
                        <span>📎 {url ? <a href={getAttachmentUrl(url)} target="_blank" rel="noreferrer">{name}</a> : name}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontWeight: 700 }}
                            onClick={() => {
                              const updated = attachments.filter((_, i) => i !== idx);
                              onFieldChange(field.id, updated.length ? updated : "");
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <label className="audit-field" key={field.id} style={field.type === "textarea" ? styles.wideField : styles.field}>
            <span style={styles.label}>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                value={val}
                onChange={(event) => onFieldChange(field.id, event.target.value)}
                className="audit-control"
                style={styles.textarea}
                rows={4}
                readOnly={readOnly}
              />
            ) : field.type === "select" ? (
              <select
                value={val}
                onChange={(event) => onFieldChange(field.id, event.target.value)}
                className="audit-control"
                style={styles.input}
                disabled={readOnly}
              >
                <option value="">Select</option>
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "date" ? (
              <DateInput
                value={val}
                onChange={(value) => onFieldChange(field.id, value)}
                className="audit-control"
                style={styles.input}
                readOnly={readOnly}
              />
            ) : (
              <input
                value={val}
                onChange={(event) => onFieldChange(field.id, event.target.value)}
                className="audit-control"
                style={styles.input}
                type={field.type || "text"}
                readOnly={readOnly}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function TableList({ tableDefinitions, tableValues, values, onFieldChange, onTableChange, onAddRow, onDeleteLastRow, onUploadAttachment, onDeleteAttachment, readOnly = false }) {
  return (
    <div style={styles.tables}>
      {tableDefinitions.map((table) => {
        const tableKey = table.tableKey || table.idString || (table.id != null ? String(table.id) : "");
        const rows = tableValues[tableKey] || (table.id != null ? tableValues[table.id] : []) || (table.tableKey ? tableValues[table.tableKey] : []) || [];
        return (
          <AuditTable
            key={table.id || tableKey}
            table={table}
            rows={rows}
            values={values}
            onFieldChange={onFieldChange}
            onChange={(rowIndex, column, value) => onTableChange(tableKey, rowIndex, column, value)}
            onAddRow={onAddRow}
            onDeleteLastRow={onDeleteLastRow}
            onUploadAttachment={onUploadAttachment}
            onDeleteAttachment={onDeleteAttachment}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function ReadOnlyPartEValue({ value }) {
  if (Array.isArray(value)) {
    const attachments = value.filter(isAttachmentValue);
    if (attachments.length) {
      return (
        <div style={styles.attachmentList}>
          {attachments.map((file, index) => {
            const url = file.url || file.publicUrl || file.downloadUrl;
            const name = file.name || file.fileName || file.filename || "View attachment";
            return url ? (
              <a key={`${url}-${index}`} href={getAttachmentUrl(url)} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
                {name}
              </a>
            ) : (
              <span key={`${name}-${index}`}>{name}</span>
            );
          })}
        </div>
      );
    }

    return value.length ? <span>{value.join(", ")}</span> : <span style={styles.emptyText}>-</span>;
  }

  if (isAttachmentValue(value)) {
    const url = value.url || value.publicUrl || value.downloadUrl;
    const name = value.name || value.fileName || value.filename || "View attachment";
    return url ? (
      <a href={getAttachmentUrl(url)} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
        {name}
      </a>
    ) : (
      <span>{name}</span>
    );
  }

  const text = String(value || "").trim();
  return text ? <span style={styles.readOnlyText}>{text}</span> : <span style={styles.emptyText}>-</span>;
}

const isReviewRemarkField = (f) => {
  if (!f) return false;
  if (f.kind === "review") return true;
  const key = String(f.fieldKey || f.idString || f.id || "").toLowerCase();
  const label = String(f.label || "").toLowerCase();
  if (
    key === "reviewremarks" ||
    key === "review_remarks" ||
    key === "remarks" ||
    key === "auditobservations" ||
    key.includes("reviewremark") ||
    key.includes("review_remark")
  ) {
    return true;
  }
  if (
    label.includes("review remark") ||
    label.includes("review remarks") ||
    label.includes("review observation") ||
    label.includes("review observations") ||
    label.includes("remarks / observations") ||
    label.includes("remarks/observations") ||
    label.includes("observations of the audit")
  ) {
    return true;
  }
  return false;
};

function AuditorCard({ assignment, index, fieldDefinitions, tableDefinitions, fallbackAuditorType, allFormDataTables = {} }) {
  const values = safeObjectValue(assignment.values || assignmentPartEValues(assignment));
  const assignmentTables = safeObjectValue(
    assignment.tables ||
    (assignment.tablesData ? safeJsonParse(assignment.tablesData, {}) : (assignment.reviewTablesData ? safeJsonParse(assignment.reviewTablesData, {}) : assignment.reviewTables))
  );
  const remarks = assignment.remarks || assignment.auditObservations || values.remarks || values.auditObservations || "";
  const displayPost = assignment.school || assignment.post || "-";
  const visibleFields = (fieldDefinitions || []).filter((f) => f.kind !== "heading");
  const headerFields = visibleFields.filter((f) => !isReviewRemarkField(f));
  const reviewRemarkFields = visibleFields.filter((f) => isReviewRemarkField(f));
  const reviewRemarkField = reviewRemarkFields[0];
  const finalRemarks =
    (reviewRemarkField ? resolveFieldValue(reviewRemarkField, values) : "") ||
    remarks;

  return (
    <section key={assignment.key || index} style={styles.auditorReviewCard}>
      <div style={styles.auditorReviewCardHeader}>
        <div style={styles.auditorReviewIdentity}>
          <span style={styles.auditorReviewNumber}>Auditor {index + 1}</span>
          <div style={styles.auditorReviewNameBlock}>
            <h4 style={styles.auditorReviewTitle}>{assignment.auditorName || "Auditor Review"}</h4>
            {assignment.auditorEmail && <p style={styles.auditorReviewEmail}>{assignment.auditorEmail}</p>}
          </div>
        </div>
        <div style={styles.auditorReviewChips}>
          <span style={styles.auditorReviewChip}>{titleCase(assignment.auditorType || fallbackAuditorType || "auditor")}</span>
          <span style={styles.auditorReviewChip}>{displayPost}</span>
          <span style={styles.auditorProgressDone}>
            {assignment.submittedAt ? `Submitted ${formatDate(assignment.submittedAt)}` : "Submitted"}
          </span>
        </div>
      </div>

      {headerFields.length > 0 && (
        <div className="review-auditor-review-fields" style={styles.auditorReviewFieldGrid}>
          {headerFields.map((field) => (
            <div key={field.id} style={field.type === "file" ? styles.auditorReviewDocsField : styles.auditorReviewField}>
              <div style={styles.readOnlyLabel}>{field.label}</div>
              <div style={field.type === "file" ? styles.auditorReviewDocsValue : styles.auditorReviewValue}>
                <ReadOnlyPartEValue value={resolveFieldValue(field, values)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(tableDefinitions) && tableDefinitions.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {tableDefinitions.map((table) => {
            const tableKey = table.tableKey || table.idString || (table.id != null ? String(table.id) : "");
            const rows =
              (assignmentTables && (assignmentTables[table.id] || assignmentTables[tableKey])) ||
              getTableRows(assignmentTables, table) ||
              (allFormDataTables && (allFormDataTables[table.id] || allFormDataTables[tableKey])) ||
              getTableRows(allFormDataTables, table) ||
              [];
            return (
              <ReadOnlyTable
                key={`auditor-${index}-${table.id || tableKey || table.tableKey || table.idString}`}
                table={table}
                rows={rows}
                values={values}
              />
            );
          })}
        </div>
      )}

      {Boolean(finalRemarks && String(finalRemarks).trim()) && (
        <div style={{ marginTop: 14, width: "100%" }}>
          <div style={styles.auditorReviewDocsField}>
            <div style={styles.readOnlyLabel}>
              {reviewRemarkField?.label || "Review Remarks / Observations"}
            </div>
            <div style={styles.auditorReviewValue}>
              <ReadOnlyPartEValue value={finalRemarks} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function AuditorSectionReviewPanel({ section, review, tables = {}, values = {} }) {
  const rawTableDefinitions = (section.tables || []).concat(
    (section.blocks || []).flatMap((b) => (b.type === "tables" && Array.isArray(b.tables) ? b.tables : []))
  );
  const seenTables = new Set();
  const tableDefinitions = rawTableDefinitions.filter((t) => {
    const key = String(t?.id || t?.tableKey || t?.idString || t?.title || "").trim();
    if (!key || seenTables.has(key)) return false;
    seenTables.add(key);
    return true;
  });

  const rawFieldDefinitions = (section.fields || []).concat(
    (section.blocks || []).flatMap((b) => (b.type === "fields" && Array.isArray(b.fields) ? b.fields : []))
  );
  const seenFields = new Set();
  const fieldDefinitions = rawFieldDefinitions.filter((f) => {
    const key = String(f?.id || f?.name || f?.label || "").trim();
    if (!key || seenFields.has(key)) return false;
    seenFields.add(key);
    return true;
  });

  const internalAssignments = Array.isArray(review?.internalAssignments) && review.internalAssignments.length > 0
    ? review.internalAssignments
    : Array.isArray(review?.previousInternalAssignments) && review.previousInternalAssignments.length > 0
      ? review.previousInternalAssignments
      : (review?.auditorAssignments || []).filter((a) => normalizeCategory(a.auditorType || a.type || "").includes("internal"));

  if (
    internalAssignments.length === 0 &&
    (review?.internalAuditor?.name || review?.internalRemarks || (review?.internalValues && hasPartEValues(review.internalValues)))
  ) {
    internalAssignments.push({
      auditorName: review.internalAuditor?.name || "Internal Auditor",
      auditorEmail: review.internalAuditor?.email || "",
      auditorType: "internal",
      school: review.internalAuditor?.school || "",
      status: "submitted",
      submittedAt: review.internalAuditor?.submittedAt || "",
      values: review.internalValues || {},
      tables: (review.internalTables && Object.keys(review.internalTables).length > 0) ? review.internalTables : {},
      remarks: review.internalRemarks || "",
    });
  }

  const externalAssignments = Array.isArray(review?.externalAssignments) && review.externalAssignments.length > 0
    ? review.externalAssignments
    : (review?.auditorAssignments || []).filter((a) =>
        normalizeCategory(a.auditorType || a.type || "").includes("external") ||
        (review?.reportCategory === "external" && !normalizeCategory(a.auditorType || a.type || "").includes("internal"))
      );

  if (
    externalAssignments.length === 0 &&
    (
      review?.externalAuditor?.name ||
      review?.externalRemarks ||
      (review?.externalValues && (hasPartEValues(review.externalValues) || Object.keys(review.externalValues).length > 0)) ||
      (review?.externalTables && Object.keys(review.externalTables).length > 0)
    )
  ) {
    externalAssignments.push({
      auditorName: review.externalAuditor?.name || "External Auditor",
      auditorEmail: review.externalAuditor?.email || "",
      auditorType: "external",
      school: review.externalAuditor?.school || "",
      status: "submitted",
      submittedAt: review.externalAuditor?.submittedAt || "",
      values: review.externalValues || {},
      tables: (review.externalTables && Object.keys(review.externalTables).length > 0) ? review.externalTables : {},
      remarks: review.externalRemarks || "",
    });
  }

  const hasInternalData = internalAssignments.length > 0;
  const hasExternalData = externalAssignments.length > 0;
  const isExternalCycle = review?.reportCategory === "external";

  if (!hasInternalData && !hasExternalData) {
    const pendingText = `IQAC has not approved your form yet. ${section?.title ? `${section.title} audit` : "Auditor"} observations, recommendations, and IQAC review remarks will be displayed here once your form is reviewed and approved by IQAC.`;

    return (
      <div style={styles.pendingIqacCard}>
        <div style={styles.pendingIqacTitle}>IQAC Approval Pending</div>
        <div style={styles.pendingIqacMessage}>{pendingText}</div>
      </div>
    );
  }

  return (
    <div style={styles.partEReviewPanel}>
      {hasInternalData && (
        <div className="review-auditor-review-stack" style={styles.auditorReviewStack}>
          {internalAssignments.map((assignment, index) => (
            <AuditorCard
              key={assignment.key || `internal-${index}`}
              assignment={assignment}
              index={index}
              fieldDefinitions={fieldDefinitions}
              tableDefinitions={tableDefinitions}
              fallbackAuditorType="internal"
              allFormDataTables={tables}
            />
          ))}
        </div>
      )}

      {isExternalCycle && !hasExternalData && (
        <div style={styles.pendingIqacCard}>
          <div style={styles.pendingIqacTitle}>External Auditor Review Pending</div>
          <div style={styles.pendingIqacMessage}>
            Your form is currently in the external audit cycle and awaiting external auditor review submission.
          </div>
        </div>
      )}

      {hasExternalData && (
        <div className="review-auditor-review-stack" style={styles.auditorReviewStack}>
          {externalAssignments.map((assignment, index) => (
            <AuditorCard
              key={assignment.key || `external-${index}`}
              assignment={assignment}
              index={index}
              fieldDefinitions={fieldDefinitions}
              tableDefinitions={tableDefinitions}
              fallbackAuditorType="external"
              allFormDataTables={tables}
            />
          ))}
        </div>
      )}

      {(review?.iqacRemarks || review?.previousIqacRemarks) && (
        <div style={styles.partEReviewBlock}>
          <div style={styles.partEReviewHeader}>
            <h3 style={styles.partEReviewTitle}>
              {isExternalCycle && review?.iqacRemarks ? "IQAC External Audit Review Remarks" : "IQAC Review Remarks"}
            </h3>
          </div>
          <p style={styles.readOnlyText}>{review?.iqacRemarks || review?.previousIqacRemarks}</p>
        </div>
      )}
    </div>
  );
}

export default function AuditSection({ section, values, tables, onFieldChange, onTableChange, onAddRow, onDeleteLastRow, onUploadAttachment, onDeleteAttachment, readOnly = false, academicPartEReview = null }) {
  const blocks = section.blocks || [
    ...(section.fields?.length ? [{ type: "fields", fields: section.fields }] : []),
    ...(section.tables?.length ? [{ type: "tables", tables: section.tables }] : []),
  ];
  const isAuditorDesignated = isAuditorSection(section);
  const effectiveReadOnly = readOnly || isAuditorDesignated;

  return (
    <section className="audit-section-card" id={section.id} style={styles.section}>
      <div style={styles.headingRow}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={styles.heading}>{section.title}</h2>
          {Boolean(section.ownerRole === "auditor" || section.isAuditorSection === true || section.auditorSection === true) && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}>
              🔒 Auditor Section
            </span>
          )}
        </div>
      </div>

      {isAuditorDesignated ? (
        <AuditorSectionReviewPanel section={section} review={academicPartEReview} tables={tables} values={values} />
      ) : (
        blocks.map((block, index) => {
          if (block.type === "fields") {
            return <FieldGrid key={`fields-${index}`} fields={block.fields} values={values} onFieldChange={onFieldChange} readOnly={effectiveReadOnly} onUploadAttachment={onUploadAttachment} />;
          }

          return (
            <TableList
              key={`tables-${index}`}
              tableValues={tables}
              tableDefinitions={block.tables}
              values={values}
              onFieldChange={onFieldChange}
              onTableChange={onTableChange}
              onAddRow={onAddRow}
              onDeleteLastRow={onDeleteLastRow}
              onUploadAttachment={onUploadAttachment}
              onDeleteAttachment={onDeleteAttachment}
              readOnly={effectiveReadOnly}
            />
          );
        })
      )}
    </section>
  );
}

const styles = {
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 15,
    padding: 20,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 12px 35px rgba(15, 23, 42, 0.045)",
  },
  headingRow: {
    padding: "0 0 15px",
    borderBottom: "1px solid #edf1f6",
  },
  heading: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: "-.015em",
    lineHeight: 1.3,
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "18px 16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  wideField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    gridColumn: "1 / -1",
  },
  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 650,
  },
  subheading: {
    gridColumn: "1 / -1",
    margin: "8px 0 0",
    padding: 0,
    color: "#0f172a",
    background: "transparent",
    fontSize: 15,
    lineHeight: 1.35,
  },
  input: {
    width: "100%",
    minHeight: 42,
    border: "1px solid #d7dee9",
    borderRadius: 8,
    padding: "9px 11px",
    color: "#0f172a",
    background: "#fbfcfe",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 84,
    resize: "vertical",
    border: "1px solid #d7dee9",
    borderRadius: 8,
    padding: "9px 11px",
    color: "#0f172a",
    background: "#fbfcfe",
    outline: "none",
  },
  tables: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  pendingIqacCard: {
    padding: "20px 24px",
    border: "1px solid #fed7aa",
    borderRadius: 12,
    background: "#fff7ed",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  pendingIqacTitle: {
    color: "#c2410c",
    fontSize: 15,
    fontWeight: 750,
  },
  pendingIqacMessage: {
    color: "#9a3412",
    fontSize: 13.5,
    lineHeight: 1.5,
    fontWeight: 500,
  },
  partEReviewPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  auditorReviewStack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  auditorReviewCard: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: 8,
    background: "#fff",
    padding: 16,
    boxShadow: "0 8px 20px rgba(15, 23, 42, .045)",
    marginBottom: 16,
  },
  auditorReviewCardHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: 9,
    minHeight: 76,
    borderBottom: "1px solid #eef2f7",
    paddingBottom: 10,
  },
  auditorReviewIdentity: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  auditorReviewNumber: {
    flexShrink: 0,
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 9px",
    fontSize: 11,
    fontWeight: 900,
  },
  auditorReviewNameBlock: {
    minWidth: 0,
  },
  auditorReviewChips: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 6,
  },
  auditorReviewChip: {
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    padding: "5px 8px",
    fontSize: 10.5,
    fontWeight: 800,
  },
  auditorProgressDone: {
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#15803d",
    padding: "5px 8px",
    fontSize: 10.5,
    fontWeight: 800,
  },
  auditorReviewTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.25,
  },
  auditorReviewEmail: {
    margin: "2px 0 0",
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  auditorReviewFieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignContent: "start",
  },
  auditorReviewField: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  auditorReviewDocsField: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    gridColumn: "1 / -1",
  },
  auditorReviewValue: {
    width: "100%",
    minHeight: 78,
    maxHeight: 132,
    overflow: "auto",
    border: "1px solid #d7dee9",
    borderRadius: 8,
    padding: "9px 10px",
    color: "#0f172a",
    background: "#fbfcfe",
    fontSize: 12.5,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    lineHeight: 1.45,
  },
  auditorReviewDocsValue: {
    width: "100%",
    minHeight: 44,
    border: "1px solid #d7dee9",
    borderRadius: 8,
    padding: 8,
    background: "#fbfcfe",
  },
  readOnlyLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 750,
  },
  partEReviewBlock: {
    padding: 16,
    border: "1px solid #dbe3ef",
    borderRadius: 12,
    background: "#f8fafc",
  },
  partEReviewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: "1px solid #e2e8f0",
  },
  partEReviewTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 800,
  },
  partEReviewMeta: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 700,
  },
  partEReviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  partEReviewField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  partEReviewLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 750,
  },
  readOnlyText: {
    margin: 0,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
  attachmentList: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
  },
  attachmentLink: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 750,
    textDecoration: "none",
  },
  historyReference: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    background: "#f8fbff",
    overflow: "hidden",
    boxShadow: "0 6px 18px rgba(37, 99, 235, .05)",
  },
  historyReferenceSummary: {
    padding: "14px 18px",
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #bfdbfe",
  },
  historyReferenceMeta: {
    fontSize: 12,
    fontWeight: 700,
    color: "#2563eb",
  },
  historyReferenceBody: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  readOnlyTableBlock: {
    marginTop: 8,
  },
  readOnlyTableTitle: {
    margin: "0 0 9px",
    padding: 0,
    color: "#0f172a",
    background: "transparent",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  readOnlyNotes: {
    margin: "0 0 8px",
    color: "#334155",
    fontSize: 12,
    lineHeight: 1.6,
  },
  readOnlyScroller: {
    overflowX: "auto",
    border: "1px solid #d7dee8",
  },
  readOnlyTable: {
    width: "100%",
    minWidth: 0,
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  readOnlyTh: {
    padding: "10px 11px",
    borderBottom: "1px solid #334155",
    borderRight: "1px solid #3a465b",
    background: "#1e293b",
    color: "#f8fafc",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: ".025em",
    textAlign: "left",
    verticalAlign: "top",
  },
  readOnlyTd: {
    padding: "8px 9px",
    borderBottom: "1px solid #dfe5ec",
    borderRight: "1px solid #dfe5ec",
    color: "#0f172a",
    fontSize: 12.5,
    verticalAlign: "top",
    whiteSpace: "pre-wrap",
  },
};
