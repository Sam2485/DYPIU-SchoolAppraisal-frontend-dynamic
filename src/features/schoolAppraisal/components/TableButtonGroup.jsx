import React, { useState, useEffect } from 'react';
import {
  getActiveInstancesForButton,
  buildScopedTableKey,
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
}) => {
  if (!button || !tables || tables.length === 0) return null;

  const instancesKey = `__tb_${button.id}_instances`;
  const discoveredInstances = getActiveInstancesForButton(button, valuesData, tablesData);
  const [instances, setInstances] = useState(discoveredInstances);
  const [selectedInstance, setSelectedInstance] = useState(discoveredInstances[0] || '');

  const dropdownOptions = Array.isArray(button.dropdownOptions)
    ? button.dropdownOptions
    : typeof button.dropdownOptions === 'string'
    ? button.dropdownOptions.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const remainingOptions = dropdownOptions.filter((opt) => !instances.includes(opt));
  const [optionToAdd, setOptionToAdd] = useState(remainingOptions[0] || dropdownOptions[0] || '');

  // Keep instances in sync if discoveredInstances changes from parent
  useEffect(() => {
    const fresh = getActiveInstancesForButton(button, valuesData, tablesData);
    setInstances(fresh);
    if (!fresh.includes(selectedInstance)) {
      setSelectedInstance(fresh[0] || '');
    }
  }, [button, valuesData, tablesData]);

  // Keep optionToAdd valid
  useEffect(() => {
    const remaining = dropdownOptions.filter((opt) => !instances.includes(opt));
    if (remaining.length > 0 && !remaining.includes(optionToAdd)) {
      setOptionToAdd(remaining[0]);
    }
  }, [instances, dropdownOptions]);

  const handleAddInstance = (targetOption) => {
    const opt = targetOption || optionToAdd;
    if (!opt || instances.includes(opt)) return;

    const nextInstances = [...instances, opt];
    setInstances(nextInstances);
    setSelectedInstance(opt);

    if (onValueChange) {
      onValueChange(instancesKey, nextInstances);
    }
  };

  const handleRemoveInstance = () => {
    if (!selectedInstance) return;
    const confirmMsg = `Are you sure you want to remove "${selectedInstance}" and all its entered table data?`;
    if (!window.confirm(confirmMsg)) return;

    const nextInstances = instances.filter((i) => i !== selectedInstance);
    setInstances(nextInstances);
    const nextSelected = nextInstances[0] || '';
    setSelectedInstance(nextSelected);

    if (onValueChange) {
      onValueChange(instancesKey, nextInstances);
    }

    // Clear data for this instance across all assigned tables
    if (onTableChange) {
      tables.forEach((tbl) => {
        const baseKey = tbl.tableKey || tbl.idString || (tbl.id != null ? String(tbl.id) : '');
        const scopedKey = buildScopedTableKey(baseKey, selectedInstance);
        onTableChange(scopedKey, []);
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
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            color: '#64748b',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
          background: '#f8fafc',
          border: '1.5px dashed #93c5fd',
          borderRadius: '12px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
        <h5 style={{ margin: '0 0 6px', fontWeight: 800, color: '#1e3a8a', fontSize: '15px' }}>
          {button.label || 'Add Tables'}
        </h5>
        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '13px' }}>
          {tables.length} table(s) configured for this section. Click below to add your first {button.dropdownLabel || 'entry'}.
        </p>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {dropdownOptions.length > 0 && (
            <select
              value={optionToAdd}
              onChange={(e) => setOptionToAdd(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #93c5fd',
                background: '#fff',
                fontSize: '13px',
                fontWeight: 650,
                color: '#1e3a8a',
                outline: 'none',
              }}
            >
              {dropdownOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {button.dropdownLabel ? `${button.dropdownLabel}: ${opt}` : opt}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => handleAddInstance(optionToAdd || dropdownOptions[0])}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
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
          background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
          border: '1.5px solid #bfdbfe',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 6px rgba(37,99,235,0.06)',
        }}
      >
        {/* Left: Dropdown Instance Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>📂</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a' }}>
              {button.dropdownLabel || 'Viewing'}:
            </span>
          </div>

          <select
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1.5px solid #3b82f6',
              background: '#fff',
              fontSize: '13.5px',
              fontWeight: 800,
              color: '#1d4ed8',
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
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              background: '#dbeafe',
              color: '#1e40af',
            }}
          >
            {instances.indexOf(selectedInstance) + 1} of {instances.length} added
          </span>
        </div>

        {/* Right: Actions (+ Add Another, Remove) */}
        {!readOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {remainingOptions.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <select
                  value={optionToAdd}
                  onChange={(e) => setOptionToAdd(e.target.value)}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 650,
                    color: '#334155',
                    outline: 'none',
                  }}
                >
                  {remainingOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddInstance(optionToAdd)}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '7px',
                    border: '1px solid #93c5fd',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`Add ${optionToAdd} to this section`}
                >
                  <span>➕ Add {button.dropdownLabel || 'Option'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleRemoveInstance}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '7px',
                border: '1px solid #fecaca',
                background: '#fff',
                color: '#dc2626',
                fontWeight: 650,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {tables.map((tbl, idx) => {
          const baseKey = tbl.tableKey || tbl.idString || (tbl.id != null ? String(tbl.id) : `table_${idx}`);
          const scopedKey = buildScopedTableKey(baseKey, selectedInstance);
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
