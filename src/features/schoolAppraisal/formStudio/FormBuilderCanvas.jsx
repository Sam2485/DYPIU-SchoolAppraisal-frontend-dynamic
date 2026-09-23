import { toast, confirmAction } from "../../../components/feedback/feedbackBus";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import {
  normalizeTableButtons,
  isTableAssignedToButton,
} from '../utils/tableButtonHelpers';

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

  // Dynamic Table Button Modal State (Repeater Groups)
  const [tableButtonModal, setTableButtonModal] = useState({
    show: false,
    isEdit: false,
    newOptionText: '',
    data: {
      id: null,
      label: '',
      dropdownLabel: '',
      dropdownOptions: [],
      assignedTableKeys: [],
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
      toast.error('Error updating auditor designation: ' + err.message);
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
      toast.error('Error saving section: ' + err.message);
    }
  };

  const handleDeleteSection = async (secId) => {
    if (!(await confirmAction('Are you sure you want to delete this entire section and all its tables?', { tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await deleteSection(secId);
      await loadTree();
    } catch (err) {
      toast.error('Error deleting section: ' + err.message);
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
      toast.error('Failed to save section order: ' + err.message);
      await loadTree();
    }
  };

  // Dynamic Table Button Handlers (Repeater Groups)
  const handleOpenAddTableButton = () => {
    setTableButtonModal({
      show: true,
      isEdit: false,
      newOptionText: '',
      data: {
        id: null,
        label: '',
        dropdownLabel: '',
        dropdownOptions: [],
        assignedTableKeys: [],
      },
    });
  };

  const handleOpenEditTableButton = (btn) => {
    const opts = Array.isArray(btn.dropdownOptions)
      ? [...btn.dropdownOptions]
      : typeof btn.dropdownOptions === 'string'
      ? btn.dropdownOptions.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    setTableButtonModal({
      show: true,
      isEdit: true,
      newOptionText: '',
      data: {
        id: btn.id,
        label: btn.label || '',
        dropdownLabel: btn.dropdownLabel || '',
        dropdownOptions: opts,
        assignedTableKeys: Array.isArray(btn.assignedTableKeys) ? [...btn.assignedTableKeys] : [],
      },
    });
  };

  const handleAddDropdownOption = (e) => {
    e?.preventDefault?.();
    const text = (tableButtonModal.newOptionText || '').trim();
    if (!text) return;

    const incoming = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const existing = tableButtonModal.data.dropdownOptions || [];
    const toAdd = incoming.filter((item) => !existing.includes(item));

    if (toAdd.length === 0) {
      toast.warning('Option already added.');
      return;
    }

    setTableButtonModal((prev) => ({
      ...prev,
      newOptionText: '',
      data: {
        ...prev.data,
        dropdownOptions: [...existing, ...toAdd],
      },
    }));
  };

  const handleRemoveDropdownOption = (optionToRemove) => {
    setTableButtonModal((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        dropdownOptions: (prev.data.dropdownOptions || []).filter((opt) => opt !== optionToRemove),
      },
    }));
  };

  const handleToggleAssignTable = (tableKey) => {
    setTableButtonModal((prev) => {
      const currentKeys = prev.data.assignedTableKeys || [];
      const exists = currentKeys.includes(tableKey);
      const updatedKeys = exists
        ? currentKeys.filter((k) => k !== tableKey)
        : [...currentKeys, tableKey];
      return {
        ...prev,
        data: {
          ...prev.data,
          assignedTableKeys: updatedKeys,
        },
      };
    });
  };

  const handleSelectAllTablesForButton = (allKeys) => {
    setTableButtonModal((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        assignedTableKeys: allKeys,
      },
    }));
  };

  const handleClearAllTablesForButton = () => {
    setTableButtonModal((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        assignedTableKeys: [],
      },
    }));
  };

  const handleSaveTableButton = async (e) => {
    e.preventDefault();
    if (!currentSection) return;

    const currentButtons = normalizeTableButtons(currentSection.tableButtons);
    let opts = [...(tableButtonModal.data.dropdownOptions || [])];

    if (tableButtonModal.newOptionText && tableButtonModal.newOptionText.trim()) {
      const extra = tableButtonModal.newOptionText.split(',').map((s) => s.trim()).filter(Boolean);
      extra.forEach((opt) => {
        if (!opts.includes(opt)) opts.push(opt);
      });
    }

    if (!tableButtonModal.data.label.trim()) {
      toast.warning('Please enter a button label (e.g. Add School Data).');
      return;
    }
    if (opts.length === 0) {
      toast.warning('Please add at least one dropdown option using "+ Add Option".');
      return;
    }
    if (tableButtonModal.data.assignedTableKeys.length === 0) {
      toast.warning('Please assign at least one table to this button.');
      return;
    }

    let updatedButtons;
    if (tableButtonModal.isEdit) {
      updatedButtons = currentButtons.map((b) =>
        b.id === tableButtonModal.data.id
          ? {
              ...b,
              label: tableButtonModal.data.label.trim(),
              dropdownLabel: tableButtonModal.data.dropdownLabel.trim() || 'Option',
              dropdownOptions: opts,
              assignedTableKeys: tableButtonModal.data.assignedTableKeys,
            }
          : b
      );
    } else {
      const newBtn = {
        id: `btn_${Date.now()}`,
        label: tableButtonModal.data.label.trim(),
        dropdownLabel: tableButtonModal.data.dropdownLabel.trim() || 'Option',
        dropdownOptions: opts,
        assignedTableKeys: tableButtonModal.data.assignedTableKeys,
      };
      updatedButtons = [...currentButtons, newBtn];
    }

    try {
      await updateSection(currentSection.id, {
        title: currentSection.title,
        sectionNumber: currentSection.number || '',
        ownerRole: currentSection.ownerRole || 'director-schools',
        description: currentSection.description || '',
        tableButtons: JSON.stringify(updatedButtons),
      });
      setTableButtonModal((prev) => ({ ...prev, show: false }));
      await loadTree();
    } catch (err) {
      toast.error('Error saving table button: ' + err.message);
    }
  };

  const handleDeleteTableButton = async (btnId) => {
    if (!(await confirmAction('Are you sure you want to delete this dynamic button? Its assigned tables will become permanently visible.', { tone: 'danger', confirmLabel: 'Delete' }))) return;
    if (!currentSection) return;

    const currentButtons = normalizeTableButtons(currentSection.tableButtons);
    const updatedButtons = currentButtons.filter((b) => b.id !== btnId);

    try {
      await updateSection(currentSection.id, {
        title: currentSection.title,
        sectionNumber: currentSection.number || '',
        ownerRole: currentSection.ownerRole || 'director-schools',
        description: currentSection.description || '',
        tableButtons: JSON.stringify(updatedButtons),
      });
      await loadTree();
    } catch (err) {
      toast.error('Error deleting table button: ' + err.message);
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
      toast.error('Error saving table: ' + err.message);
    }
  };

  const handleDeleteTable = async (tblId) => {
    if (!(await confirmAction('Are you sure you want to delete this table?', { tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await deleteTable(tblId);
      await loadTree();
    } catch (err) {
      toast.error('Error deleting table: ' + err.message);
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
      toast.error('Failed to save table order: ' + err.message);
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
      toast.error('Failed to load available tables: ' + err.message);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleExecuteCopyTable = async (e) => {
    e.preventDefault();
    if (!copyTableModal.sourceTableId) {
      toast.warning('Please select a source table to copy.');
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
      toast.error('Failed to copy table: ' + (err.response?.data?.message || err.message));
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
      toast.error('Error saving field/column: ' + err.message);
    }
  };

  const handleDeleteField = async (fId) => {
    if (!(await confirmAction('Are you sure you want to delete this field/column?', { tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await deleteField(fId);
      await loadTree();
    } catch (err) {
      toast.error('Error deleting field: ' + err.message);
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
      toast.error('Failed to save column order: ' + err.message);
      await loadTree();
    }
  };

  // Publish
  const handlePublish = async () => {
    const hasAuditorSection = tree?.sections?.some((sec) => {
      const role = (sec.ownerRole || '').toLowerCase();
      const key = (sec.sectionKey || sec.key || '').toLowerCase();
      const title = (sec.title || '').toLowerCase();
      return role.includes('auditor') || key.includes('auditor') || title.includes('auditor');
    });
    if (!hasAuditorSection) {
      toast.error('Cannot publish: Every form must contain at least one section designated for the Auditor (Auditor Section).');
      return;
    }

    if (!(await confirmAction('Publishing will freeze this schema version and activate it immediately for all contributors. Continue?', { confirmLabel: 'Publish' }))) {
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
      toast.error('Publish Failed: ' + (err.response?.data?.message || err.message));
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
        <div className="alert alert-danger" style={{ padding: "var(--space-7)", background: 'var(--red-50)', border: '1px solid var(--red-200)', color: 'var(--red-700)', borderRadius: "var(--radius-sm)", marginBottom: "var(--space-7)" }}>
          {error || 'Version tree not found'}
        </div>
        <button
          className="btn btn-secondary"
          style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Top Toolbar */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: "var(--space-5)" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-5)" }}>
          <button
            type="button"
            style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
            onClick={onBackToSchemas}
          >
            ← Back
          </button>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>{tree.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", marginTop: '2px' }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '2px 7px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)' }}>
                Draft Version {tree.versionNumber}
              </span>
              <small style={{ color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                Type: <strong>{isAdministrative ? 'ADMINISTRATIVE (Single Form)' : 'ACADEMIC (School-Based)'}</strong>
              </small>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)" }}>
          {publishMessage && <span style={{ color: 'var(--green-650)', fontWeight: 600, fontSize: "var(--text-base)" }}>{publishMessage}</span>}
          <button
            type="button"
            style={{
              padding: '7px 14px',
              borderRadius: "var(--radius-sm)",
              border: '1px solid var(--accent-border)',
              background: 'var(--accent-soft)',
              color: 'var(--primary-dark)',
              fontWeight: 700,
              fontSize: "var(--text-base)",
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: "var(--space-2)",
            }}
            onClick={() => setFullSchemaImportModal(true)}
            title="Upload a multi-sheet Excel file to create all Parts/Sections with their tables and columns at once"
          >
            <span>📑</span>
            <span>Import Full Form from Excel</span>
          </button>
          <button
            type="button"
            style={{ padding: '7px 14px', borderRadius: "var(--radius-sm)", border: '1px solid #93c5fd', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
            onClick={() => onOpenPreview(versionId)}
          >
            👁️ Interactive Preview
          </button>
          <button
            type="button"
            style={{ padding: '7px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--green-650)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
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
        <div style={{ background: 'var(--card)', borderRight: '1px solid var(--border)', padding: "var(--space-7)", overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-6)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Form Sections
            </span>
            <button
              type="button"
              style={{ padding: '4px 10px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-sm)", cursor: 'pointer' }}
              onClick={handleOpenAddSection}
            >
              + Section
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--space-1)" }}>
            {tree.sections?.map((sec, idx) => {
              const isSelected = sec.id === currentSection?.id;
              const isAuditor = sec.ownerRole === 'auditor';
              return (
                <div
                  key={sec.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: "var(--radius-sm)",
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--card)',
                    border: isSelected ? '1.5px solid #93c5fd' : '1px solid var(--border)',
                    color: isSelected ? 'var(--primary-dark)' : 'var(--ink)',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: "var(--text-base)",
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 2px rgba(37,99,235,0.08)' : 'none',
                  }}
                  onClick={() => setActiveSectionId(sec.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-1)", minWidth: 0, flex: 1 }}>
                    {/* Section Sequence Up/Down Arrows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === 0 ? 'var(--border-strong)' : 'var(--muted)',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          fontSize: "var(--text-3xs)",
                          lineHeight: '1',
                          padding: '1px 3px',
                          borderRadius: "var(--radius-2xs)",
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
                          color: idx === tree.sections.length - 1 ? 'var(--border-strong)' : 'var(--muted)',
                          cursor: idx === tree.sections.length - 1 ? 'not-allowed' : 'pointer',
                          fontSize: "var(--text-3xs)",
                          lineHeight: '1',
                          padding: '1px 3px',
                          borderRadius: "var(--radius-2xs)",
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

                    <span style={{ display: 'inline-block', minWidth: '18px', padding: '1px 5px', background: isSelected ? '#dbeafe' : 'var(--bg-alt)', color: isSelected ? '#1e40af' : '#475569', borderRadius: "var(--radius-2xs)", fontSize: "var(--text-2xs)", fontWeight: 800, textAlign: 'center', flexShrink: 0 }}>
                      {sec.number || idx + 1}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: "var(--text-base)" }}>
                      {sec.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-1)", flexShrink: 0 }}>
                    {isAuditor && (
                      <span style={{ fontSize: "var(--text-3xs)", fontWeight: 700, padding: '1px 4px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)', border: '1px solid var(--amber-200)' }} title="Auditor Section">
                        🔒 Auditor
                      </span>
                    )}
                    <span style={{ fontSize: "var(--text-2xs)", color: 'var(--muted)', background: 'var(--bg-alt)', padding: '1px 5px', borderRadius: "var(--radius-pill)", fontWeight: 600 }}>
                      {sec.tables?.length || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Canvas / Section Editor */}
        <div style={{ padding: "var(--space-9)", overflowY: 'auto', background: 'var(--bg)' }}>
          {currentSection ? (
            <div>
              {/* Section Header Card */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-8)", marginBottom: "var(--space-8)", boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: "var(--space-5)" }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 800, padding: '3px 8px', borderRadius: "var(--radius-2xs)", background: '#dbeafe', color: '#1e40af' }}>
                        Section {currentSection.number || 'A'}
                      </span>
                      {currentSection.ownerRole === 'auditor' && (
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '3px 8px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)', border: '1px solid #fcd34d' }}>
                          🔒 Designated for Auditor
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-xl)" }}>{currentSection.title}</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: "var(--text-base)" }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: "var(--space-2)",
                        fontSize: "var(--text-base)",
                        fontWeight: 650,
                        color: currentSection.ownerRole === 'auditor' ? 'var(--amber-700)' : '#475569',
                        background: currentSection.ownerRole === 'auditor' ? 'var(--amber-100)' : 'var(--bg-alt)',
                        border: currentSection.ownerRole === 'auditor' ? '1px solid #fcd34d' : '1px solid var(--border-strong)',
                        padding: '6px 12px',
                        borderRadius: "var(--radius-sm)",
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
                      style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                      onClick={() => handleOpenEditSection(currentSection)}
                    >
                      ✏️ Edit Section
                    </button>
                    <button
                      type="button"
                      style={{ padding: '6px 10px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', cursor: 'pointer' }}
                      onClick={() => handleDeleteSection(currentSection.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Top-Level Fields in Section */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-7)", marginBottom: "var(--space-9)", boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-6)" }}>
                  <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--ink)', fontSize: "var(--text-md)" }}>📌 Header Fields (Non-table Inputs)</h4>
                  <button
                    type="button"
                    style={{ padding: '5px 12px', borderRadius: "var(--radius-sm)", border: '1px solid #93c5fd', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: "var(--space-4)" }}>
                      {headerFields.map((f) => (
                        <div key={f.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: 'var(--ink)' }}>{f.label}</span>
                            <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: "var(--radius-2xs)", marginLeft: "var(--space-2)" }}>
                              {f.fieldType}
                            </span>
                            {f.isRequired && <span style={{ color: 'var(--red-500)', marginLeft: "var(--space-1)" }}>*</span>}
                          </div>
                          <div style={{ display: 'flex', gap: "var(--space-1)" }}>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}
                              onClick={() => handleOpenEditField(f, currentSection.id, null)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--red-500)' }}
                              onClick={() => handleDeleteField(f.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--muted)', fontSize: "var(--text-base)", margin: 0 }}>No header fields in this section.</p>
                  );
                })()}
              </div>

              {/* Dynamic Table Buttons (Repeater Groups) Panel */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-7)", marginBottom: "var(--space-9)", boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-6)", flexWrap: 'wrap', gap: "var(--space-4)" }}>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--ink)', fontSize: "var(--text-md)", display: 'flex', alignItems: 'center', gap: "var(--space-2)" }}>
                      <span>⚡ Dynamic Table Buttons (Repeater Groups)</span>
                    </h4>
                    <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                      Assign tables to action buttons. In the form, assigned tables stay hidden until the user clicks the button and switches entries via dropdown.
                    </p>
                  </div>
                  <button
                    type="button"
                    style={{ padding: '6px 14px', borderRadius: "var(--radius-sm)", border: '1px solid var(--accent-border)', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: "var(--space-1)" }}
                    onClick={handleOpenAddTableButton}
                  >
                    <span>➕ Add Table Button</span>
                  </button>
                </div>

                {(() => {
                  const buttons = normalizeTableButtons(currentSection.tableButtons);
                  if (buttons.length === 0) {
                    return (
                      <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px dashed var(--border-strong)', borderRadius: "var(--radius-sm)", color: 'var(--muted)', fontSize: "var(--text-base)", display: 'flex', alignItems: 'center', gap: "var(--space-3)" }}>
                        <span>ℹ️</span>
                        <span>No dynamic buttons configured for this section. All tables are permanently visible by default. Click <strong>+ Add Table Button</strong> to create one.</span>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: "var(--space-5)" }}>
                      {buttons.map((btn) => {
                        const assignedTables = (currentSection.tables || []).filter((tbl) => isTableAssignedToButton(tbl, btn));
                        const optionsList = Array.isArray(btn.dropdownOptions)
                          ? btn.dropdownOptions
                          : typeof btn.dropdownOptions === 'string'
                          ? btn.dropdownOptions.split(',').map((s) => s.trim()).filter(Boolean)
                          : [];

                        return (
                          <div
                            key={btn.id}
                            style={{
                              border: '1.5px solid var(--accent-border)',
                              borderRadius: "var(--radius-md)",
                              background: '#f8faff',
                              padding: "var(--space-6)",
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: "var(--space-4)",
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)" }}>
                                  <span style={{ fontSize: "var(--text-md)" }}>⚡</span>
                                  <strong style={{ fontSize: "var(--text-base)", color: '#1e3a8a' }}>{btn.label}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: "var(--space-1)" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditTableButton(btn)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', fontSize: "var(--text-base)" }}
                                    title="Edit Button"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTableButton(btn.id)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--red-500)', fontSize: "var(--text-base)" }}
                                    title="Delete Button"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>

                              <div style={{ fontSize: "var(--text-base)", color: '#475569', marginBottom: "var(--space-2)" }}>
                                Dropdown: <strong>{btn.dropdownLabel || 'Select'}</strong>
                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: "var(--space-1)", marginBottom: "var(--space-3)" }}>
                                {optionsList.map((opt, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: "var(--text-2xs)",
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      background: '#dbeafe',
                                      color: '#1e40af',
                                      borderRadius: "var(--radius-2xs)",
                                    }}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div style={{ borderTop: '1px solid #dbeafe', paddingTop: "var(--space-3)", fontSize: "var(--text-sm)", color: 'var(--muted)' }}>
                              <span>Assigned: <strong>{assignedTables.length} table(s)</strong></span>
                              {assignedTables.length > 0 && (
                                <span style={{ marginLeft: "var(--space-1)", color: 'var(--primary-dark)' }}>
                                  ({assignedTables.map((t) => t.title || t.tableKey).slice(0, 2).join(', ')}
                                  {assignedTables.length > 2 ? ` +${assignedTables.length - 2} more` : ''})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Tables in Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-7)", flexWrap: 'wrap', gap: "var(--space-4)" }}>
                <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>📊 Tables in Section</h4>
                <div style={{ display: 'flex', gap: "var(--space-3)", flexWrap: 'wrap' }}>
                  {/* Excel Import button */}
                  <button
                    type="button"
                    style={{
                      padding: '6px 14px',
                      borderRadius: "var(--radius-sm)",
                      border: '1px solid var(--green-300)',
                      background: 'var(--green-50)',
                      color: 'var(--green-600)',
                      fontWeight: 700,
                      fontSize: "var(--text-base)",
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: "var(--space-2)",
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
                      style={{ padding: '6px 14px', borderRadius: "var(--radius-sm)", border: '1px solid #93c5fd', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                      onClick={() => handleOpenCopyTable(currentSection.id)}
                    >
                      📋 Copy Table from Another Form
                    </button>
                  )}
                  <button
                    type="button"
                    style={{ padding: '6px 14px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                    onClick={() => handleOpenAddTable(currentSection.id)}
                  >
                    + Add New Table
                  </button>
                </div>
              </div>

              {currentSection.tables && currentSection.tables.length > 0 ? (
                currentSection.tables.map((tbl, tIdx) => (
                  <div key={tbl.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-lg)", padding: "var(--space-8)", marginBottom: "var(--space-8)", boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: "var(--space-6)", flexWrap: 'wrap', gap: "var(--space-4)" }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", flexWrap: 'wrap', marginBottom: "var(--space-1)" }}>
                          <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--ink)', fontSize: "var(--text-md)" }}>
                            {tbl.title || `Table ${tIdx + 1}`}
                          </h4>
                          {(() => {
                            const assignedBtn = (normalizeTableButtons(currentSection.tableButtons) || []).find((btn) => isTableAssignedToButton(tbl, btn));
                            if (assignedBtn) {
                              return (
                                <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '2px 8px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)', border: '1px solid var(--amber-200)' }}>
                                  ⚡ Assigned to: {assignedBtn.label}
                                </span>
                              );
                            }
                            return (
                              <span style={{ fontSize: "var(--text-xs)", fontWeight: 650, padding: '2px 8px', borderRadius: "var(--radius-2xs)", background: 'var(--bg-alt)', color: '#475569' }}>
                                📌 Permanent (Always Visible)
                              </span>
                            );
                          })()}
                        </div>
                        <small style={{ color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                          Key: <code>{tbl.tableKey}</code> | {tbl.isRepeatable ? 'Dynamic Rows' : 'Fixed Form'}
                        </small>
                      </div>
                      <div style={{ display: 'flex', gap: "var(--space-2)", alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Table Sequence Reordering */}
                        {currentSection.tables.length > 1 && (
                          <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", overflow: 'hidden', background: 'var(--card)' }}>
                            <button
                              type="button"
                              disabled={tIdx === 0}
                              style={{
                                border: 'none',
                                background: tIdx === 0 ? 'var(--bg)' : 'var(--card)',
                                color: tIdx === 0 ? 'var(--border-strong)' : '#334155',
                                cursor: tIdx === 0 ? 'not-allowed' : 'pointer',
                                padding: '4px 8px',
                                fontSize: "var(--text-xs)",
                                fontWeight: 700,
                                borderRight: '1px solid var(--border)',
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
                                background: tIdx === currentSection.tables.length - 1 ? 'var(--bg)' : 'var(--card)',
                                color: tIdx === currentSection.tables.length - 1 ? 'var(--border-strong)' : '#334155',
                                cursor: tIdx === currentSection.tables.length - 1 ? 'not-allowed' : 'pointer',
                                padding: '4px 8px',
                                fontSize: "var(--text-xs)",
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
                          style={{ padding: '5px 11px', borderRadius: "var(--radius-sm)", border: '1px solid #93c5fd', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                          onClick={() => handleOpenAddField(currentSection.id, tbl.id)}
                        >
                          + Add Column
                        </button>
                        <button
                          type="button"
                          style={{ padding: '5px 11px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                          onClick={() => handleOpenEditTable(tbl, currentSection.id)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          style={{ padding: '5px 8px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', cursor: 'pointer' }}
                          onClick={() => handleDeleteTable(tbl.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Columns List */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", padding: "var(--space-5)", background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: "var(--space-3)", alignItems: 'center' }}>
                        <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: 'var(--muted)', marginRight: "var(--space-1)" }}>Columns:</span>
                        {tbl.fields && tbl.fields.length > 0 ? (
                          tbl.fields.map((col, cIdx) => (
                            <span
                              key={col.id}
                              style={{
                                background: 'var(--card)',
                                border: '1px solid var(--border-strong)',
                                borderRadius: "var(--radius-sm)",
                                padding: '4px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: "var(--space-2)",
                                fontSize: "var(--text-base)",
                                fontWeight: 600,
                                color: 'var(--ink)',
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
                                      color: cIdx === 0 ? 'var(--border-strong)' : 'var(--muted)',
                                      cursor: cIdx === 0 ? 'not-allowed' : 'pointer',
                                      fontSize: "var(--text-3xs)",
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
                                      color: cIdx === tbl.fields.length - 1 ? 'var(--border-strong)' : 'var(--muted)',
                                      cursor: cIdx === tbl.fields.length - 1 ? 'not-allowed' : 'pointer',
                                      fontSize: "var(--text-3xs)",
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
                              <span style={{ fontSize: "var(--text-3xs)", fontWeight: 700, padding: '2px 5px', background: '#dbeafe', color: '#1e40af', borderRadius: "var(--radius-2xs)" }}>
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
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: 'var(--red-500)' }}
                                onClick={() => handleDeleteField(col.id)}
                                title="Delete Column"
                              >
                                ✕
                              </button>
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--red-500)', fontSize: "var(--text-base)" }}>⚠️ No columns defined. Add columns to allow data entry.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ background: 'var(--card)', border: '1px dashed var(--border-strong)', borderRadius: "var(--radius-lg)", padding: "var(--space-10)", textAlign: 'center' }}>
                  <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>No tables created in this section yet.</p>
                  <button
                    type="button"
                    style={{ padding: '6px 14px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
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
                      marginTop: "var(--space-9)",
                      background: 'var(--card)',
                      border: '1px solid var(--green-200)',
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-7)",
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: "var(--space-6)",
                        flexWrap: 'wrap',
                        gap: "var(--space-3)",
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--ink)', fontSize: "var(--text-md)" }}>
                          📝 Review Remarks (Auditor Inputs)
                        </h4>
                        {isLastAuditorSec ? (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: 700,
                              padding: '3px 8px',
                              background: 'var(--green-100)',
                              color: 'var(--green-600)',
                              borderRadius: "var(--radius-sm)",
                              border: '1px solid var(--green-300)',
                            }}
                          >
                            Final Auditor Section (Mandatory Review)
                          </span>
                        ) : auditorSections.length > 1 ? (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              padding: '3px 8px',
                              background: 'var(--amber-100)',
                              color: 'var(--amber-700)',
                              borderRadius: "var(--radius-sm)",
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
                          borderRadius: "var(--radius-sm)",
                          border: '1px solid var(--green-300)',
                          background: 'var(--green-50)',
                          color: 'var(--green-600)',
                          fontWeight: 600,
                          fontSize: "var(--text-base)",
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
                          gap: "var(--space-4)",
                        }}
                      >
                        {reviewFields.map((f) => (
                          <div
                            key={f.id}
                            style={{
                              padding: '10px 12px',
                              border: '1px solid var(--green-200)',
                              borderRadius: "var(--radius-sm)",
                              background: 'var(--green-50)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: 'var(--ink)' }}>{f.label}</span>
                              <span
                                style={{
                                  fontSize: "var(--text-2xs)",
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  background: 'var(--green-100)',
                                  color: 'var(--green-700)',
                                  borderRadius: "var(--radius-2xs)",
                                  marginLeft: "var(--space-2)",
                                }}
                              >
                                {f.fieldType || 'TEXTAREA'}
                              </span>
                              <span
                                style={{
                                  fontSize: "var(--text-2xs)",
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  background: 'var(--red-100)',
                                  color: 'var(--red-800)',
                                  borderRadius: "var(--radius-2xs)",
                                  marginLeft: "var(--space-1)",
                                }}
                              >
                                Mandatory*
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: "var(--space-1)" }}>
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
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--red-500)' }}
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
                      <p style={{ color: 'var(--muted)', fontSize: "var(--text-base)", margin: 0 }}>
                        No review remarks field added yet. Click <strong>+ Add Review Field</strong> to add a mandatory review textarea for this auditor section below the tables.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
              Select or add a section from the left panel to start editing.
            </div>
          )}
        </div>
      </div>

      {/* Section Modal */}
      {sectionModal.show && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: "var(--space-8)" }}>
          <div style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: "var(--radius-lg)", overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
                {sectionModal.isEdit ? '✏️ Edit Section' : '➕ Add New Section'}
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setSectionModal({ ...sectionModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveSection} style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-6)" }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Section Title*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: "var(--space-4)" }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Section Number/Code</label>
                    <input
                      type="text"
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>
                      {isAdministrative ? 'Assigned Post / Office*' : 'Owner Role'}
                    </label>
                    {sectionModal.data.ownerRole === 'auditor' ? (
                      <div style={{ padding: '8px 12px', background: 'var(--amber-100)', border: '1px solid #fcd34d', borderRadius: "var(--radius-sm)", fontSize: "var(--text-base)", fontWeight: 700, color: 'var(--amber-700)' }}>
                        🔒 Auditor Section (Exclusive)
                      </div>
                    ) : isAdministrative ? (
                      <select
                        style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                        style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                      gap: "var(--space-3)",
                      fontSize: "var(--text-base)",
                      fontWeight: 650,
                      color: sectionModal.data.ownerRole === 'auditor' ? 'var(--amber-700)' : '#334155',
                      background: sectionModal.data.ownerRole === 'auditor' ? 'var(--amber-100)' : 'var(--bg)',
                      border: sectionModal.data.ownerRole === 'auditor' ? '1px solid #fcd34d' : '1px solid var(--border)',
                      padding: '10px 12px',
                      borderRadius: "var(--radius-sm)",
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
                    <small style={{ color: 'var(--amber-650)', fontSize: "var(--text-sm)", marginTop: "var(--space-1)", display: 'block' }}>
                      ℹ️ When checked, submitters (Directors, Faculty, Administrative post users) cannot edit this section. It will be editable exclusively by the Auditor during the review stage.
                    </small>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Description</label>
                  <textarea
                    style={{ width: '100%', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '8px 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setSectionModal({ ...sectionModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Table Modal */}
      {tableModal.show && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: "var(--space-8)" }}>
          <div style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: "var(--radius-lg)", overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
                {tableModal.isEdit ? '✏️ Edit Table' : '➕ Add New Table'}
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setTableModal({ ...tableModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTable} style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-6)" }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Table Title*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Table Key (Unique Identifier)</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                <div style={{ display: 'flex', gap: "var(--space-8)" }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", fontSize: "var(--text-base)", cursor: 'pointer' }}>
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
              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setTableModal({ ...tableModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Copy Table Modal (Academic Flow Only) */}
      {copyTableModal.show && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: "var(--space-8)" }}>
          <div style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: "var(--radius-lg)", overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
                📋 Copy Table from Another Form (Avoid Rework)
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setCopyTableModal({ ...copyTableModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleExecuteCopyTable} style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-6)" }}>
                {loadingTables ? (
                  <p style={{ color: 'var(--muted)', fontSize: "var(--text-base)" }}>Loading available tables...</p>
                ) : availableTables.length === 0 ? (
                  <p style={{ color: 'var(--red-600)', fontSize: "var(--text-base)" }}>No existing tables available to copy from in this university.</p>
                ) : (
                  <>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Source Table to Copy*</label>
                      <select
                        style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                      <small style={{ color: 'var(--muted)', fontSize: "var(--text-sm)", marginTop: "var(--space-1)", display: 'block' }}>
                        All columns from this source table will be duplicated into your section. You can rename, add, or remove columns afterwards.
                      </small>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>New Table Title</label>
                      <input
                        type="text"
                        style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                        value={copyTableModal.newTitle}
                        onChange={(e) => setCopyTableModal({ ...copyTableModal, newTitle: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
              </div>
              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setCopyTableModal({ ...copyTableModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={availableTables.length === 0}
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  📋 Copy Table Structure
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Field / Column Modal */}
      {fieldModal.show && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: "var(--space-8)" }}>
          <div style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: "var(--radius-lg)", overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
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
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setFieldModal({ ...fieldModal, show: false })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveField} style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-6)" }}>
                {fieldModal.isReviewField && (
                  <div style={{ padding: '8px 12px', background: 'var(--teal-soft)', border: '1px solid var(--green-250)', borderRadius: "var(--radius-sm)", fontSize: "var(--text-base)", color: 'var(--green-800)', lineHeight: 1.4 }}>
                    🔒 <strong>Auditor Review Field:</strong> This field appears below the tables. The assigned auditor is required to complete this observation / review remarks field before submitting their review.
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>
                    {fieldModal.tableId ? 'Column Header / Label*' : 'Field Label*'}
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: "var(--space-4)" }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Data Type</label>
                    <select
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Field Key</label>
                    <input
                      type="text"
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Options (Comma-separated)</label>
                    <input
                      type="text"
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: "var(--space-3)", fontSize: "var(--text-base)", cursor: 'pointer' }}>
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
              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setFieldModal({ ...fieldModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Column / Field
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Table Button Modal (Repeater Groups) */}
      {tableButtonModal.show && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: "var(--space-8)" }}>
          <div style={{ width: '100%', maxWidth: '580px', background: 'var(--card)', borderRadius: "var(--radius-lg)", overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)", display: 'flex', alignItems: 'center', gap: "var(--space-2)" }}>
                <span>{tableButtonModal.isEdit ? '✏️ Edit Dynamic Table Button' : '⚡ Add Dynamic Table Button'}</span>
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setTableButtonModal({ ...tableButtonModal, show: false })}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTableButton} style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-7)" }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 650, fontSize: "var(--text-base)", marginBottom: "var(--space-1)", color: '#1e293b' }}>
                    Button Label*
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder="e.g. Add School Data, Add Department, Add Laboratory"
                    required
                    value={tableButtonModal.data.label}
                    onChange={(e) =>
                      setTableButtonModal({
                        ...tableButtonModal,
                        data: { ...tableButtonModal.data, label: e.target.value },
                      })
                    }
                  />
                  <small style={{ color: 'var(--muted)', fontSize: "var(--text-sm)", marginTop: '2px', display: 'block' }}>
                    The label shown on the trigger button in the form (e.g. "+ Add School Data").
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 650, fontSize: "var(--text-base)", marginBottom: "var(--space-1)", color: '#1e293b' }}>
                    Dropdown Label*
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder="e.g. Select School, Department, Category"
                    required
                    value={tableButtonModal.data.dropdownLabel}
                    onChange={(e) =>
                      setTableButtonModal({
                        ...tableButtonModal,
                        data: { ...tableButtonModal.data, dropdownLabel: e.target.value },
                      })
                    }
                  />
                  <small style={{ color: 'var(--muted)', fontSize: "var(--text-sm)", marginTop: '2px', display: 'block' }}>
                    Title shown above the instance switcher dropdown in the form (e.g. "Select School").
                  </small>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-1)" }}>
                    <label style={{ fontWeight: 650, fontSize: "var(--text-base)", color: '#1e293b' }}>
                      Dropdown Options* ({tableButtonModal.data.dropdownOptions?.length || 0} added)
                    </label>
                    {tableButtonModal.data.dropdownOptions?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTableButtonModal((prev) => ({
                            ...prev,
                            data: { ...prev.data, dropdownOptions: [] },
                          }))
                        }
                        style={{ border: 'none', background: 'transparent', color: 'var(--red-600)', fontSize: "var(--text-sm)", fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        Clear all options
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                    <input
                      type="text"
                      style={{ flex: 1, height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                      placeholder="Type option name (e.g. SOD, SOEMR) and click Add Option..."
                      value={tableButtonModal.newOptionText || ''}
                      onChange={(e) =>
                        setTableButtonModal({
                          ...tableButtonModal,
                          newOptionText: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDropdownOption(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddDropdownOption}
                      style={{
                        padding: '0 16px',
                        height: '38px',
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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>➕ Add Option</span>
                    </button>
                  </div>

                  {/* Pills List */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: "var(--space-2)",
                      padding: '8px 10px',
                      background: 'var(--bg)',
                      borderRadius: "var(--radius-sm)",
                      border: '1px solid var(--border)',
                      minHeight: '44px',
                      alignItems: 'center',
                    }}
                  >
                    {(!tableButtonModal.data.dropdownOptions || tableButtonModal.data.dropdownOptions.length === 0) ? (
                      <span style={{ color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                        No options added yet. Type an option above and click "+ Add Option".
                      </span>
                    ) : (
                      tableButtonModal.data.dropdownOptions.map((opt, idx) => (
                        <span
                          key={`${opt}-${idx}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: "var(--space-2)",
                            padding: '4px 10px',
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent-border)',
                            color: '#1e40af',
                            borderRadius: "var(--radius-pill)",
                            fontSize: "var(--text-base)",
                            fontWeight: 700,
                          }}
                        >
                          <span>{opt}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDropdownOption(opt)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--muted)',
                              cursor: 'pointer',
                              fontSize: "var(--text-base)",
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red-500)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
                            title={`Remove ${opt}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: "var(--text-sm)", marginTop: "var(--space-1)", display: 'block' }}>
                    Allowed values users can add and switch between in the form.
                  </small>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "var(--space-2)" }}>
                    <label style={{ fontWeight: 650, fontSize: "var(--text-base)", color: '#1e293b' }}>
                      Assign Tables in this Section* ({tableButtonModal.data.assignedTableKeys.length} selected)
                    </label>
                    {currentSection?.tables?.length > 0 && (
                      <div style={{ display: 'flex', gap: "var(--space-2)" }}>
                        <button
                          type="button"
                          onClick={() => handleSelectAllTablesForButton(currentSection.tables.map((t) => t.tableKey || t.idString || String(t.id)))}
                          style={{ border: 'none', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontSize: "var(--text-sm)", fontWeight: 650, padding: '2px 6px', borderRadius: "var(--radius-2xs)", cursor: 'pointer' }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllTablesForButton}
                          style={{ border: 'none', background: 'var(--bg-alt)', color: '#475569', fontSize: "var(--text-sm)", fontWeight: 650, padding: '2px 6px', borderRadius: "var(--radius-2xs)", cursor: 'pointer' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                    Check the tables that should appear when this button is clicked. Unchecked tables remain permanently visible.
                  </p>

                  <div style={{ border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", maxHeight: '200px', overflowY: 'auto', padding: "var(--space-3)", display: 'flex', flexDirection: 'column', gap: "var(--space-2)", background: 'var(--bg)' }}>
                    {(!currentSection?.tables || currentSection.tables.length === 0) ? (
                      <div style={{ padding: "var(--space-5)", textAlign: 'center', color: 'var(--muted)', fontSize: "var(--text-base)" }}>
                        No tables in this section yet. Add tables first, then assign them to buttons.
                      </div>
                    ) : (
                      currentSection.tables.map((t, idx) => {
                        const tKey = t.tableKey || t.idString || String(t.id);
                        const isChecked = tableButtonModal.data.assignedTableKeys.includes(tKey);

                        return (
                          <label
                            key={t.id || tKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: "var(--space-3)",
                              padding: '6px 10px',
                              borderRadius: "var(--radius-sm)",
                              background: isChecked ? 'var(--accent-soft)' : 'var(--card)',
                              border: isChecked ? '1px solid #93c5fd' : '1px solid var(--border)',
                              cursor: 'pointer',
                              fontSize: "var(--text-base)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleAssignTable(tKey)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: 650, color: isChecked ? 'var(--primary-dark)' : '#1e293b', flex: 1 }}>
                              {idx + 1}. {t.title || tKey}
                            </span>
                            <code style={{ fontSize: "var(--text-xs)", color: 'var(--muted)' }}>{tKey}</code>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setTableButtonModal({ ...tableButtonModal, show: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Table Button
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Excel Table Import Modal (Single Section) */}
      {excelImportModal.show && typeof document !== 'undefined' && createPortal(
        <ExcelTableImportModal
          show={excelImportModal.show}
          section={excelImportModal.section}
          onClose={() => setExcelImportModal({ show: false, section: null })}
          onImportSuccess={async () => {
            await loadTree();
          }}
        />,
        document.body
      )}

      {/* Excel Full Schema Import Modal (Multi-Section / Entire Form) */}
      {fullSchemaImportModal && typeof document !== 'undefined' && createPortal(
        <ExcelFullSchemaImportModal
          show={fullSchemaImportModal}
          versionId={versionId}
          isAdministrative={isAdministrative}
          universityPosts={universityPosts}
          onClose={() => setFullSchemaImportModal(false)}
          onImportSuccess={async () => {
            await loadTree();
          }}
        />,
        document.body
      )}
    </div>
  );
};
