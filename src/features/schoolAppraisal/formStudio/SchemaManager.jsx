import { toast, confirmAction } from "../../../components/feedback/feedbackBus";
import React, { useState, useEffect } from 'react';import { GraduationCapIcon, BuildingIcon, IconBadge, EmptyState, InfoBadgeIcon, TipBadgeIcon } from './StudioIcons';
import {
  getSchemas,
  getSchemaDetails,
  createSchema,
  updateSchema,
  cloneSchema,
  deleteSchema,
  createDraftVersion,
  deleteVersion,
  rollbackVersion,
  getUniversitySchools,
} from './formStudioApi';

export const SchemaManager = ({
  selectedUniversity,
  formType = 'academic', // 'academic' or 'administrative'
  onOpenBuilder,
  onOpenPreview,
}) => {
  const [schemas, setSchemas] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [versions, setVersions] = useState([]);
  const [universitySchools, setUniversitySchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create Schema Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cloneFromSchemaId, setCloneFromSchemaId] = useState('');
  const [newSchemaScope, setNewSchemaScope] = useState('ALL'); // 'ALL' or 'SPECIFIC'
  const [selectedSchoolCodes, setSelectedSchoolCodes] = useState([]);
  const [newSchemaForm, setNewSchemaForm] = useState({
    auditType: formType,
    name: '',
    description: '',
  });

  // Edit Scope Modal State (Academic only)
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [editScopeSchema, setEditScopeSchema] = useState(null);
  const [editScopeMode, setEditScopeMode] = useState('ALL');
  const [editScopeSchools, setEditScopeSchools] = useState([]);
  const [editScopeName, setEditScopeName] = useState('');

  const effectiveUniversityId = selectedUniversity?.id || 1;
  const isAdministrative = formType === 'administrative';

  const loadSchools = async () => {
    if (!effectiveUniversityId || isAdministrative) return;
    try {
      const schools = await getUniversitySchools(effectiveUniversityId, true);
      setUniversitySchools(schools || []);
    } catch (err) {
      console.error('Failed to load schools in SchemaManager:', err);
    }
  };

  const loadSchemas = async () => {
    if (!selectedUniversity) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSchemas(selectedUniversity.id, selectedUniversity.code, formType);
      setSchemas(data || []);
      if (data && data.length > 0) {
        const match = selectedSchema ? data.find((s) => s.id === selectedSchema.id) : null;
        handleSelectSchema(match || data[0]);
      } else {
        setSelectedSchema(null);
        setVersions([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
    loadSchemas();
  }, [selectedUniversity, formType]);

  const handleSelectSchema = async (s) => {
    setSelectedSchema(s);
    try {
      const details = await getSchemaDetails(s.id);
      setVersions(details.versions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDraft = async (schemaId) => {
    try {
      const existingDraft = versions.find((v) => String(v.status || '').toUpperCase() === 'DRAFT');
      if (existingDraft?.id) {
        onOpenBuilder(existingDraft.id);
        return;
      }
      const draft = await createDraftVersion(schemaId, 'iqac-admin');
      await handleSelectSchema(selectedSchema);
      if (draft?.id) {
        onOpenBuilder(draft.id);
      }
    } catch (err) {
      toast.error('Error creating/opening draft: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRollback = async (targetVersionId) => {
    if (!(await confirmAction('Are you sure you want to rollback the active form to Version ' + targetVersionId + '?', { tone: 'danger', confirmLabel: 'Roll back' }))) {
      return;
    }
    try {
      await rollbackVersion(selectedSchema.id, targetVersionId);
      await loadSchemas();
      toast.success('Rollback successful.');
    } catch (err) {
      toast.error('Error rolling back: ' + err.message);
    }
  };

  const handleDeleteSchema = async (schema) => {
    if (!(await confirmAction(`Are you sure you want to permanently delete the Form Schema "${schema.name}" and all its versions?`, { tone: 'danger', confirmLabel: 'Delete' }))) {
      return;
    }
    try {
      await deleteSchema(schema.id);
      await loadSchemas();
    } catch (err) {
      toast.error('Failed to delete schema: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteVersion = async (version) => {
    if (!(await confirmAction(`Are you sure you want to delete Version V${version.versionNumber} (${version.status})?`, { tone: 'danger', confirmLabel: 'Delete' }))) {
      return;
    }
    try {
      await deleteVersion(version.id);
      if (selectedSchema) {
        await handleSelectSchema(selectedSchema);
      }
      await loadSchemas();
    } catch (err) {
      toast.error('Failed to delete version: ' + (err.response?.data?.message || err.message));
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = (cloneSource = null) => {
    if (cloneSource) {
      setCloneFromSchemaId(String(cloneSource.id));
      setNewSchemaForm({
        auditType: formType,
        name: `${cloneSource.name} (Copy)`,
        description: cloneSource.description || '',
      });
      setNewSchemaScope('SPECIFIC');
      setSelectedSchoolCodes([]);
    } else {
      setCloneFromSchemaId('');
      setNewSchemaForm({
        auditType: formType,
        name: isAdministrative
          ? `${selectedUniversity?.name || 'University'} Administrative Appraisal Form`
          : '',
        description: '',
      });
      setNewSchemaScope('ALL');
      setSelectedSchoolCodes([]);
    }
    setShowCreateModal(true);
  };

  const handleToggleSchoolCode = (code) => {
    if (selectedSchoolCodes.includes(code)) {
      setSelectedSchoolCodes(selectedSchoolCodes.filter((c) => c !== code));
    } else {
      setSelectedSchoolCodes([...selectedSchoolCodes, code]);
    }
  };

  const handleCreateSchemaSubmit = async (e) => {
    e.preventDefault();
    try {
      const assigned = isAdministrative
        ? 'ALL'
        : newSchemaScope === 'ALL'
          ? 'ALL'
          : JSON.stringify(selectedSchoolCodes);

      if (cloneFromSchemaId) {
        // Clone from existing schema
        await cloneSchema(cloneFromSchemaId, {
          newName: newSchemaForm.name,
          auditType: formType,
          universityId: selectedUniversity.id,
          assignedSchools: assigned,
        });
      } else {
        // Create new schema from scratch
        await createSchema({
          ...newSchemaForm,
          auditType: formType,
          assignedSchools: assigned,
          universityId: selectedUniversity.id,
        });
      }

      setShowCreateModal(false);
      await loadSchemas();
    } catch (err) {
      toast.error('Failed to create/clone schema: ' + (err.response?.data?.message || err.message));
    }
  };

  // Open Edit Scope Modal (Academic Only)
  const handleOpenEditScope = (schema) => {
    setEditScopeSchema(schema);
    setEditScopeName(schema.name || '');
    const isAll = !schema.assignedSchools || schema.assignedSchools === 'ALL';
    setEditScopeMode(isAll ? 'ALL' : 'SPECIFIC');
    try {
      if (!isAll && schema.assignedSchools) {
        const parsed = JSON.parse(schema.assignedSchools);
        setEditScopeSchools(Array.isArray(parsed) ? parsed : [schema.assignedSchools]);
      } else {
        setEditScopeSchools([]);
      }
    } catch {
      setEditScopeSchools(schema.assignedSchools ? [schema.assignedSchools] : []);
    }
    setShowEditScopeModal(true);
  };

  const handleSaveScopeSubmit = async (e) => {
    e.preventDefault();
    try {
      const assigned = editScopeMode === 'ALL'
        ? 'ALL'
        : JSON.stringify(editScopeSchools);

      await updateSchema(editScopeSchema.id, {
        name: editScopeName,
        assignedSchools: assigned,
      });

      setShowEditScopeModal(false);
      await loadSchemas();
    } catch (err) {
      toast.error('Failed to update schema scope: ' + (err.response?.data?.message || err.message));
    }
  };

  const formatAssignedSchools = (assignedSchools) => {
    if (!assignedSchools || assignedSchools === 'ALL' || assignedSchools === '""') {
      return { isAll: true, label: '🌐 All Schools (Default Shared Form)' };
    }
    try {
      const parsed = JSON.parse(assignedSchools);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { isAll: false, label: `🏫 Assigned to ${parsed.length} School(s): ${parsed.join(', ')}` };
      }
    } catch {
      // plain text
    }
    return { isAll: false, label: `🏫 Assigned to: ${assignedSchools}` };
  };

  // Find another active schema of the same audit type that already claims this school code.
  const isAssignedToOther = (schoolCode, currentSchemaId) => {
    return schemas.find((s) => {
      if (s.id === currentSchemaId) return false;
      if (s.auditType !== formType || s.status !== 'ACTIVE') return false;
      try {
        const list = JSON.parse(s.assignedSchools || '[]');
        if (Array.isArray(list)) return list.map((c) => String(c).toUpperCase()).includes(schoolCode.toUpperCase());
      } catch {
        if (s.assignedSchools) return s.assignedSchools.toUpperCase().includes(schoolCode.toUpperCase());
      }
      return false;
    });
  };

  return (
    <div className="form-studio-container" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", padding: "var(--space-9)" }}>
      {/* Header section with instructions & actions */}
      <div className="d-flex justify-content-between align-items-flex-start flex-wrap gap-3" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: "var(--space-6)", alignItems: 'flex-start' }}>
          <IconBadge tone={isAdministrative ? 'indigo' : 'emerald'} icon={isAdministrative ? <BuildingIcon /> : <GraduationCapIcon />} />
          <div>
            <h2 className="fw-bold text-dark mb-1" style={{ fontSize: "var(--text-2xl)" }}>
              {isAdministrative
                ? 'Single University Administrative Form'
                : 'Academic Appraisal Form Schemas'}
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: "var(--text-base)" }}>
              {isAdministrative
                ? `Manage and version the single unified administrative appraisal form for `
                : `Design, version, copy, and assign institutional appraisal forms across academic schools for `}
              <strong className="text-primary">{selectedUniversity?.name || 'Your University'}</strong>.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: "var(--space-4)", flexWrap: 'wrap' }}>
          {(!isAdministrative || schemas.length === 0) && (
            <button
              type="button"
              className="btn btn-primary px-3 py-2 fw-semibold shadow-sm"
              style={{ borderRadius: "var(--radius-sm)", background: 'var(--primary)', color: 'var(--card)', border: 'none', cursor: 'pointer', padding: '11px 22px', fontSize: "var(--text-md)", fontWeight: 600 }}
              onClick={() => handleOpenCreateModal()}
            >
              {isAdministrative ? '+ Create Single Administrative Form' : '+ Create New Form Schema'}
            </button>
          )}
        </div>
      </div>

      {/* Info card describing the specific workflow rules */}
      {isAdministrative ? (
        <div style={{ display: 'flex', gap: "var(--space-5)", alignItems: 'flex-start', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: "var(--radius-md)", padding: '14px 16px', marginBottom: "var(--space-8)", wordBreak: 'break-word' }}>
          <span style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '50%', background: 'var(--primary)', color: 'var(--card)', display: 'grid', placeItems: 'center' }}><InfoBadgeIcon size={15} /></span>
          <div style={{ fontSize: "var(--text-base)", lineHeight: '1.55', color: '#334155' }}>
            <strong style={{ display: 'block', color: '#1e3a8a', fontSize: "var(--text-base)", marginBottom: '2px' }}>Single Form Paradigm (Administrative Flow)</strong>
            Administration has <strong>ONE single form overall</strong> for the university. The single form is divided into sections (e.g. Part A, Part B, Part C), and each section is assigned to a specific Administrative Post (e.g. Registrar, HR, Dean Student Welfare). Administrative users mapped to a post will fill only their assigned section(s). <em>(No "Copy Table" is needed since there is only one form.)</em>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: "var(--space-5)", alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: "var(--radius-md)", padding: '14px 16px', marginBottom: "var(--space-8)", wordBreak: 'break-word' }}>
          <div style={{ display: 'flex', gap: "var(--space-5)", alignItems: 'flex-start' }}>
            <span style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '50%', background: 'var(--green-650)', color: 'var(--card)', display: 'grid', placeItems: 'center' }}><TipBadgeIcon size={14} /></span>
            <div style={{ fontSize: "var(--text-base)", lineHeight: '1.55', color: 'var(--green-700)' }}>
              <strong style={{ display: 'block', color: 'var(--green-700)', fontSize: "var(--text-base)", marginBottom: '2px' }}>School-Level Form Flexibility (Academic Flow)</strong>
              Within this university, schools can either share the <em>same form</em> (Condition 2), or have <em>different custom forms</em> (Condition 1). Use <strong>"📋 Copy Form"</strong> to quickly duplicate any existing form and customize columns without rebuilding from scratch!
            </div>
          </div>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '3px 8px', background: 'var(--green-100)', color: 'var(--green-600)', borderRadius: "var(--radius-sm)", flexShrink: 0 }}>
            {universitySchools.length} Schools Configured
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading appraisal schemas...</p>
        </div>
      ) : schemas.length === 0 ? (
        <EmptyState
          tone={isAdministrative ? 'indigo' : 'emerald'}
          icon={isAdministrative ? <BuildingIcon size={30} /> : <GraduationCapIcon size={30} />}
          title={isAdministrative ? 'No administrative form created yet' : 'No academic schemas added yet'}
          description={
            isAdministrative
              ? `Click on "Create Single Administrative Form" to set up the unified appraisal form for ${selectedUniversity?.name || 'this university'}.`
              : `Click on "Create New Form Schema" to design the first academic appraisal form for ${selectedUniversity?.name || 'this university'}.`
          }
        />
      ) : isAdministrative ? (
        /* Single Administrative Form View (Streamlined, no school clutter) */
        <div>
          {selectedSchema && (
            <div className="card" style={{ borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', boxShadow: 'none', background: 'var(--card)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: "var(--space-5)" }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--space-4)" }}>
                    <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-xl)" }}>{selectedSchema.name}</h3>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: '3px 8px', borderRadius: "var(--radius-sm)", background: '#dbeafe', color: '#1e40af' }}>
                      Single Form (University-Wide)
                    </span>
                  </div>
                  <div style={{ marginTop: "var(--space-1)", fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                    Divided into sections mapped to administrative posts (Registrar, HR, Dean Student Welfare, Dean Placement, CFO, etc.)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: "var(--space-4)", alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--green-650)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                    onClick={() => handleCreateDraft(selectedSchema.id)}
                  >
                    + Open / Create Draft Version
                  </button>
                </div>
              </div>

              {/* Version History Table */}
              <div style={{ padding: '16px 24px 8px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: 'var(--ink)' }}>Form Version History</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)", textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>Version</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>Academic Year</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>Published By</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>Published Date</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => {
                      const isDraft = String(v.status || '').toUpperCase() === 'DRAFT';
                      const isActive = v.id === selectedSchema.activeVersionId;
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--bg-alt)' }}>
                          <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                            V{v.versionNumber}{' '}
                            {isActive && <span style={{ fontSize: "var(--text-2xs)", padding: '2px 6px', background: 'var(--primary)', color: 'var(--card)', borderRadius: "var(--radius-2xs)", marginLeft: "var(--space-1)" }}>ACTIVE</span>}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: "var(--radius-2xs)",
                                background: isDraft ? 'var(--amber-100)' : isActive ? 'var(--green-150)' : 'var(--bg-alt)',
                                color: isDraft ? 'var(--amber-700)' : isActive ? 'var(--green-800)' : '#475569',
                              }}
                            >
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>{v.academicYear || '-'}</td>
                          <td style={{ padding: '14px 18px' }}>{v.publishedBy || '-'}</td>
                          <td style={{ padding: '14px 18px' }}>
                            {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : '-'}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: "var(--space-2)" }}>
                              {isDraft ? (
                                <>
                                  <button
                                    type="button"
                                    style={{ padding: '6px 14px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                                    onClick={() => onOpenBuilder(v.id)}
                                  >
                                    🛠️ Edit Form & Assign Sections
                                  </button>
                                  <button
                                    type="button"
                                    style={{ padding: '6px 10px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', cursor: 'pointer' }}
                                    onClick={() => handleDeleteVersion(v)}
                                    title="Delete this draft version"
                                  >
                                    🗑️
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                                    onClick={() => onOpenPreview(v.id)}
                                  >
                                    👁️ View
                                  </button>
                                  {!isActive && (
                                    <button
                                      type="button"
                                      style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--amber-200)', background: 'var(--amber-50)', color: 'var(--amber-700)', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                                      onClick={() => handleRollback(v.id)}
                                    >
                                      Rollback
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Academic Flow View (Multi-schema, school scope assignments, copy form) */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) 2fr', gap: "var(--space-8)" }}>
          {/* Left Column: Schema List */}
          <div>
            <div className="card" style={{ borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', boxShadow: 'none', background: 'var(--card)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Academic Schemas ({schemas.length})</span>
                <span style={{ fontSize: "var(--text-xs)", color: 'var(--muted)' }}>Click to select</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {schemas.map((s) => {
                  const isSelected = selectedSchema?.id === s.id;
                  const schoolInfo = formatAssignedSchools(s.assignedSchools);
                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--bg-alt)',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-soft)' : 'var(--card)',
                        borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onClick={() => handleSelectSchema(s)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: "var(--space-1)" }}>
                        <div style={{ fontWeight: 700, color: isSelected ? 'var(--primary-dark)' : 'var(--ink)', fontSize: "var(--text-md)" }}>
                          {s.name}
                        </div>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: "var(--radius-2xs)",
                            background: isSelected ? '#dbeafe' : 'var(--bg-alt)',
                            color: isSelected ? '#1e40af' : '#475569',
                          }}
                        >
                          v{s.activeVersionNumber || 1}
                        </span>
                      </div>

                      {/* Assigned Schools Tag */}
                      <div style={{ marginBottom: "var(--space-3)" }}>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: "var(--radius-sm)",
                            background: schoolInfo.isAll ? 'var(--bg-alt)' : '#dbeafe',
                            color: schoolInfo.isAll ? '#475569' : '#1e40af',
                            border: `1px solid ${schoolInfo.isAll ? 'var(--border)' : 'var(--accent-border)'}`,
                          }}
                        >
                          {schoolInfo.label}
                        </span>
                      </div>

                      {/* Action buttons inside card */}
                      <div style={{ display: 'flex', gap: "var(--space-3)", alignItems: 'center', justifyContent: 'flex-end', paddingTop: "var(--space-1)" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          style={{ border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#1e40af', padding: '3px 8px', borderRadius: "var(--radius-2xs)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: 'pointer' }}
                          title="Copy/Duplicate this Form for another School"
                          onClick={() => handleOpenCreateModal(s)}
                        >
                          📋 Copy Form
                        </button>
                        <button
                          type="button"
                          style={{ border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', padding: '3px 8px', borderRadius: "var(--radius-2xs)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: 'pointer' }}
                          title="Edit Assigned Schools"
                          onClick={() => handleOpenEditScope(s)}
                        >
                          ✏️ Scope
                        </button>
                        <button
                          type="button"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6, fontSize: "var(--text-md)" }}
                          title={`Delete "${s.name}"`}
                          onClick={() => handleDeleteSchema(s)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Version History & Actions */}
          <div>
            {selectedSchema && (
              <div className="card" style={{ borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', boxShadow: 'none', background: 'var(--card)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: "var(--space-4)" }}>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>{selectedSchema.name}</h4>
                    <div style={{ marginTop: "var(--space-1)", fontSize: "var(--text-base)", color: 'var(--muted)' }}>
                      Scope: <strong className="text-primary">{formatAssignedSchools(selectedSchema.assignedSchools).label}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: "var(--space-3)", alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                      onClick={() => handleOpenEditScope(selectedSchema)}
                    >
                      ✏️ Edit Scope & Schools
                    </button>
                    <button
                      type="button"
                      style={{ padding: '6px 12px', borderRadius: "var(--radius-sm)", border: '1px solid #93c5fd', background: 'var(--accent-soft)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                      onClick={() => handleOpenCreateModal(selectedSchema)}
                    >
                      📋 Copy As New Form
                    </button>
                    <button
                      type="button"
                      style={{ padding: '6px 14px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--green-650)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                      onClick={() => handleCreateDraft(selectedSchema.id)}
                    >
                      + Open / Create Draft Version
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)", textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Version</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Academic Year</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Published By</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Published Date</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => {
                        const isDraft = String(v.status || '').toUpperCase() === 'DRAFT';
                        const isActive = v.id === selectedSchema.activeVersionId;
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--bg-alt)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                              V{v.versionNumber}{' '}
                              {isActive && <span style={{ fontSize: "var(--text-2xs)", padding: '2px 6px', background: 'var(--primary)', color: 'var(--card)', borderRadius: "var(--radius-2xs)", marginLeft: "var(--space-1)" }}>ACTIVE</span>}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  fontSize: "var(--text-xs)",
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: "var(--radius-2xs)",
                                  background: isDraft ? 'var(--amber-100)' : isActive ? 'var(--green-150)' : 'var(--bg-alt)',
                                  color: isDraft ? 'var(--amber-700)' : isActive ? 'var(--green-800)' : '#475569',
                                }}
                              >
                                {v.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>{v.academicYear || '-'}</td>
                            <td style={{ padding: '12px 14px' }}>{v.publishedBy || '-'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : '-'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: "var(--space-2)" }}>
                                {isDraft ? (
                                  <>
                                    <button
                                      type="button"
                                      style={{ padding: '5px 11px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, fontSize: "var(--text-base)", cursor: 'pointer' }}
                                      onClick={() => onOpenBuilder(v.id)}
                                    >
                                      🛠️ Edit & Build Form
                                    </button>
                                    <button
                                      type="button"
                                      style={{ padding: '5px 8px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', cursor: 'pointer' }}
                                      onClick={() => handleDeleteVersion(v)}
                                      title="Delete this draft version"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      style={{ padding: '5px 11px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                                      onClick={() => onOpenPreview(v.id)}
                                    >
                                      👁️ View
                                    </button>
                                    {!isActive && (
                                      <button
                                        type="button"
                                        style={{ padding: '5px 11px', borderRadius: "var(--radius-sm)", border: '1px solid var(--amber-200)', background: 'var(--amber-50)', color: 'var(--amber-700)', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                                        onClick={() => handleRollback(v.id)}
                                      >
                                        Rollback
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Clone Schema Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: "var(--space-8)",
          }}
        >
          <div style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', background: 'var(--card)', borderRadius: "var(--radius-lg)", boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
                {cloneFromSchemaId
                  ? '📋 Copy & Duplicate Form Schema'
                  : isAdministrative
                    ? '➕ Create Single Administrative Form'
                    : '➕ Create New Academic Form Schema'}
              </h5>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSchemaSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: "var(--space-8)", overflowY: 'auto', display: 'grid', gap: "var(--space-6)" }}>
                
                {/* Clone From Source Dropdown (Academic Only) */}
                {!isAdministrative && (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", padding: "var(--space-5)" }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-1)", color: '#1e40af' }}>
                      📋 Base on Existing Form Structure (Avoid Rework)
                    </label>
                    <select
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)" }}
                      value={cloneFromSchemaId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setCloneFromSchemaId(sId);
                        if (sId) {
                          const src = schemas.find((s) => String(s.id) === String(sId));
                          if (src) {
                            setNewSchemaForm({
                              auditType: 'academic',
                              name: `${src.name} (Copy)`,
                              description: src.description || '',
                            });
                          }
                        }
                      }}
                    >
                      <option value="">-- Start Fresh From Scratch (Blank Form) --</option>
                      {schemas.map((s) => (
                        <option key={s.id} value={s.id}>
                          Copy from: {s.name}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--muted)', fontSize: "var(--text-sm)", display: 'block', marginTop: "var(--space-1)" }}>
                      Selecting an existing form will copy all sections, tables, and columns so you only need to modify what changes.
                    </small>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Schema Title / Name*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder={isAdministrative ? 'e.g. University Administrative Appraisal Form' : 'e.g. School Appraisal Form'}
                    required
                    value={newSchemaForm.name}
                    onChange={(e) =>
                      setNewSchemaForm({ ...newSchemaForm, name: e.target.value })
                    }
                  />
                </div>

                {/* School Scope Selection (Academic Only) */}
                {!isAdministrative && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", padding: "var(--space-5)", background: '#fafafa' }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-2)", color: 'var(--ink)' }}>
                      🏫 Form Assignment & Scope:
                    </label>
                    <div style={{ display: 'flex', gap: "var(--space-7)", marginBottom: "var(--space-4)" }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)", fontSize: "var(--text-base)", cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="schemaScope"
                          checked={newSchemaScope === 'ALL'}
                          onChange={() => setNewSchemaScope('ALL')}
                        />
                        <span><strong>All Schools (Default shared form)</strong></span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)", fontSize: "var(--text-base)", cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="schemaScope"
                          checked={newSchemaScope === 'SPECIFIC'}
                          onChange={() => setNewSchemaScope('SPECIFIC')}
                        />
                        <span><strong>Specific School(s) only</strong></span>
                      </label>
                    </div>

                    {newSchemaScope === 'SPECIFIC' && (
                      <div style={{ marginTop: "var(--space-3)", borderTop: '1px solid var(--border)', paddingTop: "var(--space-3)" }}>
                        <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: '#475569', marginBottom: "var(--space-2)" }}>
                          Select the school(s) that will use this form:
                        </div>
                        {universitySchools.length === 0 ? (
                          <p style={{ color: 'var(--red-600)', fontSize: "var(--text-base)", margin: 0 }}>
                            No schools configured yet. Please add schools in the "University Schools & Departments" tab first.
                          </p>
                        ) : (
                          <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'grid', gap: "var(--space-2)", background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                            {universitySchools.map((sch) => {
                              const isChecked = selectedSchoolCodes.includes(sch.code) || selectedSchoolCodes.includes(sch.name);
                              // Cloning still creates a brand-new schema, so the clone source itself isn't "current" here.
                              const conflictSchema = isAssignedToOther(sch.code || sch.name, null);
                              return (
                                <label
                                  key={sch.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: "var(--space-3)",
                                    fontSize: "var(--text-base)",
                                    cursor: conflictSchema ? 'not-allowed' : 'pointer',
                                    opacity: conflictSchema ? 0.5 : 1,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={Boolean(conflictSchema)}
                                    onChange={() => handleToggleSchoolCode(sch.code || sch.name)}
                                  />
                                  <span><strong>{sch.name}</strong> <span style={{ color: 'var(--muted)' }}>({sch.code})</span></span>
                                  {conflictSchema && (
                                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: '2px 6px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)' }}>
                                      (Assigned to: {conflictSchema.name})
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Description</label>
                  <textarea
                    style={{ width: '100%', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '8px 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    rows={2}
                    placeholder="Form details or specific notes..."
                    value={newSchemaForm.description}
                    onChange={(e) =>
                      setNewSchemaForm({ ...newSchemaForm, description: e.target.value })
                    }
                  />
                </div>
              </div>

              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  {cloneFromSchemaId ? '📋 Copy Structure & Create' : 'Create Schema & V1 Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Scope Modal (Academic Only) */}
      {showEditScopeModal && editScopeSchema && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: "var(--space-8)",
          }}
        >
          <div style={{ width: '100%', maxWidth: '500px', background: 'var(--card)', borderRadius: "var(--radius-lg)", boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
                ✏️ Edit Form Scope & Assigned Schools
              </h5>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setShowEditScopeModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveScopeSubmit}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-6)" }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Schema Name</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    required
                    value={editScopeName}
                    onChange={(e) => setEditScopeName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-2)", color: 'var(--ink)' }}>
                    Assigned Schools:
                  </label>
                  <div style={{ display: 'flex', gap: "var(--space-7)", marginBottom: "var(--space-4)" }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)", fontSize: "var(--text-base)", cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="editScopeRadio"
                        checked={editScopeMode === 'ALL'}
                        onChange={() => setEditScopeMode('ALL')}
                      />
                      <span><strong>All Schools (Default shared form)</strong></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: "var(--space-2)", fontSize: "var(--text-base)", cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="editScopeRadio"
                        checked={editScopeMode === 'SPECIFIC'}
                        onChange={() => setEditScopeMode('SPECIFIC')}
                      />
                      <span><strong>Specific School(s) only</strong></span>
                    </label>
                  </div>

                  {editScopeMode === 'SPECIFIC' && (
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'grid', gap: "var(--space-2)", background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                      {universitySchools.map((sch) => {
                        const isChecked = editScopeSchools.includes(sch.code) || editScopeSchools.includes(sch.name);
                        const conflictSchema = isAssignedToOther(sch.code || sch.name, editScopeSchema?.id);
                        return (
                          <label
                            key={sch.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: "var(--space-3)",
                              fontSize: "var(--text-base)",
                              cursor: conflictSchema ? 'not-allowed' : 'pointer',
                              opacity: conflictSchema ? 0.5 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={Boolean(conflictSchema)}
                              onChange={() => {
                                const code = sch.code || sch.name;
                                if (editScopeSchools.includes(code)) {
                                  setEditScopeSchools(editScopeSchools.filter((c) => c !== code));
                                } else {
                                  setEditScopeSchools([...editScopeSchools, code]);
                                }
                              }}
                            />
                            <span><strong>{sch.name}</strong> <span style={{ color: 'var(--muted)' }}>({sch.code})</span></span>
                            {conflictSchema && (
                              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: '2px 6px', borderRadius: "var(--radius-2xs)", background: 'var(--amber-100)', color: 'var(--amber-700)' }}>
                                (Assigned to: {conflictSchema.name})
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowEditScopeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
