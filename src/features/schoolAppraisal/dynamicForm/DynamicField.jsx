import React from 'react';
import { uploadAttachments } from '../../../api/submissions';

export const DynamicField = ({ field, value, onChange, readOnly = false, error = null }) => {
  if (!field) return null;

  const {
    fieldKey,
    idString,
    label,
    fieldType = 'TEXT',
    kind,
    isRequired = false,
    placeholder = '',
    options = [],
    validationRules = {},
  } = field;

  const key = fieldKey || idString || 'field';
  const displayLabel = label || key;

  if (kind === 'heading') {
    return (
      <div className="dynamic-field-heading my-3">
        <h5 className="text-primary fw-bold">{displayLabel}</h5>
      </div>
    );
  }

  const handleChange = (e) => {
    onChange(key, e.target.value);
  };

  switch (fieldType.toUpperCase()) {
    case 'FILE':
    case 'ATTACHMENT': {
      const fileList = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          {!readOnly && (
            <div className="mb-2">
              <input
                type="file"
                multiple
                className={`form-control ${error ? 'is-invalid' : ''}`}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  try {
                    const uploaded = await uploadAttachments(files);
                    const combined = [...fileList, ...uploaded];
                    onChange(key, combined);
                  } catch (err) {
                    console.error('File upload error:', err);
                  }
                  e.target.value = '';
                }}
              />
              <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                PDF, Excel, Word, images, ZIP, or any supporting file.
              </div>
            </div>
          )}
          {fileList.length > 0 && (
            <div className="d-flex flex-column gap-1 mt-1">
              {fileList.map((item, idx) => {
                const name = typeof item === 'object' ? (item.name || item.fileName || 'Attached file') : String(item);
                const url = typeof item === 'object' ? (item.url || item.publicUrl || item.downloadUrl) : (String(item).startsWith('http') ? String(item) : null);
                return (
                  <div key={idx} className="d-flex align-items-center justify-content-between p-1 px-2 border rounded bg-light" style={{ fontSize: '12.5px' }}>
                    <span className="text-truncate" style={{ maxWidth: '80%' }}>
                      📎 {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                          {name}
                        </a>
                      ) : (
                        name
                      )}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-0"
                        onClick={() => {
                          const updated = fileList.filter((_, i) => i !== idx);
                          onChange(key, updated.length > 0 ? updated : '');
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
          {error && <div className="invalid-feedback d-block">{error}</div>}
        </div>
      );
    }

    case 'TEXTAREA':
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <textarea
            className={`form-control ${error ? 'is-invalid' : ''}`}
            rows={3}
            placeholder={placeholder}
            disabled={readOnly}
            maxLength={validationRules?.maxLength || 2000}
            value={value ?? ''}
            onChange={handleChange}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );

    case 'SELECT':
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <select
            className={`form-select ${error ? 'is-invalid' : ''}`}
            disabled={readOnly}
            value={value ?? ''}
            onChange={handleChange}
          >
            <option value="">-- Select --</option>
            {options && options.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );

    case 'NUMBER':
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <input
            type="number"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            placeholder={placeholder}
            disabled={readOnly}
            min={validationRules?.min}
            max={validationRules?.max}
            value={value ?? ''}
            onChange={handleChange}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );

    case 'DATE':
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <input
            type="date"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            disabled={readOnly}
            value={value ?? ''}
            onChange={handleChange}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );

    case 'EMAIL':
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <input
            type="email"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            placeholder={placeholder || 'example@domain.com'}
            disabled={readOnly}
            value={value ?? ''}
            onChange={handleChange}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );

    case 'URL':
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <input
            type="url"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            placeholder={placeholder || 'https://...'}
            disabled={readOnly}
            value={value ?? ''}
            onChange={handleChange}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );

    case 'TEXT':
    default:
      return (
        <div className="dynamic-field form-group mb-3">
          <label className="form-label fw-semibold">
            {displayLabel} {isRequired && <span className="text-danger">*</span>}
          </label>
          <input
            type="text"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            placeholder={placeholder}
            disabled={readOnly}
            value={value ?? ''}
            onChange={handleChange}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
      );
  }
};
