import React, { useState, useEffect } from 'react';
import {
  getVersionTree,
  publishVersion,
  createSection,
  updateSection,
  deleteSection,
  createTable,
  updateTable,
  deleteTable,
  createField,
  updateField,
  deleteField,
  reorderSections,
  reorderTables,
  reorderFields,
  copyTable,
  getAvailableTables,
  getUniversityPosts,
} from './formStudioApi';
import { ExcelTableImportModal } from './ExcelTableImportModal';
import { ExcelFullSchemaImportModal } from './ExcelFullSchemaImportModal';

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

export const FormBuilderCanvas = ({
  versionId,
  selectedUniversity,
  onPublishSuccess,
  onOpenPreview,
  onBackToSchemas,
}) => {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  // Excel Table Import Modal State (Single Section)
  const [excelImportModal, setExcelImportModal] = useState({ show: false, section: null });

  // Full Form Schema Import Modal State (Multi-Section / Entire Form)
  const [fullSchemaImportModal, setFullSchemaImportModal] = useState(false);

  // University Posts for Administrative Assignment
  const [universityPosts, setUniversityPosts] = useState([]);

  // Active navigation selection
  const [activeSectionId, setActiveSectionId] = useState(null);

  // Section Modal State
  const [sectionModal, setSectionModal] = useState({
    show: false,
    isEdit: false,
    data: { id: null, title: '', sectionNumber: '', ownerRole: 'director-schools', description: '' },
  });

  // Table Modal State
  const [tableModal, setTableModal] = useState({
    show: false,
    sectionId: null,
    isEdit: false,
    data: { id: null, title: '', tableKey: '', isRepeatable: true, showTitle: true },
  });

  // Copy Table Modal State (Academic Flow Only)
  const [copyTableModal, setCopyTableModal] = useState({
    show: false,
    sectionId: null,
    sourceTableId: '',
    newTitle: '',
    newTableKey: '',
  });
  const [availableTables, setAvailableTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // Field / Column Modal State
  const [fieldModal, setFieldModal] = useState({
    show: false,
    sectionId: null,
    tableId: null,
    isEdit: false,
    data: {
      id: null,
      label: '',
      fieldKey: '',
      fieldType: 'TEXT',
      isRequired: false,
      placeholder: '',
      optionsString: '',
    },
  });

  const effectiveUniversityId = selectedUniversity?.id || 1;

  const loadPosts = async () => {
    try {
      const posts = await getUniversityPosts(effectiveUniversityId, true);
      setUniversityPosts(posts || []);
    } catch (err) {
      console.error('Failed to load posts in FormBuilderCanvas:', err);
    }
  };

  const loadTree = async () => {
    if (!versionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getVersionTree(versionId);
      setTree(data);
      if (data.sections && data.sections.length > 0 && !activeSectionId) {
        setActiveSectionId(data.sections[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load form tree');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
    loadPosts();
  }, [versionId]);

  const isAdministrative = tree?.auditType === 'administrative';

  // Section Handlers
  const handleToggleAuditorSection = async (sec, isAuditor) => {
    try {
      const defaultRole = isAdministrative
        ? (universityPosts[0]?.code?.toLowerCase() || '')
        : 'director-schools';
      const targetRole = isAuditor ? 'auditor' : defaultRole;
      await updateSection(sec.id, {
        title: sec.title,
        sectionNumber: sec.number || '',
        ownerRole: targetRole,
        description: sec.description || '',
      });
      await loadTree();
    } catch (err) {
      alert('Error updating auditor designation: ' + err.message);
    }
  };

  const handleOpenAddSection = () => {
    const defaultRole = isAdministrative
      ? (universityPosts[0]?.code?.toLowerCase() || '')
      : 'director-schools';

    setSectionModal({
      show: true,
      isEdit: false,
      data: { id: null, title: '', sectionNumber: '', ownerRole: defaultRole, description: '' },
    });
  };

  const handleOpenEditSection = (sec) => {
    setSectionModal({
      show: true,
      isEdit: true,
      data: {
        id: sec.id,
        title: sec.title,
        sectionNumber: sec.number || '',
        ownerRole: sec.ownerRole || (isAdministrative ? (universityPosts[0]?.code?.toLowerCase() || '') : 'director-schools'),
        description: sec.description || '',
      },
    });
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();
    try {
      if (sectionModal.isEdit) {
        await updateSection(sectionModal.data.id, {
          title: sectionModal.data.title,
          sectionNumber: sectionModal.data.sectionNumber,
          ownerRole: sectionModal.data.ownerRole,
          description: sectionModal.data.description,
        });
      } else {
        await createSection(versionId, {
          versionId: versionId,
          title: sectionModal.data.title,
          sectionNumber: sectionModal.data.sectionNumber,
          ownerRole: sectionModal.data.ownerRole,
          description: sectionModal.data.description,
        });
      }
      setSectionModal({ ...sectionModal, show: false });
      await loadTree();
    } catch (err) {
      alert('Error saving section: ' + err.message);
    }
  };

  const handleDeleteSection = async (secId) => {
    if (!window.confirm('Are you sure you want to delete this entire section and all its tables?')) return;
    try {
      await deleteSection(secId);
      await loadTree();
    } catch (err) {
      alert('Error deleting section: ' + err.message);
    }
  };

  const handleMoveSection = async (idx, direction) => {
    if (!tree?.sections) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tree.sections.length) return;

    const sectionsCopy = [...tree.sections];
    const [moved] = sectionsCopy.splice(idx, 1);
    sectionsCopy.splice(targetIdx, 0, moved);

    const orderedIds = sectionsCopy.map((s) => s.id);
    setTree({ ...tree, sections: sectionsCopy });

    try {
      await reorderSections(versionId, orderedIds);
      await loadTree();
    } catch (err) {
      console.error('Failed to reorder sections:', err);
      alert('Failed to save section order: ' + err.message);
      await loadTree();
    }
  };

  // Table Handlers
  const handleOpenAddTable = (secId) => {
    setTableModal({
      show: true,
      sectionId: secId,
      isEdit: false,
      data: { id: null, title: '', tableKey: '', isRepeatable: true, showTitle: true },
    });
  };

  const handleOpenEditTable = (tbl, secId) => {
    setTableModal({
      show: true,
      sectionId: secId,
      isEdit: true,
      data: {
        id: tbl.id,
        title: tbl.title,
        tableKey: tbl.tableKey,
        isRepeatable: tbl.isRepeatable ?? true,
        showTitle: tbl.showTitle ?? true,
      },
    });
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    try {
      const sec = tree?.sections?.find((s) => s.id === tableModal.sectionId);
      const secKey = sec?.sectionKey || sec?.title || 'sec';

      // Collect all other table keys in the schema version tree
      const otherKeys = new Set();
      (tree?.sections || []).forEach((s) => {
        (s.tables || []).forEach((t) => {
          if (!tableModal.isEdit || t.id !== tableModal.data.id) {
            if (t.tableKey) otherKeys.add(t.tableKey.toLowerCase());
          }
        });
      });

      const title = (tableModal.data.title || '').trim();
      let key = (tableModal.data.tableKey || '').trim();
      if (!key) {
        key = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      } else {
        key = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      }
      if (!key) key = 'table_' + Date.now();

      // If key is already used by another table in this schema version, auto-disambiguate
      let candidateKey = key;
      if (otherKeys.has(candidateKey.toLowerCase())) {
        const prefix = secKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        candidateKey = `${prefix}_${key}`;
      }
      let suffix = 1;
      while (otherKeys.has(candidateKey.toLowerCase())) {
        candidateKey = `${key}_${++suffix}`;
      }

      if (tableModal.isEdit) {
        await updateTable(tableModal.data.id, {
          title: title,
          tableKey: candidateKey,
          isRepeatable: tableModal.data.isRepeatable,
          showTitle: tableModal.data.showTitle,
        });
      } else {
        await createTable(tableModal.sectionId, {
          sectionId: tableModal.sectionId,
          title: title,
          tableKey: candidateKey,
          isRepeatable: tableModal.data.isRepeatable,
          showTitle: tableModal.data.showTitle,
        });
      }
      setTableModal({ ...tableModal, show: false });
      await loadTree();
    } catch (err) {
      alert('Error saving table: ' + err.message);
    }
  };

  const handleDeleteTable = async (tblId) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try {
      await deleteTable(tblId);
      await loadTree();
    } catch (err) {
      alert('Error deleting table: ' + err.message);
    }
  };

  const handleMoveTable = async (tbl, tIdx, direction) => {
    if (!currentSection?.tables) return;
    const targetIdx = direction === 'up' ? tIdx - 1 : tIdx + 1;
    if (targetIdx < 0 || targetIdx >= currentSection.tables.length) return;

    const tablesCopy = [...currentSection.tables];
    const [moved] = tablesCopy.splice(tIdx, 1);
    tablesCopy.splice(targetIdx, 0, moved);

    const orderedIds = tablesCopy.map((t) => t.id);
    const updatedSections = tree.sections.map((s) =>
      s.id === currentSection.id ? { ...s, tables: tablesCopy } : s
    );
    setTree({ ...tree, sections: updatedSections });

    try {
      await reorderTables(currentSection.id, orderedIds);
      await loadTree();
    } catch (err) {
      console.error('Failed to reorder tables:', err);
      alert('Failed to save table order: ' + err.message);
      await loadTree();
    }
  };

  // Copy Table Handlers (Academic Flow Only)
  const handleOpenCopyTable = async (secId) => {
    setLoadingTables(true);
    try {
      const tables = await getAvailableTables(effectiveUniversityId, selectedUniversity?.code);
      setAvailableTables(tables || []);
      setCopyTableModal({
        show: true,
        sectionId: secId,
        sourceTableId: tables && tables.length > 0 ? String(tables[0].tableId) : '',
        newTitle: tables && tables.length > 0 ? `${tables[0].title} (Copy)` : '',
        newTableKey: '',
      });
    } catch (err) {
      alert('Failed to load available tables: ' + err.message);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleExecuteCopyTable = async (e) => {
    e.preventDefault();
    if (!copyTableModal.sourceTableId) {
      alert('Please select a source table to copy.');
      return;
    }
    try {
      await copyTable({
        sourceTableId: Number(copyTableModal.sourceTableId),
        targetSectionId: copyTableModal.sectionId,
        newTitle: copyTableModal.newTitle,
        newTableKey: copyTableModal.newTableKey,
      });
      setCopyTableModal({ ...copyTableModal, show: false });
      await loadTree();
    } catch (err) {
      alert('Failed to copy table: ' + (err.response?.data?.message || err.message));
    }
  };

  // Field / Column Handlers
  const handleOpenAddField = (secId, tblId = null) => {
    setFieldModal({
      show: true,
      sectionId: secId,
      tableId: tblId,
      isEdit: false,
      isReviewField: false,
      data: {
        id: null,
        label: '',
        fieldKey: '',
        fieldType: 'TEXT',
        kind: null,
        isRequired: false,
        placeholder: '',
        optionsString: '',
      },
    });
  };

  const handleOpenAddReviewField = (secId) => {
    setFieldModal({
      show: true,
      sectionId: secId,
      tableId: null,
      isEdit: false,
      isReviewField: true,
      data: {
        id: null,
        label: 'Review Remarks / Observations',
        fieldKey: 'reviewRemarks',
        fieldType: 'TEXTAREA',
        kind: 'review',
        isRequired: true,
        placeholder: 'Enter mandatory review remarks, suggestions, and audit observations...',
        optionsString: '',
      },
    });
  };

  const handleOpenEditField = (f, secId, tblId = null) => {
    const isReview = isReviewRemarkField(f);
    setFieldModal({
      show: true,
      sectionId: secId,
      tableId: tblId,
      isEdit: true,
      isReviewField: isReview,
      data: {
        id: f.id,
        label: f.label || '',
        fieldKey: f.fieldKey || '',
        fieldType: f.fieldType || 'TEXT',
        kind: f.kind || (isReview ? 'review' : null),
        isRequired: f.isRequired ?? (isReview ? true : false),
        placeholder: f.placeholder || '',
        optionsString: Array.isArray(f.options) ? f.options.join(', ') : '',
      },
    });
  };

  const handleSaveField = async (e) => {
    e.preventDefault();
    try {
      const opts = fieldModal.data.optionsString
        ? JSON.stringify(fieldModal.data.optionsString.split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      if (fieldModal.isEdit) {
        await updateField(fieldModal.data.id, {
          label: fieldModal.data.label,
          fieldKey: fieldModal.data.fieldKey,
          fieldType: fieldModal.data.fieldType,
          kind: fieldModal.data.kind || (fieldModal.isReviewField ? 'review' : null),
          isRequired: fieldModal.data.isRequired,
          placeholder: fieldModal.data.placeholder,
          options: opts,
        });
      } else {
        await createField(fieldModal.sectionId, {
          sectionId: fieldModal.sectionId,
          tableId: fieldModal.tableId,
          label: fieldModal.data.label,
          fieldKey: fieldModal.data.fieldKey,
          fieldType: fieldModal.data.fieldType,
          kind: fieldModal.data.kind || (fieldModal.isReviewField ? 'review' : null),
          isRequired: fieldModal.data.isRequired,
          placeholder: fieldModal.data.placeholder,
          options: opts,
        });
      }
      setFieldModal({ ...fieldModal, show: false });
      await loadTree();
    } catch (err) {
      alert('Error saving field/column: ' + err.message);
    }
  };

  const handleDeleteField = async (fId) => {
    if (!window.confirm('Are you sure you want to delete this field/column?')) return;
    try {
      await deleteField(fId);
      await loadTree();
    } catch (err) {
      alert('Error deleting field: ' + err.message);
    }
  };

  const handleMoveField = async (tbl, cIdx, direction) => {
    if (!tbl?.fields) return;
    const targetIdx = direction === 'left' ? cIdx - 1 : cIdx + 1;
    if (targetIdx < 0 || targetIdx >= tbl.fields.length) return;

    const fieldsCopy = [...tbl.fields];
    const [moved] = fieldsCopy.splice(cIdx, 1);
    fieldsCopy.splice(targetIdx, 0, moved);

    const orderedIds = fieldsCopy.map((f) => f.id);

    try {
      await reorderFields(tbl.id, orderedIds);
      await loadTree();
    } catch (err) {
      console.error('Failed to reorder fields:', err);
      alert('Failed to save column order: ' + err.message);
      await loadTree();
    }
  };

  // Publish
  const handlePublish = async () => {
    if (!window.confirm('Publishing will freeze this schema version and activate it immediately for all contributors. Continue?')) {
      return;
    }
    setPublishing(true);
    setPublishMessage(null);
    try {
      const published = await publishVersion(versionId, 'iqac-admin');
      setPublishMessage('✅ Schema version published and activated successfully!');
      if (onPublishSuccess) onPublishSuccess(published);
      await loadTree();
    } catch (err) {
      alert('Publish Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Loading Form Studio Tree...</p>
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="p-5 text-center">
        <div className="alert alert-danger" style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px' }}>
          {error || 'Version tree not found'}
        </div>
        <button
          className="btn btn-secondary"
          style={{ padding: '8px 18px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
          onClick={onBackToSchemas}
        >
          Back to Schemas
        </button>
      </div>
    );
  }

  const currentSection = tree.sections?.find((s) => s.id === activeSectionId) || tree.sections?.[0];

  const getPostLabel = (roleKey) => {
    if (!roleKey) return '-';
    if (roleKey === 'auditor') return '🔒 Designated for Auditor (Auditor Only)';
    const match = universityPosts.find((p) => p.code?.toLowerCase() === roleKey.toLowerCase() || p.name?.toLowerCase() === roleKey.toLowerCase());
    if (match) return `${match.name} (${match.code})`;
    return String(roleKey).replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      {/* Top Toolbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            onClick={onBackToSchemas}
          >
            ← Back
          </button>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '17px' }}>{tree.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: '#fef3c7', color: '#92400e' }}>
                Draft Version {tree.versionNumber}
              </span>
              <small style={{ color: '#64748b', fontSize: '12px' }}>
                Type: <strong>{isAdministrative ? 'ADMINISTRATIVE (Single Form)' : 'ACADEMIC (School-Based)'}</strong>
              </small>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {publishMessage && <span style={{ color: '#059669', fontWeight: 600, fontSize: '13px' }}>{publishMessage}</span>}
          <button
            type="button"
            style={{
              padding: '7px 14px',
              borderRadius: '7px',
              border: '1px solid #c7d2fe',
              background: '#eef2ff',
              color: '#4338ca',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setFullSchemaImportModal(true)}
            title="Upload a multi-sheet Excel file to create all Parts/Sections with their tables and columns at once"
          >
            <span>📑</span>
            <span>Import Full Form from Excel</span>
          </button>
          <button
            type="button"
            style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            onClick={() => onOpenPreview(versionId)}
          >
            👁️ Interactive Preview
          </button>
          <button
            type="button"
            style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? 'Publishing...' : '🚀 Publish & Activate Version'}
          </button>
        </div>
      </div>

      {/* Main 2-Pane Editor Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', flex: 1, minHeight: 'calc(100vh - 140px)' }}>
        {/* Left Tree Navigator */}
        <div style={{ background: '#fff', borderRight: '1px solid #e2e8f0', padding: '16px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Form Sections
            </span>
            <button
              type="button"
              style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '11.5px', cursor: 'pointer' }}
              onClick={handleOpenAddSection}
            >
              + Section
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tree.sections?.map((sec, idx) => {
              const isSelected = sec.id === currentSection?.id;
              const isAuditor = sec.ownerRole === 'auditor';
              return (
                <div
                  key={sec.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : '#fff',
                    border: isSelected ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                    color: isSelected ? '#1d4ed8' : '#0f172a',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 2px rgba(37,99,235,0.08)' : 'none',
                  }}
                  onClick={() => setActiveSectionId(sec.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                    {/* Section Sequence Up/Down Arrows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === 0 ? '#cbd5e1' : '#64748b',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '9px',
                          lineHeight: '1',
                          padding: '1px 3px',
                          borderRadius: '3px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSection(idx, 'up');
                        }}
                        title="Move Section Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === tree.sections.length - 1}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === tree.sections.length - 1 ? '#cbd5e1' : '#64748b',
                          cursor: idx === tree.sections.length - 1 ? 'not-allowed' : 'pointer',
                          fontSize: '9px',
                          lineHeight: '1',
                          padding: '1px 3px',
                          borderRadius: '3px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSection(idx, 'down');
                        }}
                        title="Move Section Down"
                      >
                        ▼
                      </button>
                    </div>

                    <span style={{ display: 'inline-block', minWidth: '18px', padding: '1px 5px', background: isSelected ? '#dbeafe' : '#f1f5f9', color: isSelected ? '#1e40af' : '#475569', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800, textAlign: 'center', flexShrink: 0 }}>
                      {sec.number || idx + 1}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                      {sec.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {isAuditor && (
                      <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 4px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }} title="Auditor Section">
                        🔒 Auditor
                      </span>
                    )}
                    <span style={{ fontSize: '10.5px', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: '999px', fontWeight: 600 }}>
                      {sec.tables?.length || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Canvas / Section Editor */}
        <div style={{ padding: '24px', overflowY: 'auto', background: '#f8fafc' }}>
          {currentSection ? (
            <div>
              {/* Section Header Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '5px', background: '#dbeafe', color: '#1e40af' }}>
                        Section {currentSection.number || 'A'}
                      </span>
                      {currentSection.ownerRole === 'auditor' && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                          🔒 Designated for Auditor
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#0f172a', fontSize: '18px' }}>{currentSection.title}</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '12.5px' }}>
                      {isAdministrative ? (
                        <span>
                          👔 Assigned Administrative Post: <strong className="text-primary">{getPostLabel(currentSection.ownerRole)}</strong>
                        </span>
                      ) : (
                        <span>
                          Owner Role: <strong>{currentSection.ownerRole === 'auditor' ? '🔒 Auditor (Exclusive)' : (currentSection.ownerRole || 'director-schools')}</strong>
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12.5px',
                        fontWeight: 650,
                        color: currentSection.ownerRole === 'auditor' ? '#92400e' : '#475569',
                        background: currentSection.ownerRole === 'auditor' ? '#fef3c7' : '#f1f5f9',
                        border: currentSection.ownerRole === 'auditor' ? '1px solid #fcd34d' : '1px solid #cbd5e1',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Mark this section to be filled exclusively by the Auditor during the review stage"
                    >
                      <input
                        type="checkbox"
                        checked={currentSection.ownerRole === 'auditor'}
                        onChange={(e) => handleToggleAuditorSection(currentSection, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>To be filled by Auditor</span>
                    </label>
                    <button
                      type="button"
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
                      onClick={() => handleOpenEditSection(currentSection)}
                    >
                      ✏️ Edit Section
                    </button>
                    <button
                      type="button"
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}
                      onClick={() => handleDeleteSection(currentSection.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Top-Level Fields in Section */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>📌 Header Fields (Non-table Inputs)</h4>
                  <button
                    type="button"
                    style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                    onClick={() => handleOpenAddField(currentSection.id, null)}
                  >
                    + Add Header Field
                  </button>
                </div>

                {(() => {
                  const headerFields = (currentSection.fields || []).filter(
                    (f) => !isReviewRemarkField(f)
                  );
                  return headerFields.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                      {headerFields.map((f) => (
                        <div key={f.id} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{f.label}</span>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', marginLeft: '6px' }}>
                              {f.fieldType}
                            </span>
                            {f.isRequired && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}
                              onClick={() => handleOpenEditField(f, currentSection.id, null)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#ef4444' }}
                              onClick={() => handleDeleteField(f.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: 0 }}>No header fields in this section.</p>
                  );
                })()}
              </div>

              {/* Tables in Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>📊 Tables in Section</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Excel Import button */}
                  <button
                    type="button"
                    style={{
                      padding: '6px 14px',
                      borderRadius: '7px',
                      border: '1px solid #86efac',
                      background: '#f0fdf4',
                      color: '#15803d',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onClick={() => setExcelImportModal({ show: true, section: currentSection })}
                    title="Upload an Excel sheet to automatically create tables with column headers"
                  >
                    <span>📥</span>
                    <span>Import Tables from Excel</span>
                  </button>

                  {/* Copy Table button ONLY appears in Academic Flow (not in Administrative flow) */}
                  {!isAdministrative && (
                    <button
                      type="button"
                      style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      onClick={() => handleOpenCopyTable(currentSection.id)}
                    >
                      📋 Copy Table from Another Form
                    </button>
                  )}
                  <button
                    type="button"
                    style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    onClick={() => handleOpenAddTable(currentSection.id)}
                  >
                    + Add New Table
                  </button>
                </div>
              </div>

              {currentSection.tables && currentSection.tables.length > 0 ? (
                currentSection.tables.map((tbl, tIdx) => (
                  <div key={tbl.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 3px', fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                          {tbl.title || `Table ${tIdx + 1}`}
                        </h4>
                        <small style={{ color: '#64748b', fontSize: '12px' }}>
                          Key: <code>{tbl.tableKey}</code> | {tbl.isRepeatable ? 'Dynamic Rows' : 'Fixed Form'}
                        </small>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Table Sequence Reordering */}
                        {currentSection.tables.length > 1 && (
                          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', background: '#fff' }}>
                            <button
                              type="button"
                              disabled={tIdx === 0}
                              style={{
                                border: 'none',
                                background: tIdx === 0 ? '#f8fafc' : '#fff',
                                color: tIdx === 0 ? '#cbd5e1' : '#334155',
                                cursor: tIdx === 0 ? 'not-allowed' : 'pointer',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRight: '1px solid #e2e8f0',
                              }}
                              onClick={() => handleMoveTable(tbl, tIdx, 'up')}
                              title="Move Table Up"
                            >
                              ▲ Up
                            </button>
                            <button
                              type="button"
                              disabled={tIdx === currentSection.tables.length - 1}
                              style={{
                                border: 'none',
                                background: tIdx === currentSection.tables.length - 1 ? '#f8fafc' : '#fff',
                                color: tIdx === currentSection.tables.length - 1 ? '#cbd5e1' : '#334155',
                                cursor: tIdx === currentSection.tables.length - 1 ? 'not-allowed' : 'pointer',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                              onClick={() => handleMoveTable(tbl, tIdx, 'down')}
                              title="Move Table Down"
                            >
                              ▼ Down
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          style={{ padding: '5px 11px', borderRadius: '6px', border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                          onClick={() => handleOpenAddField(currentSection.id, tbl.id)}
                        >
                          + Add Column
                        </button>
                        <button
                          type="button"
                          style={{ padding: '5px 11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                          onClick={() => handleOpenEditTable(tbl, currentSection.id)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}
                          onClick={() => handleDeleteTable(tbl.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Columns List */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>Columns:</span>
                        {tbl.fields && tbl.fields.length > 0 ? (
                          tbl.fields.map((col, cIdx) => (
                            <span
                              key={col.id}
                              style={{
                                background: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#0f172a',
                              }}
                            >
                              {/* Column Sequence Left/Right */}
                              {tbl.fields.length > 1 && (
                                <span style={{ display: 'inline-flex', gap: '1px', marginRight: '2px' }}>
                                  <button
                                    type="button"
                                    disabled={cIdx === 0}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: cIdx === 0 ? '#cbd5e1' : '#64748b',
                                      cursor: cIdx === 0 ? 'not-allowed' : 'pointer',
                                      fontSize: '9px',
                                      padding: '0 2px',
                                      lineHeight: '1',
                                    }}
                                    onClick={() => handleMoveField(tbl, cIdx, 'left')}
                                    title="Move Column Left"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    type="button"
                                    disabled={cIdx === tbl.fields.length - 1}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: cIdx === tbl.fields.length - 1 ? '#cbd5e1' : '#64748b',
                                      cursor: cIdx === tbl.fields.length - 1 ? 'not-allowed' : 'pointer',
                                      fontSize: '9px',
                                      padding: '0 2px',
                                      lineHeight: '1',
                                    }}
                                    onClick={() => handleMoveField(tbl, cIdx, 'right')}
                                    title="Move Column Right"
                                  >
                                    ▶
                                  </button>
                                </span>
                              )}
                              <span>{col.label || col.fieldKey}</span>
                              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 5px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px' }}>
                                {col.fieldType}
                              </span>
                              <button
                                type="button"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px' }}
                                onClick={() => handleOpenEditField(col, currentSection.id, tbl.id)}
                                title="Edit Column (Rename / Settings)"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: '#ef4444' }}
                                onClick={() => handleDeleteField(col.id)}
                                title="Delete Column"
                              >
                                ✕
                              </button>
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '12.5px' }}>⚠️ No columns defined. Add columns to allow data entry.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                  <p style={{ color: '#64748b', margin: '0 0 10px' }}>No tables created in this section yet.</p>
                  <button
                    type="button"
                    style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    onClick={() => handleOpenAddTable(currentSection.id)}
                  >
                    + Create First Table
                  </button>
                </div>
              )}

              {/* Review Remarks (Auditor Inputs) - Placed below tables */}
              {currentSection.ownerRole === 'auditor' && (() => {
                const reviewFields = (currentSection.fields || []).filter(
                  (f) => isReviewRemarkField(f)
                );
                const auditorSections = (tree?.sections || []).filter((s) => s.ownerRole === 'auditor');
                const isLastAuditorSec =
                  auditorSections.length > 0 && auditorSections[auditorSections.length - 1].id === currentSection.id;

                return (
                  <div
                    style={{
                      marginTop: '24px',
                      background: '#fff',
                      border: '1px solid #bbf7d0',
                      borderRadius: '12px',
                      padding: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                          📝 Review Remarks (Auditor Inputs)
                        </h4>
                        {isLastAuditorSec ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              background: '#dcfce7',
                              color: '#15803d',
                              borderRadius: '6px',
                              border: '1px solid #86efac',
                            }}
                          >
                            Final Auditor Section (Mandatory Review)
                          </span>
                        ) : auditorSections.length > 1 ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '3px 8px',
                              background: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '6px',
                              border: '1px solid #fcd34d',
                            }}
                          >
                            Auditor Section
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #86efac',
                          background: '#f0fdf4',
                          color: '#15803d',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenAddReviewField(currentSection.id)}
                      >
                        + Add Review Field
                      </button>
                    </div>

                    {reviewFields.length > 0 ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '10px',
                        }}
                      >
                        {reviewFields.map((f) => (
                          <div
                            key={f.id}
                            style={{
                              padding: '10px 12px',
                              border: '1px solid #bbf7d0',
                              borderRadius: '8px',
                              background: '#f0fdf4',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{f.label}</span>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  background: '#dcfce7',
                                  color: '#166534',
                                  borderRadius: '4px',
                                  marginLeft: '6px',
                                }}
                              >
                                {f.fieldType || 'TEXTAREA'}
                              </span>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  borderRadius: '4px',
                                  marginLeft: '4px',
                                }}
                              >
                                Mandatory*
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}
                                onClick={() => handleOpenEditField(f, currentSection.id, null)}
                                title="Edit Review Field"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#ef4444' }}
                                onClick={() => handleDeleteField(f.id)}
                                title="Delete Review Field"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#64748b', fontSize: '12.5px', margin: 0 }}>
                        No review remarks field added yet. Click <strong>+ Add Review Field</strong> to add a mandatory review textarea for this auditor section below the tables.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              Select or add a section from the left panel to start editing.
            </div>
          )}
        </div>
      </div>

      {/* Section Modal */}
      {sectionModal.show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>
                {sectionModal.isEdit ? '✏️ Edit Section' : '➕ Add New Section'}
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
                onClick={() => setSectionModal({ ...sectionModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveSection}>
              <div style={{ padding: '20px', display: 'grid', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Section Title*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder={isAdministrative ? 'e.g. Part A - General Governance & Records' : 'e.g. Part A - Academic & Teaching Activities'}
                    required
                    value={sectionModal.data.title}
                    onChange={(e) =>
                      setSectionModal({
                        ...sectionModal,
                        data: { ...sectionModal.data, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Section Number/Code</label>
                    <input
                      type="text"
                      style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                      placeholder="e.g. A, B, 1, 2"
                      value={sectionModal.data.sectionNumber}
                      onChange={(e) =>
                        setSectionModal({
                          ...sectionModal,
                          data: { ...sectionModal.data, sectionNumber: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                      {isAdministrative ? 'Assigned Post / Office*' : 'Owner Role'}
                    </label>
                    {sectionModal.data.ownerRole === 'auditor' ? (
                      <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '7px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
                        🔒 Auditor Section (Exclusive)
                      </div>
                    ) : isAdministrative ? (
                      <select
                        style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        value={sectionModal.data.ownerRole}
                        onChange={(e) =>
                          setSectionModal({
                            ...sectionModal,
                            data: { ...sectionModal.data, ownerRole: e.target.value },
                          })
                        }
                      >
                        {universityPosts.length === 0 ? (
                          <option value="">-- No administrative posts configured yet (add in Administrative Posts) --</option>
                        ) : (
                          universityPosts.map((post) => (
                            <option key={post.id} value={post.code.toLowerCase()}>
                              {post.name} ({post.code})
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <select
                        style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        value={sectionModal.data.ownerRole}
                        onChange={(e) =>
                          setSectionModal({
                            ...sectionModal,
                            data: { ...sectionModal.data, ownerRole: e.target.value },
                          })
                        }
                      >
                        <option value="director-schools">Director / Dean</option>
                        <option value="faculty">Faculty Member</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: 650,
                      color: sectionModal.data.ownerRole === 'auditor' ? '#92400e' : '#334155',
                      background: sectionModal.data.ownerRole === 'auditor' ? '#fef3c7' : '#f8fafc',
                      border: sectionModal.data.ownerRole === 'auditor' ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                      padding: '10px 12px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sectionModal.data.ownerRole === 'auditor'}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        const defaultRole = isAdministrative
                          ? (universityPosts[0]?.code?.toLowerCase() || 'registrar')
                          : 'director-schools';
                        setSectionModal({
                          ...sectionModal,
                          data: {
                            ...sectionModal.data,
                            ownerRole: isChecked ? 'auditor' : defaultRole,
                          },
                        });
                      }}
                    />
                    <span>To be filled by Auditor (Editable ONLY by Auditor)</span>
                  </label>
                  {sectionModal.data.ownerRole === 'auditor' && (
                    <small style={{ color: '#b45309', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                      ℹ️ When checked, submitters (Directors, Faculty, Administrative post users) cannot edit this section. It will be editable exclusively by the Auditor during the review stage.
                    </small>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Description</label>
                  <textarea
                    style={{ width: '100%', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box' }}
                    rows={2}
                    placeholder="Optional section description..."
                    value={sectionModal.data.description}
                    onChange={(e) =>
                      setSectionModal({
                        ...sectionModal,
                        data: { ...sectionModal.data, description: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setSectionModal({ ...sectionModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {tableModal.show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>
                {tableModal.isEdit ? '✏️ Edit Table' : '➕ Add New Table'}
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
                onClick={() => setTableModal({ ...tableModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTable}>
              <div style={{ padding: '20px', display: 'grid', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Table Title*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="e.g. Student Enrollment Statistics"
                    required
                    value={tableModal.data.title}
                    onChange={(e) =>
                      setTableModal({
                        ...tableModal,
                        data: { ...tableModal.data, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Table Key (Unique Identifier)</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="e.g. student_enrollment (leave blank to auto-generate)"
                    value={tableModal.data.tableKey}
                    onChange={(e) =>
                      setTableModal({
                        ...tableModal,
                        data: { ...tableModal.data, tableKey: e.target.value },
                      })
                    }
                  />
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tableModal.data.isRepeatable}
                      onChange={(e) =>
                        setTableModal({
                          ...tableModal,
                          data: { ...tableModal.data, isRepeatable: e.target.checked },
                        })
                      }
                    />
                    <span>Allow Dynamic Repeating Rows (Grid)</span>
                  </label>
                </div>
              </div>
              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setTableModal({ ...tableModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Table Modal (Academic Flow Only) */}
      {copyTableModal.show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>
                📋 Copy Table from Another Form (Avoid Rework)
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
                onClick={() => setCopyTableModal({ ...copyTableModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleExecuteCopyTable}>
              <div style={{ padding: '20px', display: 'grid', gap: '14px' }}>
                {loadingTables ? (
                  <p style={{ color: '#64748b', fontSize: '13px' }}>Loading available tables...</p>
                ) : availableTables.length === 0 ? (
                  <p style={{ color: '#dc2626', fontSize: '13px' }}>No existing tables available to copy from in this university.</p>
                ) : (
                  <>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Source Table to Copy*</label>
                      <select
                        style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        value={copyTableModal.sourceTableId}
                        onChange={(e) => {
                          const srcId = e.target.value;
                          const src = availableTables.find((t) => String(t.tableId) === String(srcId));
                          setCopyTableModal({
                            ...copyTableModal,
                            sourceTableId: srcId,
                            newTitle: src ? `${src.title} (Copy)` : '',
                          });
                        }}
                      >
                        {availableTables.map((t) => (
                          <option key={t.tableId} value={t.tableId}>
                            {t.title} (from: {t.schemaName})
                          </option>
                        ))}
                      </select>
                      <small style={{ color: '#64748b', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                        All columns from this source table will be duplicated into your section. You can rename, add, or remove columns afterwards.
                      </small>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>New Table Title</label>
                      <input
                        type="text"
                        style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        value={copyTableModal.newTitle}
                        onChange={(e) => setCopyTableModal({ ...copyTableModal, newTitle: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
              </div>
              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setCopyTableModal({ ...copyTableModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={availableTables.length === 0}
                  style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  📋 Copy Table Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field / Column Modal */}
      {fieldModal.show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>
                {fieldModal.isEdit
                  ? (fieldModal.isReviewField ? '✏️ Edit Review Remark Field' : '✏️ Edit Column / Field')
                  : fieldModal.isReviewField
                  ? '📝 Add Review Remark Field (Auditor)'
                  : fieldModal.tableId
                  ? '➕ Add Column to Table'
                  : '➕ Add Header Field'}
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
                onClick={() => setFieldModal({ ...fieldModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveField}>
              <div style={{ padding: '20px', display: 'grid', gap: '14px' }}>
                {fieldModal.isReviewField && (
                  <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '7px', fontSize: '12px', color: '#065f46', lineHeight: 1.4 }}>
                    🔒 <strong>Auditor Review Field:</strong> This field appears below the tables. The assigned auditor is required to complete this observation / review remarks field before submitting their review.
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                    {fieldModal.tableId ? 'Column Header / Label*' : 'Field Label*'}
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="e.g. Total Number of Students"
                    required
                    value={fieldModal.data.label}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        data: { ...fieldModal.data, label: e.target.value },
                      })
                    }
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Data Type</label>
                    <select
                      style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                      value={fieldModal.data.fieldType}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: { ...fieldModal.data, fieldType: e.target.value },
                        })
                      }
                    >
                      <option value="TEXT">Single Line Text</option>
                      <option value="TEXTAREA">Multi-line Textarea</option>
                      <option value="NUMBER">Number</option>
                      <option value="DROPDOWN">Dropdown / Select</option>
                      <option value="DATE">Date Picker</option>
                      <option value="RADIO">Radio Choices</option>
                      <option value="CHECKBOX">Checkbox</option>
                      <option value="FILE">Document / File Upload</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Field Key</label>
                    <input
                      type="text"
                      style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                      placeholder="e.g. total_students (auto)"
                      value={fieldModal.data.fieldKey}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: { ...fieldModal.data, fieldKey: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                {(fieldModal.data.fieldType === 'DROPDOWN' || fieldModal.data.fieldType === 'RADIO') && (
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Options (Comma-separated)</label>
                    <input
                      type="text"
                      style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                      placeholder="e.g. Yes, No, In Progress, N/A"
                      value={fieldModal.data.optionsString}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: { ...fieldModal.data, optionsString: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={fieldModal.data.isRequired}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: { ...fieldModal.data, isRequired: e.target.checked },
                        })
                      }
                    />
                    <span>{fieldModal.isReviewField ? 'Mandatory for Auditor (Required before submit)' : 'Mark as Required (Mandatory input)'}</span>
                  </label>
                </div>
              </div>
              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setFieldModal({ ...fieldModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Column / Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Table Import Modal (Single Section) */}
      {excelImportModal.show && (
        <ExcelTableImportModal
          show={excelImportModal.show}
          section={excelImportModal.section}
          onClose={() => setExcelImportModal({ show: false, section: null })}
          onImportSuccess={async () => {
            await loadTree();
          }}
        />
      )}

      {/* Excel Full Schema Import Modal (Multi-Section / Entire Form) */}
      {fullSchemaImportModal && (
        <ExcelFullSchemaImportModal
          show={fullSchemaImportModal}
          versionId={versionId}
          isAdministrative={isAdministrative}
          universityPosts={universityPosts}
          onClose={() => setFullSchemaImportModal(false)}
          onImportSuccess={async () => {
            await loadTree();
          }}
        />
      )}
    </div>
  );
};
