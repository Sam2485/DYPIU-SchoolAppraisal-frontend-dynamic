import React from 'react';
import { DynamicField } from './DynamicField';
import { DynamicTable } from './DynamicTable';

export const DynamicSection = ({
  section,
  valuesData = {},
  tablesData = {},
  onValueChange,
  onTableChange,
  readOnly = false,
  errors = {},
  onUploadAttachment = null,
}) => {
  if (!section) return null;

  const {
    idString,
    sectionKey,
    title,
    number,
    description,
    ownerRole,
    isAuditorSection,
    fields = [],
    tables = [],
  } = section;

  const isAuditorDesignated = ownerRole === 'auditor' || isAuditorSection === true;
  const effectiveReadOnly = readOnly || isAuditorDesignated;

  const isReviewRemarkField = (f) => {
    if (!f) return false;
    if (f.kind === 'review') return true;
    const key = String(f.fieldKey || f.idString || f.id || '').toLowerCase();
    const label = String(f.label || '').toLowerCase();
    if (
      key === 'reviewremarks' ||
      key === 'review_remarks' ||
      key.includes('reviewremark') ||
      key.includes('review_remark')
    ) {
      return true;
    }
    if (
      label.includes('review remark') ||
      label.includes('review remarks') ||
      label.includes('review observation') ||
      label.includes('review observations')
    ) {
      return true;
    }
    return false;
  };

  const headerFields = (fields || []).filter((f) => !isReviewRemarkField(f));
  const reviewFields = (fields || []).filter((f) => isReviewRemarkField(f));

  return (
    <div className="dynamic-section mb-5">
      <div className="section-header bg-primary text-white p-3 rounded mb-4 shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h4 className="mb-0 fw-bold">
            {number ? `Section ${number}: ` : ''}
            {title}
          </h4>
          {description && <p className="mb-0 mt-1 small opacity-75">{description}</p>}
        </div>
        {isAuditorDesignated && (
          <span className="badge bg-warning text-dark px-3 py-2 fw-bold">
            🔒 Auditor Section
          </span>
        )}
      </div>

      {isAuditorDesignated && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-4">
          <span className="fs-5">🔒</span>
          <div>
            <strong>Auditor Section:</strong> This section is designated to be filled exclusively by the Auditor during the audit review stage. Submitter inputs are locked.
          </div>
        </div>
      )}

      {/* Top-level header fields */}
      {headerFields && headerFields.length > 0 && (
        <div className="card mb-4 shadow-sm border-0">
          <div className="card-body">
            <div className="row g-3">
              {headerFields.map((field) => {
                const key = field.fieldKey || field.idString;
                return (
                  <div key={field.id || key} className="col-md-6 col-12">
                    <DynamicField
                      field={field}
                      value={valuesData[key]}
                      onChange={onValueChange}
                      readOnly={effectiveReadOnly}
                      error={errors[key]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tables in section */}
      {tables && tables.length > 0 && (
        <div className="section-tables">
          {tables.map((table) => {
            const tKey = table.tableKey || table.idString;
            return (
              <DynamicTable
                key={table.id || tKey}
                table={table}
                data={tablesData[tKey] || []}
                onChange={onTableChange}
                readOnly={effectiveReadOnly}
                onUploadAttachment={onUploadAttachment}
              />
            );
          })}
        </div>
      )}

      {/* Review Remarks / Bottom Auditor Fields */}
      {reviewFields && reviewFields.length > 0 && (
        <div className="card mt-4 mb-4 shadow-sm border-0">
          <div className="card-header bg-light py-2 px-3 fw-bold d-flex align-items-center gap-2">
            <span>📝</span>
            <span>Review Remarks & Observations</span>
          </div>
          <div className="card-body">
            <div className="row g-3">
              {reviewFields.map((field) => {
                const key = field.fieldKey || field.idString;
                return (
                  <div key={field.id || key} className="col-12">
                    <DynamicField
                      field={field}
                      value={valuesData[key]}
                      onChange={onValueChange}
                      readOnly={effectiveReadOnly}
                      error={errors[key]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
