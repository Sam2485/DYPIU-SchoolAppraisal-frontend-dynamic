import { toast, confirmAction } from "../../../components/feedback/feedbackBus";
import React, { useState, useEffect } from 'react';
import { SchoolHouseIcon, IconBadge, EmptyState, ErrorState } from './StudioIcons';
import {
  getUniversitySchools,
  createUniversitySchool,
  updateUniversitySchool,
  deleteUniversitySchool,
} from './formStudioApi';

export const SchoolManager = ({ selectedUniversity }) => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    groupName: 'engineering',
    status: 'ACTIVE',
    displayOrder: 0,
  });

  const effectiveUniversityId = selectedUniversity?.id || 1;

  const loadSchools = async () => {
    if (!effectiveUniversityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getUniversitySchools(effectiveUniversityId, true);
      setSchools(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, [selectedUniversity]);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setCurrentSchoolId(null);
    setFormData({
      name: '',
      code: '',
      groupName: 'engineering',
      status: 'ACTIVE',
      displayOrder: schools.length + 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (school) => {
    setIsEdit(true);
    setCurrentSchoolId(school.id);
    setFormData({
      name: school.name || '',
      code: school.code || '',
      groupName: school.groupName || 'general',
      status: school.status || 'ACTIVE',
      displayOrder: school.displayOrder || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateUniversitySchool(effectiveUniversityId, currentSchoolId, formData);
      } else {
        await createUniversitySchool(effectiveUniversityId, formData);
      }
      setShowModal(false);
      await loadSchools();
    } catch (err) {
      toast.error('Error saving school: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (school) => {
    if (!(await confirmAction(`Are you sure you want to delete "${school.name} (${school.code})"?`, { tone: 'danger', confirmLabel: 'Delete' }))) {
      return;
    }
    try {
      await deleteUniversitySchool(effectiveUniversityId, school.id);
      await loadSchools();
    } catch (err) {
      toast.error('Failed to delete school: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="school-manager-container" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", padding: "var(--space-9)" }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: "var(--space-6)", alignItems: 'flex-start' }}>
          <IconBadge tone="emerald" icon={<SchoolHouseIcon />} />
          <div>
            <h2 className="fw-bold text-dark mb-1" style={{ fontSize: "var(--text-2xl)" }}>University Schools & Departments</h2>
            <p className="text-muted mb-0" style={{ fontSize: "var(--text-base)" }}>
              Configure academic schools, faculties, and departments for{' '}
              <strong className="text-primary">{selectedUniversity?.name || 'Your University'}</strong>.
            </p>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 28 }}>
        <button
          type="button"
          className="btn btn-primary px-3 py-2 fw-semibold shadow-sm"
          style={{ borderRadius: "var(--radius-sm)", background: 'var(--primary)', color: 'var(--card)', border: 'none', cursor: 'pointer', padding: '11px 22px', fontSize: "var(--text-md)", fontWeight: 600 }}
          onClick={handleOpenAdd}
        >
          + Add New School / Department
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading configured schools...</p>
        </div>
      ) : error ? (
        <ErrorState title="Unable to load schools right now" message={error} onRetry={loadSchools} />
      ) : schools.length === 0 ? (
        <EmptyState
          tone="emerald"
          icon={<SchoolHouseIcon size={30} />}
          title="No schools or departments added yet"
          description={`Click on "Add New School / Department" to configure academic units for ${selectedUniversity?.name || 'this university'}.`}
        />
      ) : (
        <div className="card" style={{ borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', boxShadow: 'none', background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Configured Schools ({schools.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)", textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Code / Short Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Full School Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Group / Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => {
                  const isEng = school.groupName === 'engineering';
                  return (
                    <tr key={school.id} style={{ borderBottom: '1px solid var(--bg-alt)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        <code style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 7px', borderRadius: "var(--radius-2xs)" }}>
                          {school.code}
                        </code>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>
                        {school.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: "var(--radius-2xs)",
                            background: isEng ? 'var(--accent-soft)' : '#fdf2f8',
                            color: isEng ? 'var(--primary-dark)' : '#be185d',
                          }}
                        >
                          {school.groupName === 'engineering' ? 'Engineering' : school.groupName === 'nonEngineering' ? 'Non-Engineering' : 'General'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: "var(--radius-2xs)",
                            background: school.status === 'ACTIVE' ? 'var(--green-150)' : 'var(--bg-alt)',
                            color: school.status === 'ACTIVE' ? 'var(--green-800)' : 'var(--muted)',
                          }}
                        >
                          {school.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: "var(--space-3)" }}>
                          <button
                            type="button"
                            style={{ padding: '5px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                            onClick={() => handleOpenEdit(school)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            style={{ padding: '5px 8px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', cursor: 'pointer' }}
                            onClick={() => handleDelete(school)}
                            title="Delete School"
                          >
                            🗑️
                          </button>
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

      {/* Add / Edit School Modal */}
      {showModal && (
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
              <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)', fontSize: "var(--text-lg)" }}>
                {isEdit ? '✏️ Edit School / Department' : '🏫 Add New School / Department'}
              </h4>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: "var(--text-xl)", color: 'var(--muted)' }}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ padding: "var(--space-8)", display: 'grid', gap: "var(--space-6)" }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Full School / Department Name*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder="e.g. School of Computer Science & Engineering"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>School Code / Abbreviation*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder="e.g. SoCSE, SoE, SoM, CSE"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: "var(--space-4)" }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Category / Group</label>
                    <select
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                      value={formData.groupName}
                      onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                    >
                      <option value="engineering">Engineering</option>
                      <option value="nonEngineering">Non-Engineering</option>
                      <option value="general">General / Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Status</label>
                    <select
                      style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: "var(--space-4)" }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: "var(--radius-sm)", border: 'none', background: 'var(--primary)', color: 'var(--card)', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isEdit ? 'Update School' : 'Save School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
