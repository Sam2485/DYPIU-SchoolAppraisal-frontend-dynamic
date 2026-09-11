import React, { useState, useEffect, useRef } from 'react';
import { getVersionTree } from './formStudioApi';

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
      <div style={{ textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '12.5px' }}>
        {cellVal || rowIndex + 1}
      </div>
    );
  }

  // 2. ATTACHMENT / FILE CELL (NO TEXT BOX!)
  if (type === 'ATTACHMENT' || type === 'FILE') {
    const hasFile = Boolean(cellVal && String(cellVal).trim());

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {hasFile ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            fontSize: '12px',
            fontWeight: 600,
            maxWidth: '220px',
          }}>
            <span style={{ fontSize: '13px' }}>📄</span>
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
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '13px',
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: '12px',
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#eff6ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
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
                borderRadius: '6px',
                border: '1px dashed #cbd5e1',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Add simulated sample PDF name"
            >
              + Sample PDF
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No document</span>
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
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          padding: '0 8px',
          fontSize: '12.5px',
          background: isLocked ? '#f8fafc' : '#fff',
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
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          padding: '0 8px',
          fontSize: '12.5px',
          background: isLocked ? '#f8fafc' : '#fff',
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
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          padding: '0 8px',
          fontSize: '12.5px',
          background: isLocked ? '#f8fafc' : '#fff',
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
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          padding: '6px 8px',
          fontSize: '12.5px',
          background: isLocked ? '#f8fafc' : '#fff',
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
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        padding: '0 8px',
        fontSize: '12.5px',
        background: isLocked ? '#f8fafc' : '#fff',
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
      <div style={{ padding: '80px 24px', textAlign: 'center', background: '#f8fafc', minHeight: '80vh' }}>
        <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <h3 style={{ margin: '20px 0 8px', color: '#1e293b', fontWeight: 700, fontSize: '18px' }}>Generating Live Form Simulator...</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Loading dynamic form hierarchy, sections, and tables.</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!schema) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ padding: '32px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '42px', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 10px', color: '#0f172a', fontWeight: 800, fontSize: '18px' }}>No Schema Loaded</h3>
          <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>
            Unable to retrieve the form schema tree for version ID: <strong>{versionId || 'None'}</strong>. Please return to the Form Studio editor and try again.
          </p>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '10px 24px',
              borderRadius: '9px',
              border: '1px solid #cbd5e1',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
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

  const handleClearTable = (tableKey) => {
    if (window.confirm('Are you sure you want to clear all rows in this simulated table?')) {
      setTablesData((prev) => ({ ...prev, [tableKey]: [] }));
    }
  };

  const handleResetAllData = () => {
    if (window.confirm('Reset all simulated input fields and table records?')) {
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
    <div style={{ minHeight: '100%', background: '#f8fafc', paddingBottom: '80px', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. TOP STICKY APP BAR */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '12px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Left: Back button & Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontWeight: 650,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            >
              <span>←</span>
              <span>Back to Editor</span>
            </button>

            <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: '12px', fontWeight: 700 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 2px #d1fae5' }}></span>
                Live Form Simulator
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px', lineHeight: 1.2 }}>
                  {schema.title || 'Untitled Appraisal Form'}
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Academic Cycle: <strong>{schema.academicYear || 'Current'}</strong> • Type: <span style={{ textTransform: 'capitalize' }}>{schema.auditType || 'Academic'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Simulation Controls & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Simulation Role Selector */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setSimulationRole('submitter')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: simulationRole === 'submitter' ? '#2563eb' : 'transparent',
                  color: simulationRole === 'submitter' ? '#fff' : '#475569',
                  fontWeight: 650,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
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
                  borderRadius: '6px',
                  border: 'none',
                  background: simulationRole === 'auditor' ? '#f59e0b' : 'transparent',
                  color: simulationRole === 'auditor' ? '#fff' : '#475569',
                  fontWeight: 650,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Preview as Internal / External Auditor"
              >
                <span>🔍</span>
                <span>Auditor Review Role</span>
              </button>
            </div>

            {/* View Mode (Interactive vs Clean Document) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'interactive' ? '#0f172a' : 'transparent',
                  color: viewMode === 'interactive' ? '#fff' : '#64748b',
                  fontWeight: 600,
                  fontSize: '12px',
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
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'document' ? '#0f172a' : 'transparent',
                  color: viewMode === 'document' ? '#fff' : '#64748b',
                  fontWeight: 600,
                  fontSize: '12px',
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
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 650,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
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
                borderRadius: '8px',
                border: '1px solid #fecaca',
                background: '#fff',
                color: '#dc2626',
                fontWeight: 600,
                fontSize: '12.5px',
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
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -4px rgba(15,23,42,0.05)',
          padding: '24px 32px',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background Accent Top Stripe */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa, #93c5fd)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {header?.logoUrl ? (
                <img
                  src={header.logoUrl}
                  alt="University Logo"
                  style={{ maxHeight: '68px', maxWidth: '140px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '28px', fontWeight: 900, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                  🏛️
                </div>
              )}
              <div>
                <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.02em' }}>
                  {header?.university || 'University Institutional Appraisal'}
                </h1>
                {header?.address && (
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>
                    📍 {header.address}
                  </p>
                )}
                {header?.act && (
                  <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                    ⚖️ {header.act}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{sections.length}</div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#64748b', textTransform: 'uppercase' }}>Sections</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>{totalTables}</div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#64748b', textTransform: 'uppercase' }}>Tables</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>{totalFields}</div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#64748b', textTransform: 'uppercase' }}>Fields</div>
              </div>
              {totalAuditorSections > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '8px 14px', textAlign: 'center', minWidth: '85px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#b45309' }}>{totalAuditorSections}</div>
                  <div style={{ fontSize: '11px', fontWeight: 650, color: '#92400e', textTransform: 'uppercase' }}>Auditor</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. SECTION STEPPER NAVIGATION TABS */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '8px', marginBottom: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          {/* Progress overview */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Form Sections Breakdown ({currentSectionIndex + 1} of {sections.length})
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              {Math.round(((currentSectionIndex + 1) / sections.length) * 100)}% Stepped
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
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
                    gap: '10px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: isActive ? '1px solid #2563eb' : '1px solid transparent',
                    background: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isActive ? '#2563eb' : isSecAuditor ? '#fef3c7' : '#e2e8f0',
                    color: isActive ? '#fff' : isSecAuditor ? '#92400e' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}>
                    {sec.number || (idx + 1)}
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: isActive ? 800 : 650, fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                        {sec.title || `Section ${idx + 1}`}
                      </span>
                      {isSecAuditor && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                          🔒 Auditor
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Modern Section Header Banner */}
            <div style={{
              background: isAuditorSection
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
              borderRadius: '14px',
              padding: '20px 24px',
              color: '#ffffff',
              boxShadow: isAuditorSection
                ? '0 4px 14px rgba(30,41,59,0.25)'
                : '0 4px 14px rgba(37,99,235,0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Section {currentSection.number || (currentSectionIndex + 1)}
                  </span>
                  {isAuditorSection ? (
                    <span style={{ background: '#f59e0b', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      🔒 Designated Auditor Evaluation
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      📝 Submitter Section
                    </span>
                  )}
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {currentSection.title}
                </h2>
                {currentSection.description && (
                  <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.9)', maxWidth: '800px', lineHeight: 1.4 }}>
                    {currentSection.description}
                  </p>
                )}
              </div>

              {/* Jump to next/prev section buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={currentSectionIndex === 0}
                  onClick={() => {
                    const prevSec = sections[currentSectionIndex - 1];
                    if (prevSec) setActiveSectionId(prevSec.sectionKey || prevSec.idString || prevSec.id);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontWeight: 650,
                    fontSize: '12.5px',
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
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontWeight: 650,
                    fontSize: '12.5px',
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
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}>
                <span style={{ fontSize: '20px' }}>🔒</span>
                <div>
                  <strong style={{ color: '#92400e', fontSize: '13.5px', display: 'block', marginBottom: '2px' }}>
                    Designated Auditor Evaluation Section
                  </strong>
                  <p style={{ margin: 0, color: '#b45309', fontSize: '12.5px', lineHeight: 1.4 }}>
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
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#1e293b' }}>
                      Section Information & General Fields
                    </h3>
                    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {headerFields.length} Field(s)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                    {headerFields.map((field) => {
                    const key = field.fieldKey || field.idString;
                    const isRequired = field.isRequired;
                    const fieldVal = valuesData[key] || '';

                    return (
                      <div key={field.id || key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>
                            {field.label || key}
                            {isRequired && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
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
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '10px 12px',
                              fontSize: '13px',
                              color: '#0f172a',
                              background: isSectionLockedInCurrentRole ? '#f8fafc' : '#fff',
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
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '0 12px',
                              fontSize: '13px',
                              color: '#0f172a',
                              background: isSectionLockedInCurrentRole ? '#f8fafc' : '#fff',
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
                            border: '1px dashed #cbd5e1',
                            borderRadius: '8px',
                            padding: '12px',
                            background: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '18px' }}>📎</span>
                              <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                                  {fieldVal ? `Attached: ${fieldVal}` : 'Upload Document Proof'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>PDF, DOCX, PNG (Simulated)</div>
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
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: fieldVal ? '#fee2e2' : '#fff',
                                color: fieldVal ? '#991b1b' : '#2563eb',
                                fontSize: '12px',
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
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '0 12px',
                              fontSize: '13px',
                              color: '#0f172a',
                              background: isSectionLockedInCurrentRole ? '#f8fafc' : '#fff',
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

            {/* Dynamic Tables in Current Section */}
            {currentSection.tables && currentSection.tables.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {currentSection.tables.map((tbl, tIdx) => {
                  const tKey = tbl.tableKey || tbl.idString || `table_${tIdx}`;
                  const rows = tablesData[tKey] || [];
                  const columns = tbl.columns && tbl.columns.length > 0
                    ? tbl.columns
                    : tbl.fields?.map((f) => f.label || f.fieldKey) || [];

                  const isRepeatable = tbl.isRepeatable !== false;

                  return (
                    <div
                      key={tbl.id || tKey}
                      style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Table Header Strip */}
                      <div style={{
                        padding: '14px 20px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '17px' }}>📊</span>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                              {tbl.title || `Table ${currentSection.number ? currentSection.number + '.' : ''}${tIdx + 1}`}
                            </h4>
                            {tbl.description && (
                              <span style={{ fontSize: '12px', color: '#64748b' }}>{tbl.description}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: '#f1f5f9', color: '#475569' }}>
                            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                          </span>
                          {isRepeatable && (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: '#e0e7ff', color: '#3730a3' }}>
                              Dynamic Rows
                            </span>
                          )}
                          {rows.length > 0 && !isSectionLockedInCurrentRole && (
                            <button
                              type="button"
                              onClick={() => handleClearTable(tKey)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                background: '#fff',
                                color: '#dc2626',
                                fontSize: '11.5px',
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
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                              {columns.map((col, cIdx) => (
                                <th
                                  key={cIdx}
                                  style={{
                                    padding: '12px 14px',
                                    fontWeight: 700,
                                    borderRight: '1px solid #e2e8f0',
                                    fontSize: '12.5px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{col}</span>
                                  </div>
                                </th>
                              ))}
                              {isRepeatable && !isSectionLockedInCurrentRole && (
                                <th style={{ width: '65px', padding: '12px 14px', textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>
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
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontSize: '28px', opacity: 0.6 }}>📋</div>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                                      No records entered yet
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                      Click the button below to add your first record in this table.
                                    </span>
                                    {isRepeatable && !isSectionLockedInCurrentRole && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddRow(tKey, columns)}
                                        style={{
                                          marginTop: '6px',
                                          padding: '7px 16px',
                                          borderRadius: '7px',
                                          border: '1px solid #93c5fd',
                                          background: '#eff6ff',
                                          color: '#1d4ed8',
                                          fontWeight: 700,
                                          fontSize: '12.5px',
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
                                    borderBottom: '1px solid #f1f5f9',
                                    background: rIdx % 2 === 1 ? '#fafcff' : '#ffffff',
                                    transition: 'background 0.1s ease',
                                  }}
                                >
                                  {columns.map((col, cIdx) => (
                                    <td
                                      key={cIdx}
                                      style={{
                                        padding: '8px 10px',
                                        borderRight: '1px solid #f1f5f9',
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
                                          borderRadius: '6px',
                                          border: '1px solid #fecaca',
                                          background: '#fff',
                                          color: '#dc2626',
                                          cursor: 'pointer',
                                          fontWeight: 700,
                                          fontSize: '12px',
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
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {rows.length} {rows.length === 1 ? 'row entered' : 'rows entered'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddRow(tKey, columns)}
                            style={{
                              padding: '7px 16px',
                              borderRadius: '7px',
                              border: '1px solid #93c5fd',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>+</span>
                            <span>Add Row</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: 0, fontSize: '14px' }}>No tables configured in this section.</p>
              </div>
            )}

            {/* Review Remarks / Bottom Auditor Fields */}
            {(() => {
              const reviewFields = (currentSection.fields || []).filter((f) => isReviewRemarkField(f));
              if (!reviewFields.length) return null;
              return (
                <div style={{
                  marginTop: '24px',
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '14px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📝</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#1e293b' }}>
                      Review Remarks & Observations
                    </h3>
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      Auditor Review
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {reviewFields.map((field) => {
                      const key = field.fieldKey || field.idString;
                      const isRequired = field.isRequired;
                      const fieldVal = valuesData[key] || '';

                      return (
                        <div key={field.id || key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>
                              {field.label || key}
                              {isRequired && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#15803d', textTransform: 'uppercase', fontWeight: 700 }}>
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
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '10px 12px',
                              fontSize: '13px',
                              color: '#0f172a',
                              background: isSectionLockedInCurrentRole ? '#f8fafc' : '#fff',
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
          marginTop: '32px',
          padding: '16px 24px',
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 650, color: '#334155' }}>
              Section {currentSectionIndex + 1} of {sections.length}: <strong>{currentSection?.title}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 650,
                fontSize: '13px',
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
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
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
                  borderRadius: '8px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
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
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📦</span>
                <strong style={{ fontSize: '15px' }}>Simulator State JSON Payload</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowPayloadModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#090d16' }}>
              <pre style={{ margin: 0, color: '#38bdf8', fontSize: '12px', fontFamily: 'Consolas, Monaco, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify({ valuesData, tablesData }, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {Object.keys(valuesData).length} Field values • {Object.keys(tablesData).length} Table data payloads
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: copiedPayload ? '#059669' : '#334155',
                    fontWeight: 700,
                    fontSize: '12.5px',
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
                    borderRadius: '7px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12.5px',
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
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '24px', textAlign: 'center', background: '#ecfdf5', borderBottom: '1px solid #d1fae5' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
              <h3 style={{ margin: '0 0 6px', color: '#065f46', fontWeight: 800, fontSize: '20px' }}>
                Simulated Submission Completed!
              </h3>
              <p style={{ margin: 0, color: '#047857', fontSize: '13.5px' }}>
                Your form schema structure is verified and fully functional for live deployment.
              </p>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                Simulation Payload Summary:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sections.map((sec, idx) => {
                  const sKey = sec.sectionKey || sec.idString || sec.id;
                  const secTables = sec.tables || [];
                  const filledTablesCount = secTables.filter((t) => (tablesData[t.tableKey || t.idString] || []).length > 0).length;

                  return (
                    <div key={idx} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        Sec {sec.number || idx + 1}: {sec.title}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                        {filledTablesCount} / {secTables.length} tables populated
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 650,
                  fontSize: '13px',
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
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
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
