//renders a section of the audit form, like part A, part B, etc. It can contain fields and tables
import AuditTable from "./AuditTable";
import DateInput from "./DateInput";
import { columnsWithSerial, serialColumnFor } from "./tableHelpers";
import { getAttachmentUrl } from "../../../utils/attachment";

const ACADEMIC_PART_E_SECTION_ID = "part-e-observations";

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
    const found = tableEntries.find(([entryKey]) => String(entryKey).toLowerCase().trim() === kLower);
    if (found && Array.isArray(found[1])) return found[1];
  }
  return [];
};

const getCellValue = (row = {}, column = "", table = {}) => {
  if (!row || typeof row !== "object") return "";
  if (row[column] !== undefined) return row[column];

  const colLower = String(column).toLowerCase().trim();
  const rowEntries = Object.entries(row);
  const found = rowEntries.find(([k]) => String(k).toLowerCase().trim() === colLower);
  if (found && found[1] !== undefined) return found[1];

  if (Array.isArray(table?.fields)) {
    const field = table.fields.find((f) =>
      String(f.label || "").toLowerCase().trim() === colLower ||
      String(f.fieldKey || "").toLowerCase().trim() === colLower ||
      String(f.id || "").toLowerCase().trim() === colLower
    );
    if (field) {
      if (field.fieldKey && row[field.fieldKey] !== undefined) return row[field.fieldKey];
      if (field.label && row[field.label] !== undefined) return row[field.label];
      if (field.id && row[field.id] !== undefined) return row[field.id];
    }
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
    ? rows
    : [columns.reduce((row, column) => ({ ...row, [column]: "" }), {})];

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
                      {renderTableCellValue(getCellValue(row, column, table))}
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

function FieldGrid({ fields, values, onFieldChange, readOnly = false }) {
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

        return (
          <label className="audit-field" key={field.id} style={field.type === "textarea" ? styles.wideField : styles.field}>
            <span style={styles.label}>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                value={values[field.id] ?? ""}
                onChange={(event) => onFieldChange(field.id, event.target.value)}
                className="audit-control"
                style={styles.textarea}
                rows={4}
                readOnly={readOnly}
              />
            ) : field.type === "select" ? (
              <select
                value={values[field.id] ?? ""}
                onChange={(event) => onFieldChange(field.id, event.target.value)}
                className="audit-control"
                style={styles.input}
                disabled={readOnly}
              >
                <option value="">Select</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "date" ? (
              <DateInput
                value={values[field.id] ?? ""}
                onChange={(value) => onFieldChange(field.id, value)}
                className="audit-control"
                style={styles.input}
                readOnly={readOnly}
              />
            ) : (
              <input
                value={values[field.id] ?? ""}
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

function AuditorSectionReviewPanel({ section, review, tables = {}, values = {} }) {
  const tableDefinitions = (section.tables || []).concat(
    (section.blocks || []).flatMap((b) => (b.type === "tables" && Array.isArray(b.tables) ? b.tables : []))
  );
  const fieldDefinitions = (section.fields || []).concat(
    (section.blocks || []).flatMap((b) => (b.type === "fields" && Array.isArray(b.fields) ? b.fields : []))
  );

  const internalValues = review?.internalValues || {};
  const internalTables = review?.internalTables || {};
  const internalRemarks = review?.internalRemarks || internalValues.remarks || internalValues.auditObservations || "";
  const externalValues = review?.externalValues || {};
  const externalTables = review?.externalTables || tables || {};
  const externalRemarks = review?.externalRemarks || externalValues.remarks || externalValues.auditObservations || "";

  const hasInternalTables = tableDefinitions.some((t) => {
    const rows = getTableRows(internalTables, t);
    return Array.isArray(rows) && rows.length > 0 && rows.some((r) => Object.values(r).some((v) => String(v || "").trim() !== ""));
  });
  const hasInternalFields = hasPartEValues(internalValues);
  const hasInternalData = hasInternalTables || hasInternalFields || Boolean(internalRemarks);

  const hasExternalTables = tableDefinitions.some((t) => {
    const rows = getTableRows(externalTables, t);
    return Array.isArray(rows) && rows.length > 0 && rows.some((r) => Object.values(r).some((v) => String(v || "").trim() !== ""));
  });
  const hasExternalFields = hasPartEValues(externalValues);
  const hasExternalData = (hasExternalTables || hasExternalFields || Boolean(externalRemarks));

  if (!hasInternalData && !hasExternalData) {
    return (
      <div style={styles.partEReviewPanel}>
        <div style={{ padding: "14px 18px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", color: "#92400e", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>🔒</span>
          <div>
            <strong>Designated for Auditor:</strong> This section is designated to be filled exclusively by the Auditor during the audit review stage. Submitter inputs are locked.
          </div>
        </div>
        {fieldDefinitions.length > 0 && (
          <FieldGrid fields={fieldDefinitions} values={values} onFieldChange={() => {}} readOnly={true} />
        )}
        {tableDefinitions.map((table) => (
          <ReadOnlyTable key={table.id || table.tableKey || table.idString} table={table} rows={getTableRows(tables, table)} values={values} />
        ))}
      </div>
    );
  }

  return (
    <div style={styles.partEReviewPanel}>
      {hasInternalData && (
        <details open style={styles.historyReference}>
          <summary style={styles.historyReferenceSummary}>
            Internal Auditor Review
            <span style={styles.historyReferenceMeta}>
              {review?.internalAuditor?.name ? `${review.internalAuditor.name} · ` : ""}Internal Audit V1
            </span>
          </summary>
          <div style={styles.historyReferenceBody}>
            {internalRemarks && (
              <div style={styles.partEReviewBlock}>
                <h4 style={styles.partEReviewTitle}>Internal Auditor Review Remarks / Observations</h4>
                <p style={styles.readOnlyText}>{internalRemarks}</p>
              </div>
            )}
            {fieldDefinitions.length > 0 && hasInternalFields && (
              <div style={styles.partEReviewBlock}>
                <h4 style={styles.partEReviewTitle}>Internal Auditor Observations</h4>
                <FieldGrid fields={fieldDefinitions} values={internalValues} onFieldChange={() => {}} readOnly={true} />
              </div>
            )}
            {tableDefinitions.map((table) => {
              const rows = getTableRows(internalTables, table);
              return (
                <div key={`internal-${table.id || table.tableKey || table.idString}`} style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", background: "#dbeafe", padding: "4px 10px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
                      Internal Auditor Reference Table (Read-Only)
                    </span>
                  </div>
                  <ReadOnlyTable table={table} rows={rows} values={internalValues} />
                </div>
              );
            })}
            {review?.previousIqacRemarks && (
              <div style={styles.partEReviewBlock}>
                <h4 style={styles.partEReviewTitle}>IQAC Internal Audit Review Remarks</h4>
                <p style={styles.readOnlyText}>{review.previousIqacRemarks}</p>
              </div>
            )}
          </div>
        </details>
      )}

      {(review?.reportCategory === "external" || hasExternalData) && (
        <div style={{ ...styles.partEReviewBlock, background: "#fff", border: "1px solid #e2e8f0" }}>
          <div style={styles.partEReviewHeader}>
            <h3 style={styles.partEReviewTitle}>External Auditor Review</h3>
            {review?.externalAuditor?.name && (
              <span style={styles.partEReviewMeta}>{review.externalAuditor.name} · External Audit</span>
            )}
          </div>
          {hasExternalData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {tableDefinitions.map((table) => {
                const rows = getTableRows(externalTables, table);
                return (
                  <div key={`external-${table.id || table.tableKey || table.idString}`} style={{ marginBottom: 16 }}>
                    {hasInternalData && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "4px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                          External Auditor Table (Read-Only)
                        </span>
                      </div>
                    )}
                    <ReadOnlyTable table={table} rows={rows} values={externalValues} />
                  </div>
                );
              })}
              {fieldDefinitions.length > 0 && hasExternalFields && (
                <FieldGrid fields={fieldDefinitions} values={externalValues} onFieldChange={() => {}} readOnly={true} />
              )}
              {externalRemarks && (
                <div style={styles.partEReviewField}>
                  <span style={styles.partEReviewLabel}>Auditor Review Remarks / Observations</span>
                  <p style={styles.readOnlyText}>{externalRemarks}</p>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.pendingIqacCard}>
              <div style={styles.pendingIqacMessage}>
                Your form has not been reviewed by external auditor yet.
              </div>
            </div>
          )}
        </div>
      )}

      {review?.iqacRemarks && (
        <div style={styles.partEReviewBlock}>
          <div style={styles.partEReviewHeader}>
            <h3 style={styles.partEReviewTitle}>
              {review?.reportCategory === "external" ? "IQAC External Audit Review Remarks" : "IQAC Review Remarks"}
            </h3>
          </div>
          <p style={styles.readOnlyText}>{review.iqacRemarks}</p>
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
  const isAuditorDesignated = section.ownerRole === "auditor" || section.isAuditorSection === true;
  const isPartESection = section.id === ACADEMIC_PART_E_SECTION_ID || isAuditorDesignated;
  const effectiveReadOnly = readOnly || isAuditorDesignated;

  return (
    <section className="audit-section-card" id={section.id} style={styles.section}>
      <div style={styles.headingRow}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={styles.heading}>{section.title}</h2>
          {isAuditorDesignated && (
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
            return <FieldGrid key={`fields-${index}`} fields={block.fields} values={values} onFieldChange={onFieldChange} readOnly={effectiveReadOnly} />;
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
