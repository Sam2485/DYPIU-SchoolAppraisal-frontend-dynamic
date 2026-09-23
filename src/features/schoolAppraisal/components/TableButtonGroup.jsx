import { confirmAction } from "../../../components/feedback/feedbackBus";
import React, { useState, useEffect, useMemo } from 'react';
import {
  getActiveInstancesForButton,
  buildScopedTableKey,
  buildButtonInstancesKey,
  getSectionKey,
} from '../utils/tableButtonHelpers';

/**
 * Component that renders a button-triggered group of tables with dropdown switcher.
 * Only the tables for the currently selected dropdown instance are displayed.
 */
export const TableButtonGroup = ({
  button,
  tables = [],
  valuesData = {},
  tablesData = {},
  onValueChange,
  onTableChange,
  renderTable,
  readOnly = false,
  section,
  sectionKey,
  role,
  auditorType,
  school,
}) => {
  if (!button || !tables || tables.length === 0) return null;

  const context = useMemo(() => ({
    section,
    sectionKey: sectionKey || getSectionKey(section),
    role: role || (auditorType ? (String(auditorType).toLowerCase().includes('ext') ? 'external' : 'internal') : 'director'),
    auditorType,
    school,
  }), [section, sectionKey, role, auditorType, school]);

  const instancesKey = buildButtonInstancesKey(button, context);
  const discoveredInstances = getActiveInstancesForButton(button, valuesData, tablesData, context);
  const [instances, setInstances] = useState(discoveredInstances);
  const [selectedInstance, setSelectedInstance] = useState(discoveredInstances[0] || '');

  const dropdownOptions = useMemo(() => {
    if (Array.isArray(button?.dropdownOptions)) {
      return button.dropdownOptions;
    }
    if (typeof button?.dropdownOptions === 'string') {
      return button.dropdownOptions.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [button?.dropdownOptions]);

  const remainingOptions = dropdownOptions.filter((opt) => !instances.includes(opt));
  const [optionToAdd, setOptionToAdd] = useState('');

  // Keep instances in sync if discoveredInstances changes from parent
  useEffect(() => {
    const fresh = getActiveInstancesForButton(button, valuesData, tablesData, context);
    setInstances(fresh);
    if (!fresh.includes(selectedInstance)) {
      setSelectedInstance(fresh[0] || '');
    }
  }, [button, valuesData, tablesData, context]);

  // Keep optionToAdd reset if current optionToAdd is no longer available
  useEffect(() => {
    if (optionToAdd && !remainingOptions.includes(optionToAdd)) {
      setOptionToAdd('');
    }
  }, [instances, dropdownOptions]);

  const handleAddInstance = (targetOption) => {
    const opt = targetOption || optionToAdd;
    if (!opt || instances.includes(opt)) return;

    const nextInstances = [...instances, opt];
    setInstances(nextInstances);
    setSelectedInstance(opt);
    setOptionToAdd('');

    if (onValueChange) {
      onValueChange(instancesKey, nextInstances);
      const legacyKey = `__tb_${button.id}_instances`;
      if (legacyKey !== instancesKey) {
        onValueChange(legacyKey, nextInstances);
      }
    }
  };

  const handleRemoveInstance = async () => {
    if (!selectedInstance) return;
    const confirmMsg = `Are you sure you want to remove "${selectedInstance}" and all its entered table data?`;
    if (!(await confirmAction(confirmMsg, { tone: 'danger', confirmLabel: 'Remove' }))) return;

    const nextInstances = instances.filter((i) => i !== selectedInstance);
    setInstances(nextInstances);
    const nextSelected = nextInstances[0] || '';
    setSelectedInstance(nextSelected);

    if (onValueChange) {
      onValueChange(instancesKey, nextInstances);
      const legacyKey = `__tb_${button.id}_instances`;
      if (legacyKey !== instancesKey) {
        onValueChange(legacyKey, nextInstances);
      }
    }

    // Clear data for this instance across all assigned tables
    if (onTableChange) {
      tables.forEach((tbl) => {
        const baseKey = tbl.tableKey || tbl.idString || (tbl.id != null ? String(tbl.id) : '');
        const scopedKey = buildScopedTableKey(baseKey, selectedInstance, context);
        onTableChange(scopedKey, null);
      });
    }
  };

  // 1. Initial State: No instances added yet
  if (instances.length === 0) {
    if (readOnly) {
      return (
        <div
          style={{
            margin: '16px 0',
            padding: '14px 18px',
            background: 'var(--bg)',
            border: '1px dashed var(--border-strong)',
            borderRadius: "var(--radius-md)",
            color: 'var(--muted)',
            fontSize: "var(--text-base)",
            display: 'flex',
            alignItems: 'center',
            gap: "var(--space-3)",
          }}
        >
          <span>ℹ️</span>
          <span>
            No entries added for <strong>{button.label || 'Dynamic Section'}</strong> ({button.dropdownLabel || 'records'}).
          </span>
        </div>
      );
    }

    return (
      <div
        style={{
          margin: '20px 0',
          padding: '20px 24px',
          background: 'var(--bg)',
          border: '1.5px dashed #93c5fd',
          borderRadius: "var(--radius-lg)",
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-3)" }}>⚡</div>
        <h5 style={{ margin: '0 0 6px', fontWeight: 800, color: '#1e3a8a', fontSize: "var(--text-md)" }}>
          {button.label || 'Add Tables'}
        </h5>
        <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: "var(--text-base)" }}>
          {tables.length} table(s) configured for this section. Click below to add your first {button.dropdownLabel || 'entry'}.
        </p>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: "var(--space-3)", flexWrap: 'wrap', justifyContent: 'center' }}>
          {dropdownOptions.length > 0 && (
            <select
              value={optionToAdd}
              onChange={(e) => setOptionToAdd(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid #93c5fd',
                background: 'var(--card)',
                fontSize: "var(--text-base)",
                fontWeight: 650,
                color: optionToAdd ? '#1e3a8a' : 'var(--muted)',
                outline: 'none',
              }}
            >
              <option value="" disabled>
                {button.dropdownLabel ? `-- ${button.dropdownLabel} --` : '-- Select School --'}
              </option>
              {dropdownOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            disabled={!optionToAdd}
            onClick={() => handleAddInstance(optionToAdd)}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: "var(--radius-sm)",
              border: 'none',
              background: optionToAdd ? 'var(--primary)' : 'var(--faint)',
              color: 'var(--card)',
              fontWeight: 700,
              fontSize: "var(--text-base)",
              cursor: optionToAdd ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: "var(--space-2)",
              boxShadow: optionToAdd ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
            }}
          >
            <span>➕</span>
            <span>{button.label || `Add ${button.dropdownLabel || 'Section'}`}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Active State: Toolbar with switcher dropdown + current instance's tables
  return (
    <div style={{ margin: '24px 0' }}>
      {/* Repeater Group Switcher Toolbar */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg) 100%)',
          border: '1.5px solid var(--accent-border)',
          borderRadius: "var(--radius-lg)",
          padding: '12px 18px',
          marginBottom: "var(--space-7)",
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: "var(--space-5)",
          boxShadow: '0 2px 6px rgba(37,99,235,0.06)',
        }}
      >
        {/* Left: Dropdown Instance Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)", flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-lg)" }}>📂</span>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 800, color: '#1e3a8a' }}>
              {button.dropdownLabel || 'Viewing'}:
            </span>
          </div>

          <select
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: "var(--radius-sm)",
              border: '1.5px solid #3b82f6',
              background: 'var(--card)',
              fontSize: "var(--text-base)",
              fontWeight: 800,
              color: 'var(--primary-dark)',
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {instances.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
              </option>
            ))}
          </select>

          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: "var(--radius-pill)",
              background: '#dbeafe',
              color: '#1e40af',
            }}
          >
            {instances.indexOf(selectedInstance) + 1} of {instances.length} added
          </span>
        </div>

        {/* Right: Actions (+ Add Another, Remove) */}
        {!readOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", flexWrap: 'wrap' }}>
            {remainingOptions.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: "var(--space-2)" }}>
                <select
                  value={optionToAdd}
                  onChange={(e) => setOptionToAdd(e.target.value)}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: "var(--radius-sm)",
                    border: '1px solid var(--border-strong)',
                    background: 'var(--card)',
                    fontSize: "var(--text-base)",
                    fontWeight: 650,
                    color: optionToAdd ? '#334155' : 'var(--faint)',
                    outline: 'none',
                  }}
                >
                  <option value="" disabled>
                    {button.dropdownLabel ? `-- ${button.dropdownLabel} --` : '-- Select School --'}
                  </option>
                  {remainingOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!optionToAdd}
                  onClick={() => handleAddInstance(optionToAdd)}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: "var(--radius-sm)",
                    border: optionToAdd ? '1px solid #93c5fd' : '1px solid var(--border)',
                    background: optionToAdd ? 'var(--primary)' : 'var(--border-strong)',
                    color: 'var(--card)',
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    cursor: optionToAdd ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: "var(--space-1)",
                  }}
                  title={optionToAdd ? `Add ${optionToAdd} to this section` : `Select an option to add`}
                >
                  <span>➕ {button.label || `Add ${button.dropdownLabel || 'Option'}`}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleRemoveInstance}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--red-200)',
                background: 'var(--card)',
                color: 'var(--red-600)',
                fontWeight: 650,
                fontSize: "var(--text-base)",
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: "var(--space-1)",
              }}
              title={`Remove ${selectedInstance} from this section`}
            >
              <span>🗑️</span>
              <span>Remove {selectedInstance}</span>
            </button>
          </div>
        )}
      </div>

      {/* Render Assigned Tables Scoped to Selected Instance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-8)" }}>
        {tables.map((tbl, idx) => {
          const baseKey = tbl.tableKey || tbl.idString || (tbl.id != null ? String(tbl.id) : `table_${idx}`);
          const scopedKey = buildScopedTableKey(baseKey, selectedInstance, context);
          const scopedTable = {
            ...tbl,
            originalTitle: tbl.title,
            title: `${tbl.title || `Table ${idx + 1}`} (${selectedInstance})`,
            scopedKey,
          };

          if (typeof renderTable === 'function') {
            return (
              <React.Fragment key={scopedKey}>
                {renderTable(scopedTable, scopedKey, selectedInstance, readOnly)}
              </React.Fragment>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};
