import { confirmAction } from "../../../components/feedback/feedbackBus";
import React, { useState, useEffect, useRef } from 'react';
import { getVersionTree } from './formStudioApi';
import { TableButtonGroup } from '../components/TableButtonGroup';
import { partitionTablesByButtons, getSectionKey } from '../utils/tableButtonHelpers';

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

// Sub-component for rendering individual table cell in preview
const PreviewTableCell = ({
  tableKey,
  rowIndex,
  colName,
  cellVal,
  tbl,
  isLocked,
  onCellChange,
}) => {
  const fileInputRef = useRef(null);

  // 1. Find explicit field definition if available
  const fieldDef = tbl?.fields?.find(
    (f) => (f.label && f.label.trim().toLowerCase() === colName.trim().toLowerCase()) ||
           (f.fieldKey && f.fieldKey.trim().toLowerCase() === colName.trim().toLowerCase())
  );

  // 2. Infer column type
  const lower = String(colName || '').toLowerCase().trim();
  let type = fieldDef?.fieldType?.toUpperCase();

  if (!type) {
    if (/^(sr\.?\s*no\.?|sn|no\.?|s\.n\.?)$/i.test(lower)) {
      type = 'SR_NO';
    } else if (/(attach|proof|doc|pdf|file|link|cert|letter|mom|upload)/i.test(lower)) {
      type = 'ATTACHMENT';
    } else if (/(date|year|period|month|dob|doj)/i.test(lower)) {
      type = 'DATE';
    } else if (/(intake|admitted|count|score|amount|marks|points|gpa|cgpa|number|strength|vacant|total|qty|capacity)/i.test(lower)) {
      type = 'NUMBER';
    } else if (/(remarks|comments|details|description|summary|feedback|action|reason)/i.test(lower)) {
      type = 'TEXTAREA';
    } else if (fieldDef?.options && fieldDef.options.length > 0) {
      type = 'SELECT';
    } else {
      type = 'TEXT';
    }
  }

  // Handle local simulated file upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onCellChange(tableKey, rowIndex, colName, file.name);
    }
  };

  // 1. SR NO CELL
  if (type === 'SR_NO') {
    return (
      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--muted)', fontSize: "var(--text-base)" }}>
        {cellVal || rowIndex + 1}
      </div>
    );
  }

  // 2. ATTACHMENT / FILE CELL (NO TEXT BOX!)
  if (type === 'ATTACHMENT' || type === 'FILE') {
    const hasFile = Boolean(cellVal && String(cellVal).trim());

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", flexWrap: 'wrap' }}>
        {hasFile ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: "var(--space-2)",
            padding: '4px 10px',
            borderRadius: "var(--radius-sm)",
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            color: '#1e40af',
            fontSize: "var(--text-base)",
            fontWeight: 600,
            maxWidth: '220px',
          }}>
            <span style={{ fontSize: "var(--text-base)" }}>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(cellVal)}>
              {cellVal}
            </span>
            {!isLocked && (
              <button
                type="button"
                onClick={() => onCellChange(tableKey, rowIndex, colName, '')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--red-500)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: "var(--text-base)",
                  padding: '0 2px',
                  lineHeight: 1,
                }}
                title="Remove attachment"
              >
                ✕
              </button>
            )}
          </div>
        ) : !isLocked ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: "var(--space-2)" }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '5px 11px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--border-strong)',
                background: 'var(--card)',
                color: 'var(--primary)',
                fontSize: "var(--text-base)",
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: "var(--space-2)",
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = 'var(--accent-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--card)'; }}
            >
              <span>📎</span>
              <span>Upload Doc</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const sampleDoc = `Certificate_${rowIndex + 1}.pdf`;
                onCellChange(tableKey, rowIndex, colName, sampleDoc);
              }}
              style={{
                padding: '5px 8px',
                borderRadius: "var(--radius-sm)",
                border: '1px dashed var(--border-strong)',
                background: 'var(--bg)',
                color: 'var(--muted)',
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Add simulated sample PDF name"
            >
              + Sample PDF
            </button>
          </div>
        ) : (
          <span style={{ fontSize: "var(--text-base)", color: 'var(--muted)', fontStyle: 'italic' }}>No document</span>
        )}
      </div>
    );
  }

  // 3. SELECT CELL
  if (type === 'SELECT' || (fieldDef?.options && fieldDef.options.length > 0)) {
    const opts = fieldDef?.options || [];
    return (
      <select
        disabled={isLocked}
        value={cellVal || ''}
        onChange={(e) => onCellChange(tableKey, rowIndex, colName, e.target.value)}
        style={{
          width: '100%',
          height: '34px',
          borderRadius: "var(--radius-sm)",
          border: '1px solid var(--border-strong)',
          padding: '0 8px',
          fontSize: "var(--text-base)",
          background: isLocked ? 'var(--bg)' : 'var(--card)',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      >
        <option value="">-- Select --</option>
        {opts.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  // 4. DATE CELL
  if (type === 'DATE') {
    return (
      <input
        type="date"
        disabled={isLocked}
        value={cellVal || ''}
        onChange={(e) => onCellChange(tableKey, rowIndex, colName, e.target.value)}
        style={{
          width: '100%',
          height: '34px',
          borderRadius: "var(--radius-sm)",
          border: '1px solid var(--border-strong)',
          padding: '0 8px',
          fontSize: "var(--text-base)",
          background: isLocked ? 'var(--bg)' : 'var(--card)',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    );
  }

  // 5. NUMBER CELL
  if (type === 'NUMBER') {
    return (
      <input
        type="number"
        disabled={isLocked}
        placeholder="0"
        value={cellVal || ''}
        onChange={(e) => onCellChange(tableKey, rowIndex, colName, e.target.value)}
        style={{
          width: '100%',
          height: '34px',
          borderRadius: "var(--radius-sm)",
          border: '1px solid var(--border-strong)',
          padding: '0 8px',
          fontSize: "var(--text-base)",
          background: isLocked ? 'var(--bg)' : 'var(--card)',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    );
  }

  // 6. TEXTAREA CELL
  if (type === 'TEXTAREA') {
    return (
      <textarea
        rows={2}
        disabled={isLocked}
        placeholder={`Enter ${colName}...`}
        value={cellVal || ''}
        onChange={(e) => onCellChange(tableKey, rowIndex, colName, e.target.value)}
        style={{
          width: '100%',
          borderRadius: "var(--radius-sm)",
          border: '1px solid var(--border-strong)',
          padding: '6px 8px',
          fontSize: "var(--text-base)",
          background: isLocked ? 'var(--bg)' : 'var(--card)',
          boxSizing: 'border-box',
          outline: 'none',
          resize: 'vertical',
        }}
      />
    );
  }

  // 7. DEFAULT TEXT CELL
  return (
    <input
      type="text"
      disabled={isLocked}
      placeholder={`Enter ${colName}...`}
      value={cellVal || ''}
      onChange={(e) => onCellChange(tableKey, rowIndex, colName, e.target.value)}
      style={{
        width: '100%',
        height: '34px',
        borderRadius: "var(--radius-sm)",
        border: '1px solid var(--border-strong)',
        padding: '0 8px',
        fontSize: "var(--text-base)",
        background: isLocked ? 'var(--bg)' : 'var(--card)',
        boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  );
};

export const LiveFormPreview = ({ versionId, onBack }) => {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [valuesData, setValuesData] = useState({});
  const [tablesData, setTablesData] = useState({});
  
  // Simulator Controls
  const [simulationRole, setSimulationRole] = useState('submitter'); // 'submitter' | 'auditor'
  const [viewMode, setViewMode] = useState('interactive'); // 'interactive' | 'document'
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  useEffect(() => {
    if (!versionId) return;
    const fetchTree = async () => {
      setLoading(true);
      try {
        const data = await getVersionTree(versionId);
        setSchema(data);
        if (data.sections && data.sections.length > 0) {
          setActiveSectionId(data.sections[0].sectionKey || data.sections[0].idString || data.sections[0].id);
        }
      } catch (err) {
        console.error('Failed to load version tree for preview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [versionId]);

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', background: 'var(--bg)', minHeight: '80vh' }}>
        <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <h3 style={{ margin: '20px 0 8px', color: '#1e293b', fontWeight: 700, fontSize: "var(--text-xl)" }}>Generating Live Form Simulator...</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: "var(--text-md)" }}>Loading dynamic form hierarchy, sections, and tables.</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!schema) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ padding: "var(--space-10)", background: 'var(--card)', borderRadius: "var(--radius-xl)", border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: "var(--text-6xl)", marginBottom: "var(--space-7)" }}>⚠️</div>
          <h3 style={{ margin: '0 0 10px', color: 'var(--ink)', fontWeight: 800, fontSize: "var(--text-xl)" }}>No Schema Loaded</h3>
          <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: "var(--text-md)", lineHeight: 1.5 }}>
            Unable to retrieve the form schema tree for version ID: <strong>{versionId || 'None'}</strong>. Please return to the Form Studio editor and try again.
          </p>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '10px 24px',
              borderRadius: "var(--radius-md)",
              border: '1px solid var(--border-strong)',
              background: 'var(--primary)',
              color: 'var(--card)',
              fontWeight: 700,
              fontSize: "var(--text-md)",
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
            }}
          >
            ← Return to Form Studio
          </button>
        </div>
      </div>
    );
  }

  const { header, sections = [] } = schema;
  
  // Section Navigation Calculation
  const currentSectionIndex = sections.findIndex(
    (s) => (s.sectionKey || s.idString || s.id) === activeSectionId
  );
  const currentSection = sections[currentSectionIndex >= 0 ? currentSectionIndex : 0];

  // Helper Stats
  const totalTables = sections.reduce((acc, s) => acc + (s.tables?.length || 0), 0);
  const totalFields = sections.reduce((acc, s) => acc + (s.fields?.length || 0), 0);
  const totalAuditorSections = sections.filter((s) => s.ownerRole === 'auditor' || s.isAuditorSection).length;

  // Handlers for Data Changes
  const handleCellChange = (tableKey, rowIndex, colName, val) => {
    const existing = tablesData[tableKey] || [];
    const updated = existing.map((r, i) => (i === rowIndex ? { ...r, [colName]: val } : r));
    setTablesData((prev) => ({ ...prev, [tableKey]: updated }));
  };

  const handleAddRow = (tableKey, columns = []) => {
    const existing = tablesData[tableKey] || [];
    const newRow = {};
    columns.forEach((c) => {
      newRow[c] = '';
    });
    // If first column is Sr No or similar, auto-populate
    if (columns[0] && /^(sr\.?\s*no\.?|sn|no\.?|s\.n\.?)$/i.test(columns[0])) {
      newRow[columns[0]] = String(existing.length + 1);
    }
    setTablesData((prev) => ({ ...prev, [tableKey]: [...existing, newRow] }));
  };

  const handleDeleteRow = (tableKey, index, columns = []) => {
    const existing = tablesData[tableKey] || [];
    const updated = existing.filter((_, i) => i !== index);
    if (columns[0] && /^(sr\.?\s*no\.?|sn|no\.?|s\.n\.?)$/i.test(columns[0])) {
      updated.forEach((r, idx) => {
        r[columns[0]] = String(idx + 1);
      });
    }
    setTablesData((prev) => ({ ...prev, [tableKey]: updated }));
  };

  const handleClearTable = async (tableKey) => {
    if (await confirmAction('Are you sure you want to clear all rows in this simulated table?', { tone: 'danger', confirmLabel: 'Clear' })) {
      setTablesData((prev) => ({ ...prev, [tableKey]: [] }));
    }
  };

  const handleResetAllData = async () => {
    if (await confirmAction('Reset all simulated input fields and table records?', { tone: 'danger', confirmLabel: 'Reset' })) {
      setValuesData({});
      setTablesData({});
    }
  };

  const handleCopyPayload = () => {
    const payload = JSON.stringify({ valuesData, tablesData }, null, 2);
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const isAuditorSection = currentSection?.ownerRole === 'auditor' || currentSection?.isAuditorSection;
  const isSectionLockedInCurrentRole = simulationRole === 'submitter' && isAuditorSection;

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', paddingBottom: '80px', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. TOP STICKY APP BAR */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--card)', borderBottom: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '12px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: "var(--space-5)" }}>
          
          {/* Left: Back button & Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-6)" }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: "var(--space-2)",
                padding: '7px 14px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--border-strong)',
                background: 'var(--bg)',
                color: '#334155',
                fontWeight: 650,
                fontSize: "var(--text-base)",
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.borderColor = 'var(--faint)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            >
              <span>←</span>
              <span>Back to Editor</span>
            </button>

            <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)" }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: "var(--space-2)", padding: '4px 10px', borderRadius: "var(--radius-2xl)", background: 'var(--teal-soft)', border: '1px solid var(--green-250)', color: 'var(--green-750)', fontSize: "var(--text-base)", fontWeight: 700 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--emerald-500)', boxShadow: '0 0 0 2px var(--green-150)' }}></span>
                Live Form Simulator
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-md)", lineHeight: 1.2 }}>
                  {schema.title || 'Untitled Appraisal Form'}
                </span>
                <span style={{ fontSize: "var(--text-sm)", color: 'var(--muted)' }}>
                  Academic Cycle: <strong>{schema.academicYear || 'Current'}</strong> • Type: <span style={{ textTransform: 'capitalize' }}>{schema.auditType || 'Academic'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Simulation Controls & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)", flexWrap: 'wrap' }}>
            
            {/* Simulation Role Selector */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-alt)', padding: "var(--space-1)", borderRadius: "var(--radius-sm)", border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setSimulationRole('submitter')}
                style={{
                  padding: '5px 12px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: simulationRole === 'submitter' ? 'var(--primary)' : 'transparent',
                  color: simulationRole === 'submitter' ? 'var(--card)' : '#475569',
                  fontWeight: 650,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: "var(--space-1)",
                }}
                title="Preview as Director / Submitting Department"
              >
                <span>👤</span>
                <span>Submitter Role</span>
              </button>
              <button
                type="button"
                onClick={() => setSimulationRole('auditor')}
                style={{
                  padding: '5px 12px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: simulationRole === 'auditor' ? 'var(--amber-500)' : 'transparent',
                  color: simulationRole === 'auditor' ? 'var(--card)' : '#475569',
                  fontWeight: 650,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: "var(--space-1)",
                }}
                title="Preview as Internal / External Auditor"
              >
                <span>🔍</span>
                <span>Auditor Review Role</span>
              </button>
            </div>

            {/* View Mode (Interactive vs Clean Document) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-alt)', padding: "var(--space-1)", borderRadius: "var(--radius-sm)", border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                style={{
                  padding: '5px 10px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: viewMode === 'interactive' ? 'var(--ink)' : 'transparent',
                  color: viewMode === 'interactive' ? 'var(--card)' : 'var(--muted)',
                  fontWeight: 600,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                }}
              >
                Interactive
              </button>
              <button
                type="button"
                onClick={() => setViewMode('document')}
                style={{
                  padding: '5px 10px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: viewMode === 'document' ? 'var(--ink)' : 'transparent',
                  color: viewMode === 'document' ? 'var(--card)' : 'var(--muted)',
                  fontWeight: 600,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                }}
              >
                Document View
              </button>
            </div>

            {/* Inspect Payload Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowPayloadModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-soft)',
                color: 'var(--primary-dark)',
                fontWeight: 650,
                fontSize: "var(--text-base)",
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: "var(--space-2)",
              }}
            >
              <span>📦</span>
              <span>Inspect Payload</span>
            </button>

            {/* Reset Inputs Button */}
            <button
              type="button"
              onClick={handleResetAllData}
              style={{
                padding: '6px 10px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--red-200)',
                background: 'var(--card)',
                color: 'var(--red-600)',
                fontWeight: 600,
                fontSize: "var(--text-base)",
                cursor: 'pointer',
              }}
              title="Clear all test inputs"
            >
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
        
        {/* 2. UNIVERSITY LETTERHEAD BANNER */}
        <div style={{
          background: 'var(--card)',
          borderRadius: "var(--radius-xl)",
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px -4px rgba(15,23,42,0.05)',
          padding: '24px 32px',
          marginBottom: "var(--space-9)",
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background Accent Top Stripe */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: 'linear-gradient(90deg, var(--primary), #3b82f6, #60a5fa, #93c5fd)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: "var(--space-8)" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-8)" }}>
              {header?.logoUrl ? (
                <img
                  src={header.logoUrl}
                  alt="University Logo"
                  style={{ maxHeight: '68px', maxWidth: '140px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: "var(--radius-xl)", background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--card)', fontSize: "var(--text-4xl)", fontWeight: 900, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                  🏛️
                </div>
              )}
              <div>
                <h1 style={{ margin: '0 0 4px', fontSize: "var(--text-3xl)", fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.02em' }}>
                  {header?.university || 'University Institutional Appraisal'}
                </h1>
                {header?.address && (
                  <p style={{ margin: '0 0 4px', fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                    📍 {header.address}
                  </p>
                )}
                {header?.act && (
                  <p style={{ margin: '0', fontSize: "var(--text-base)", color: 'var(--muted)', fontStyle: 'italic' }}>
                    ⚖️ {header.act}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'flex', gap: "var(--space-5)", flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: "var(--radius-md)", padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: 'var(--ink)' }}>{sections.length}</div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase' }}>Sections</div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: "var(--radius-md)", padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: 'var(--primary)' }}>{totalTables}</div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase' }}>Tables</div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: "var(--radius-md)", padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: 'var(--green-650)' }}>{totalFields}</div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase' }}>Fields</div>
              </div>
              {totalAuditorSections > 0 && (
                <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: "var(--radius-md)", padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: 'var(--amber-650)' }}>{totalAuditorSections}</div>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: 'var(--amber-700)', textTransform: 'uppercase' }}>Auditor</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. SECTION STEPPER NAVIGATION TABS */}
        <div style={{ background: 'var(--card)', borderRadius: "var(--radius-xl)", border: '1px solid var(--border)', padding: "var(--space-3)", marginBottom: "var(--space-9)", boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          {/* Progress overview */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px', borderBottom: '1px solid var(--bg-alt)', marginBottom: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Form Sections Breakdown ({currentSectionIndex + 1} of {sections.length})
            </span>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: 'var(--muted)' }}>
              {Math.round(((currentSectionIndex + 1) / sections.length) * 100)}% Stepped
            </span>
          </div>

          <div style={{ display: 'flex', gap: "var(--space-3)", overflowX: 'auto', paddingBottom: "var(--space-1)" }}>
            {sections.map((sec, idx) => {
              const sKey = sec.sectionKey || sec.idString || sec.id;
              const isActive = sKey === activeSectionId;
              const isSecAuditor = sec.ownerRole === 'auditor' || sec.isAuditorSection;
              
              return (
                <button
                  key={sec.id || sKey}
                  type="button"
                  onClick={() => setActiveSectionId(sKey)}
                  style={{
                    flex: '0 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: "var(--space-4)",
                    padding: '10px 16px',
                    borderRadius: "var(--radius-md)",
                    border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--primary-dark)' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isActive ? 'var(--primary)' : isSecAuditor ? 'var(--amber-100)' : 'var(--border)',
                    color: isActive ? 'var(--card)' : isSecAuditor ? 'var(--amber-700)' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: "var(--text-base)",
                    fontWeight: 800,
                  }}>
                    {sec.number || (idx + 1)}
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)" }}>
                      <span style={{ fontWeight: isActive ? 800 : 650, fontSize: "var(--text-base)", whiteSpace: 'nowrap' }}>
                        {sec.title || `Section ${idx + 1}`}
                      </span>
                      {isSecAuditor && (
                        <span style={{ fontSize: "var(--text-2xs)", padding: '2px 6px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700 }}>
                          🔒 Auditor
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: 'var(--muted)' }}>
                      {(sec.tables?.length || 0)} table(s) • {(sec.fields?.length || 0)} field(s)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. ACTIVE SECTION CONTAINER */}
        {currentSection ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-8)" }}>
            
            {/* Modern Section Header Banner */}
            <div style={{
              background: isAuditorSection
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'linear-gradient(135deg, #1e40af 0%, var(--primary) 100%)',
              borderRadius: "var(--radius-xl)",
              padding: '20px 24px',
              color: 'var(--card)',
              boxShadow: isAuditorSection
                ? '0 4px 14px rgba(30,41,59,0.25)'
                : '0 4px 14px rgba(37,99,235,0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: "var(--space-6)",
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Section {currentSection.number || (currentSectionIndex + 1)}
                  </span>
                  {isAuditorSection ? (
                    <span style={{ background: 'var(--amber-500)', color: 'var(--card)', padding: '3px 8px', borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 800 }}>
                      🔒 Designated Auditor Evaluation
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 700 }}>
                      📝 Submitter Section
                    </span>
                  )}
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: "var(--text-2xl)", fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {currentSection.title}
                </h2>
                {currentSection.description && (
                  <p style={{ margin: 0, fontSize: "var(--text-base)", color: 'rgba(255,255,255,0.9)', maxWidth: '800px', lineHeight: 1.4 }}>
                    {currentSection.description}
                  </p>
                )}
              </div>

              {/* Jump to next/prev section buttons */}
              <div style={{ display: 'flex', gap: "var(--space-3)" }}>
                <button
                  type="button"
                  disabled={currentSectionIndex === 0}
                  onClick={() => {
                    const prevSec = sections[currentSectionIndex - 1];
                    if (prevSec) setActiveSectionId(prevSec.sectionKey || prevSec.idString || prevSec.id);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: "var(--radius-sm)",
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'var(--card)',
                    fontWeight: 650,
                    fontSize: "var(--text-base)",
                    cursor: currentSectionIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentSectionIndex === 0 ? 0.4 : 1,
                  }}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={currentSectionIndex === sections.length - 1}
                  onClick={() => {
                    const nextSec = sections[currentSectionIndex + 1];
                    if (nextSec) setActiveSectionId(nextSec.sectionKey || nextSec.idString || nextSec.id);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: "var(--radius-sm)",
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.12)',
                    color: 'var(--card)',
                    fontWeight: 650,
                    fontSize: "var(--text-base)",
                    cursor: currentSectionIndex === sections.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: currentSectionIndex === sections.length - 1 ? 0.4 : 1,
                  }}
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Role Disclaimer Notice */}
            {isAuditorSection && (
              <div style={{
                background: 'var(--amber-50)',
                border: '1px solid var(--amber-200)',
                borderRadius: "var(--radius-lg)",
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: "var(--space-5)",
              }}>
                <span style={{ fontSize: "var(--text-2xl)" }}>🔒</span>
                <div>
                  <strong style={{ color: 'var(--amber-700)', fontSize: "var(--text-base)", display: 'block', marginBottom: '2px' }}>
                    Designated Auditor Evaluation Section
                  </strong>
                  <p style={{ margin: 0, color: 'var(--amber-650)', fontSize: "var(--text-base)", lineHeight: 1.4 }}>
                    This section is configured to be filled exclusively by the appointed Auditor during the review audit cycle. 
                    {simulationRole === 'submitter'
                      ? ' You are currently simulating as Submitter (inputs are shown in view/restricted mode).'
                      : ' You are simulating as Auditor (inputs are editable).'}
                  </p>
                </div>
              </div>
            )}

            {/* Top-Level Section Fields (Grid Cards) */}
            {(() => {
              const headerFields = (currentSection.fields || []).filter((f) => !isReviewRemarkField(f));
              if (!headerFields.length) return null;
              return (
                <div style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: "var(--radius-xl)",
                  padding: '20px 24px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", marginBottom: "var(--space-7)", borderBottom: '1px solid var(--bg-alt)', paddingBottom: "var(--space-4)" }}>
                    <span style={{ fontSize: "var(--text-lg)" }}>📋</span>
                    <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 750, color: '#1e293b' }}>
                      Section Information & General Fields
                    </h3>
                    <span style={{ fontSize: "var(--text-xs)", background: 'var(--bg-alt)', color: 'var(--muted)', padding: '2px 8px', borderRadius: "var(--radius-lg)", fontWeight: 600 }}>
                      {headerFields.length} Field(s)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: "var(--space-7)" }}>
                    {headerFields.map((field) => {
                    const key = field.fieldKey || field.idString;
                    const isRequired = field.isRequired;
                    const fieldVal = valuesData[key] || '';

                    return (
                      <div key={field.id || key} style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-2)" }}>
                        <label style={{ fontSize: "var(--text-base)", fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>
                            {field.label || key}
                            {isRequired && <span style={{ color: 'var(--red-500)', marginLeft: "var(--space-1)" }}>*</span>}
                          </span>
                          <span style={{ fontSize: "var(--text-2xs)", color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                            {field.fieldType || 'TEXT'}
                          </span>
                        </label>

                        {/* Textarea */}
                        {field.fieldType === 'TEXTAREA' ? (
                          <textarea
                            disabled={isSectionLockedInCurrentRole}
                            rows={3}
                            placeholder={field.placeholder || `Enter ${field.label || 'details'}...`}
                            value={fieldVal}
                            onChange={(e) => setValuesData((prev) => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              width: '100%',
                              borderRadius: "var(--radius-sm)",
                              border: '1px solid var(--border-strong)',
                              padding: '10px 12px',
                              fontSize: "var(--text-base)",
                              color: 'var(--ink)',
                              background: isSectionLockedInCurrentRole ? 'var(--bg)' : 'var(--card)',
                              resize: 'vertical',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        ) : field.fieldType === 'SELECT' ? (
                          <select
                            disabled={isSectionLockedInCurrentRole}
                            value={fieldVal}
                            onChange={(e) => setValuesData((prev) => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              width: '100%',
                              height: '40px',
                              borderRadius: "var(--radius-sm)",
                              border: '1px solid var(--border-strong)',
                              padding: '0 12px',
                              fontSize: "var(--text-base)",
                              color: 'var(--ink)',
                              background: isSectionLockedInCurrentRole ? 'var(--bg)' : 'var(--card)',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          >
                            <option value="">-- Select {field.label || 'Option'} --</option>
                            {field.options && field.options.map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.fieldType === 'FILE' || field.fieldType === 'ATTACHMENT' ? (
                          <div style={{
                            border: '1px dashed var(--border-strong)',
                            borderRadius: "var(--radius-sm)",
                            padding: "var(--space-5)",
                            background: 'var(--bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)" }}>
                              <span style={{ fontSize: "var(--text-xl)" }}>📎</span>
                              <div>
                                <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: '#334155' }}>
                                  {fieldVal ? `Attached: ${fieldVal}` : 'Upload Document Proof'}
                                </div>
                                <div style={{ fontSize: "var(--text-xs)", color: 'var(--muted)' }}>PDF, DOCX, PNG (Simulated)</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={isSectionLockedInCurrentRole}
                              onClick={() => {
                                const sample = `proof_${Date.now()}.pdf`;
                                setValuesData((prev) => ({ ...prev, [key]: fieldVal ? '' : sample }));
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: "var(--radius-sm)",
                                border: '1px solid var(--border-strong)',
                                background: fieldVal ? 'var(--red-100)' : 'var(--card)',
                                color: fieldVal ? 'var(--red-800)' : 'var(--primary)',
                                fontSize: "var(--text-base)",
                                fontWeight: 650,
                                cursor: 'pointer',
                              }}
                            >
                              {fieldVal ? '✕ Remove' : '+ Upload'}
                            </button>
                          </div>
                        ) : (
                          <input
                            type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
                            disabled={isSectionLockedInCurrentRole}
                            placeholder={field.placeholder || `Enter ${field.label || 'value'}...`}
                            value={fieldVal}
                            onChange={(e) => setValuesData((prev) => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              width: '100%',
                              height: '40px',
                              borderRadius: "var(--radius-sm)",
                              border: '1px solid var(--border-strong)',
                              padding: '0 12px',
                              fontSize: "var(--text-base)",
                              color: 'var(--ink)',
                              background: isSectionLockedInCurrentRole ? 'var(--bg)' : 'var(--card)',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Dynamic Tables & Button-Triggered Groups in Current Section */}
            {(() => {
              if (!currentSection.tables || currentSection.tables.length === 0) {
                return (
                  <div style={{ background: 'var(--card)', borderRadius: "var(--radius-lg)", border: '1px solid var(--border)', padding: "var(--space-10)", textAlign: 'center', color: 'var(--muted)' }}>
                    <p style={{ margin: 0, fontSize: "var(--text-md)" }}>No tables configured in this section.</p>
                  </div>
                );
              }

              const renderLivePreviewTable = (tbl, overrideKey) => {
                const tKey = overrideKey || tbl.scopedKey || tbl.tableKey || tbl.idString || `table_${tbl.id || 0}`;
                const rows = tablesData[tKey] || [];
                const columns = tbl.columns && tbl.columns.length > 0
                  ? tbl.columns
                  : tbl.fields?.map((f) => f.label || f.fieldKey) || [];
                const isRepeatable = tbl.isRepeatable !== false;

                return (
                  <div
                    key={tbl.id ? `${tbl.id}_${tKey}` : tKey}
                    style={{
                      background: 'var(--card)',
                      borderRadius: "var(--radius-xl)",
                      border: '1px solid var(--border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Table Header Strip */}
                    <div style={{
                      padding: '14px 20px',
                      background: 'var(--bg)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: "var(--space-4)",
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)" }}>
                        <span style={{ fontSize: "var(--text-lg)" }}>📊</span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 800, color: '#1e293b' }}>
                            {tbl.title || 'Table'}
                          </h4>
                          {tbl.description && (
                            <span style={{ fontSize: "var(--text-base)", color: 'var(--muted)' }}>{tbl.description}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)" }}>
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '3px 8px', borderRadius: "var(--radius-2xs)", background: 'var(--bg-alt)', color: '#475569' }}>
                          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                        </span>
                        {isRepeatable && (
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '3px 8px', borderRadius: "var(--radius-2xs)", background: '#dbeafe', color: '#1e40af' }}>
                            Dynamic Rows
                          </span>
                        )}
                        {rows.length > 0 && !isSectionLockedInCurrentRole && (
                          <button
                            type="button"
                            onClick={() => handleClearTable(tKey)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: "var(--radius-sm)",
                              border: '1px solid var(--red-200)',
                              background: 'var(--card)',
                              color: 'var(--red-600)',
                              fontSize: "var(--text-sm)",
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Clear table rows"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Table Container */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)", textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)', color: '#475569' }}>
                            {columns.map((col, cIdx) => (
                              <th
                                key={cIdx}
                                style={{
                                  padding: '12px 14px',
                                  fontWeight: 700,
                                  borderRight: '1px solid var(--border)',
                                  fontSize: "var(--text-base)",
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)" }}>
                                  <span>{col}</span>
                                </div>
                              </th>
                            ))}
                            {isRepeatable && !isSectionLockedInCurrentRole && (
                              <th style={{ width: '65px', padding: '12px 14px', textAlign: 'center', fontWeight: 700, fontSize: "var(--text-base)" }}>
                                Action
                              </th>
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={columns.length + (isRepeatable && !isSectionLockedInCurrentRole ? 1 : 0)}
                                style={{ textAlign: 'center', padding: '36px 20px', background: '#fafbfc' }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: "var(--space-3)" }}>
                                  <div style={{ fontSize: "var(--text-4xl)", opacity: 0.6 }}>📋</div>
                                  <span style={{ fontSize: "var(--text-md)", fontWeight: 600, color: 'var(--muted)' }}>
                                    No records entered yet
                                  </span>
                                  <span style={{ fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                                    Click the button below to add your first record in this table.
                                  </span>
                                  {isRepeatable && !isSectionLockedInCurrentRole && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddRow(tKey, columns)}
                                      style={{
                                        marginTop: "var(--space-2)",
                                        padding: '7px 16px',
                                        borderRadius: "var(--radius-sm)",
                                        border: '1px solid #93c5fd',
                                        background: 'var(--accent-soft)',
                                        color: 'var(--primary-dark)',
                                        fontWeight: 700,
                                        fontSize: "var(--text-base)",
                                        cursor: 'pointer',
                                      }}
                                    >
                                      + Add First Row
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                style={{
                                  borderBottom: '1px solid var(--bg-alt)',
                                  background: rIdx % 2 === 1 ? '#fafcff' : 'var(--card)',
                                  transition: 'background 0.1s ease',
                                }}
                              >
                                {columns.map((col, cIdx) => (
                                  <td
                                    key={cIdx}
                                    style={{
                                      padding: '8px 10px',
                                      borderRight: '1px solid var(--bg-alt)',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    <PreviewTableCell
                                      tableKey={tKey}
                                      rowIndex={rIdx}
                                      colName={col}
                                      cellVal={row[col]}
                                      tbl={tbl}
                                      isLocked={isSectionLockedInCurrentRole}
                                      onCellChange={handleCellChange}
                                    />
                                  </td>
                                ))}

                                {isRepeatable && !isSectionLockedInCurrentRole && (
                                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(tKey, rIdx, columns)}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: "var(--radius-sm)",
                                        border: '1px solid var(--red-200)',
                                        background: 'var(--card)',
                                        color: 'var(--red-600)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: "var(--text-base)",
                                      }}
                                      title="Delete Row"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer Action */}
                    {isRepeatable && !isSectionLockedInCurrentRole && (
                      <div style={{
                        padding: '10px 20px',
                        background: '#fafbfc',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                          {rows.length} {rows.length === 1 ? 'row entered' : 'rows entered'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddRow(tKey, columns)}
                          style={{
                            padding: '7px 16px',
                            borderRadius: "var(--radius-sm)",
                            border: '1px solid #93c5fd',
                            background: 'var(--accent-soft)',
                            color: 'var(--primary-dark)',
                            fontWeight: 700,
                            fontSize: "var(--text-base)",
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: "var(--space-2)",
                          }}
                        >
                          <span>+</span>
                          <span>Add Row</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              };

              const { unassignedTables, buttonGroups } = partitionTablesByButtons(
                currentSection.tables,
                currentSection.tableButtons
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-9)" }}>
                  {/* 1. Permanent / Unassigned Tables */}
                  {unassignedTables.map((tbl, tIdx) => renderLivePreviewTable(tbl))}

                  {/* 2. Button-Triggered Table Groups */}
                  {buttonGroups.map(({ button, tables }) => (
                    <TableButtonGroup
                      key={button.id}
                      button={button}
                      tables={tables}
                      valuesData={valuesData}
                      tablesData={tablesData}
                      onValueChange={(key, val) => setValuesData((prev) => ({ ...prev, [key]: val }))}
                      onTableChange={(scopedKey, newRows) => {
                        if (newRows === null || newRows === undefined) {
                          setTablesData((prev) => {
                            const next = { ...prev };
                            delete next[scopedKey];
                            return next;
                          });
                        } else {
                          setTablesData((prev) => ({ ...prev, [scopedKey]: newRows }));
                        }
                      }}
                      renderTable={(scopedTable, scopedKey) =>
                        renderLivePreviewTable(scopedTable, scopedKey)
                      }
                      readOnly={isSectionLockedInCurrentRole}
                      section={currentSection}
                      sectionKey={getSectionKey(currentSection)}
                    />
                  ))}
                </div>
              );
            })()}

            {/* Review Remarks / Bottom Auditor Fields */}
            {(() => {
              const reviewFields = (currentSection.fields || []).filter((f) => isReviewRemarkField(f));
              if (!reviewFields.length) return null;
              return (
                <div style={{
                  marginTop: "var(--space-9)",
                  background: 'var(--card)',
                  border: '1px solid var(--green-200)',
                  borderRadius: "var(--radius-xl)",
                  padding: '20px 24px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", marginBottom: "var(--space-7)", borderBottom: '1px solid var(--bg-alt)', paddingBottom: "var(--space-4)" }}>
                    <span style={{ fontSize: "var(--text-lg)" }}>📝</span>
                    <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 750, color: '#1e293b' }}>
                      Review Remarks & Observations
                    </h3>
                    <span style={{ fontSize: "var(--text-xs)", background: 'var(--green-100)', color: 'var(--green-600)', padding: '2px 8px', borderRadius: "var(--radius-lg)", fontWeight: 700 }}>
                      Auditor Review
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-7)" }}>
                    {reviewFields.map((field) => {
                      const key = field.fieldKey || field.idString;
                      const isRequired = field.isRequired;
                      const fieldVal = valuesData[key] || '';

                      return (
                        <div key={field.id || key} style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-2)" }}>
                          <label style={{ fontSize: "var(--text-base)", fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>
                              {field.label || key}
                              {isRequired && <span style={{ color: 'var(--red-500)', marginLeft: "var(--space-1)" }}>*</span>}
                            </span>
                            <span style={{ fontSize: "var(--text-2xs)", color: 'var(--green-600)', textTransform: 'uppercase', fontWeight: 700 }}>
                              {field.fieldType || 'TEXTAREA'}
                            </span>
                          </label>
                          <textarea
                            disabled={isSectionLockedInCurrentRole}
                            placeholder={field.placeholder || `Enter ${field.label || 'review remarks'}...`}
                            value={fieldVal}
                            onChange={(e) => setValuesData((prev) => ({ ...prev, [key]: e.target.value }))}
                            rows={4}
                            style={{
                              width: '100%',
                              borderRadius: "var(--radius-sm)",
                              border: '1px solid var(--border-strong)',
                              padding: '10px 12px',
                              fontSize: "var(--text-base)",
                              color: 'var(--ink)',
                              background: isSectionLockedInCurrentRole ? 'var(--bg)' : 'var(--card)',
                              outline: 'none',
                              boxSizing: 'border-box',
                              resize: 'vertical',
                              lineHeight: 1.5,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* 5. BOTTOM NAVIGATION CONTROLS */}
        <div style={{
          marginTop: "var(--space-10)",
          padding: '16px 24px',
          background: 'var(--card)',
          borderRadius: "var(--radius-xl)",
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: "var(--space-6)",
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}>
          <div>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 650, color: '#334155' }}>
              Section {currentSectionIndex + 1} of {sections.length}: <strong>{currentSection?.title}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: "var(--space-4)", alignItems: 'center' }}>
            <button
              type="button"
              disabled={currentSectionIndex === 0}
              onClick={() => {
                const prev = sections[currentSectionIndex - 1];
                if (prev) setActiveSectionId(prev.sectionKey || prev.idString || prev.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                padding: '8px 18px',
                borderRadius: "var(--radius-sm)",
                border: '1px solid var(--border-strong)',
                background: 'var(--card)',
                color: '#334155',
                fontWeight: 650,
                fontSize: "var(--text-base)",
                cursor: currentSectionIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentSectionIndex === 0 ? 0.5 : 1,
              }}
            >
              ← Previous Section
            </button>

            {currentSectionIndex < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  const next = sections[currentSectionIndex + 1];
                  if (next) setActiveSectionId(next.sectionKey || next.idString || next.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'var(--card)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                }}
              >
                Next Section →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                style={{
                  padding: '8px 22px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: 'var(--green-650)',
                  color: 'var(--card)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: "var(--space-2)",
                }}
              >
                <span>🚀</span>
                <span>Test Submit Simulation</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6. INSPECT PAYLOAD MODAL */}
      {showPayloadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 200,
          background: 'rgba(15,23,42,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: "var(--space-8)",
        }}>
          <div style={{
            background: 'var(--card)',
            borderRadius: "var(--radius-xl)",
            maxWidth: '750px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', background: 'var(--ink)', color: 'var(--card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)" }}>
                <span>📦</span>
                <strong style={{ fontSize: "var(--text-md)" }}>Simulator State JSON Payload</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowPayloadModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: "var(--text-xl)", cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "var(--space-8)", overflowY: 'auto', flex: 1, background: '#090d16' }}>
              <pre style={{ margin: 0, color: '#60a5fa', fontSize: "var(--text-base)", fontFamily: 'Consolas, Monaco, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify({ valuesData, tablesData }, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                {Object.keys(valuesData).length} Field values • {Object.keys(tablesData).length} Table data payloads
              </span>
              <div style={{ display: 'flex', gap: "var(--space-3)" }}>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  style={{
                    padding: '7px 16px',
                    borderRadius: "var(--radius-sm)",
                    border: '1px solid var(--border-strong)',
                    background: 'var(--card)',
                    color: copiedPayload ? 'var(--green-650)' : '#334155',
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    cursor: 'pointer',
                  }}
                >
                  {copiedPayload ? '✅ Copied to Clipboard!' : '📋 Copy JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayloadModal(false)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: "var(--radius-sm)",
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'var(--card)',
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TEST SUBMISSION SUMMARY MODAL */}
      {showSubmitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 200,
          background: 'rgba(15,23,42,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: "var(--space-8)",
        }}>
          <div style={{
            background: 'var(--card)',
            borderRadius: "var(--radius-xl)",
            maxWidth: '600px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: "var(--space-9)", textAlign: 'center', background: 'var(--teal-soft)', borderBottom: '1px solid var(--green-150)' }}>
              <div style={{ fontSize: "var(--text-7xl)", marginBottom: "var(--space-4)" }}>🎉</div>
              <h3 style={{ margin: '0 0 6px', color: 'var(--green-800)', fontWeight: 800, fontSize: "var(--text-2xl)" }}>
                Simulated Submission Completed!
              </h3>
              <p style={{ margin: 0, color: 'var(--green-750)', fontSize: "var(--text-base)" }}>
                Your form schema structure is verified and fully functional for live deployment.
              </p>
            </div>

            <div style={{ padding: "var(--space-8)", overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: "var(--text-md)", fontWeight: 700, color: '#1e293b' }}>
                Simulation Payload Summary:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-3)" }}>
                {sections.map((sec, idx) => {
                  const sKey = sec.sectionKey || sec.idString || sec.id;
                  const secTables = sec.tables || [];
                  const filledTablesCount = secTables.filter((t) => (tablesData[t.tableKey || t.idString] || []).length > 0).length;

                  return (
                    <div key={idx} style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: '#334155' }}>
                        Sec {sec.number || idx + 1}: {sec.title}
                      </span>
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: 'var(--primary)' }}>
                        {filledTablesCount} / {secTables.length} tables populated
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: "var(--radius-sm)",
                  border: '1px solid var(--border-strong)',
                  background: 'var(--card)',
                  color: '#334155',
                  fontWeight: 650,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                }}
              >
                Continue Simulating
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitModal(false);
                  onBack();
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'var(--card)',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                }}
              >
                Return to Editor & Publish
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
