import { toast, confirmAction } from "../../../components/feedback/feedbackBus";
import React, { useState, useEffect } from 'react';
import { UsersIcon, IconBadge, EmptyState, InfoBadgeIcon, ErrorState } from './StudioIcons';
import {
  getUniversityPosts,
  createUniversityPost,
  updateUniversityPost,
  deleteUniversityPost,
} from './formStudioApi';

export const PostManager = ({ selectedUniversity }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE',
    displayOrder: 0,
  });

  const effectiveUniversityId = selectedUniversity?.id || 1;

  const loadPosts = async () => {
    if (!effectiveUniversityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getUniversityPosts(effectiveUniversityId, true);
      setPosts(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load administrative posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [selectedUniversity]);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setCurrentPostId(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      status: 'ACTIVE',
      displayOrder: posts.length + 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (post) => {
    setIsEdit(true);
    setCurrentPostId(post.id);
    setFormData({
      name: post.name || '',
      code: post.code || '',
      description: post.description || '',
      status: post.status || 'ACTIVE',
      displayOrder: post.displayOrder || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateUniversityPost(effectiveUniversityId, currentPostId, formData);
      } else {
        await createUniversityPost(effectiveUniversityId, formData);
      }
      setShowModal(false);
      await loadPosts();
    } catch (err) {
      toast.error('Error saving post: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (post) => {
    if (!(await confirmAction(`Are you sure you want to delete administrative post "${post.name} (${post.code})"?`, { tone: 'danger', confirmLabel: 'Delete' }))) {
      return;
    }
    try {
      await deleteUniversityPost(effectiveUniversityId, post.id);
      await loadPosts();
    } catch (err) {
      toast.error('Failed to delete post: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="post-manager-container" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", padding: "var(--space-9)" }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: "var(--space-6)", alignItems: 'flex-start' }}>
          <IconBadge tone="indigo" icon={<UsersIcon />} />
          <div>
            <h2 className="fw-bold text-dark mb-1" style={{ fontSize: "var(--text-2xl)" }}>University Administrative Posts</h2>
            <p className="text-muted mb-0" style={{ fontSize: "var(--text-base)" }}>
              Configure administrative posts & offices (Registrar, HR, Dean Student Welfare, CFO, etc.) for{' '}
              <strong className="text-primary">{selectedUniversity?.name || 'Your University'}</strong>.
            </p>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn btn-primary px-3 py-2 fw-semibold shadow-sm"
          style={{ borderRadius: "var(--radius-sm)", background: 'var(--primary)', color: 'var(--card)', border: 'none', cursor: 'pointer', padding: '8px 16px', fontWeight: 600 }}
          onClick={handleOpenAdd}
        >
          + Add New Administrative Post
        </button>
      </div>

      <div style={{ display: 'flex', gap: "var(--space-5)", alignItems: 'flex-start', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: "var(--radius-md)", padding: '14px 16px', marginBottom: "var(--space-8)", wordBreak: 'break-word' }}>
        <span style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '50%', background: 'var(--primary)', color: 'var(--card)', display: 'grid', placeItems: 'center' }}><InfoBadgeIcon size={15} /></span>
        <div style={{ fontSize: "var(--text-base)", lineHeight: '1.55', color: '#334155' }}>
          <strong style={{ display: 'block', color: '#1e3a8a', fontSize: "var(--text-base)", marginBottom: '2px' }}>Role of Administrative Posts</strong>
          In the Administrative flow, there is <strong>one unified form</strong> divided into sections. Each section is assigned to one of these posts. Administrative users mapped to a post will fill only their assigned section(s).
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading configured administrative posts...</p>
        </div>
      ) : error ? (
        <ErrorState title="Unable to load administrative posts right now" message={error} onRetry={loadPosts} />
      ) : posts.length === 0 ? (
        <EmptyState
          tone="indigo"
          icon={<UsersIcon size={30} />}
          title="No administrative posts configured yet"
          description={`Click on "Add New Administrative Post" to set up posts such as Registrar, HR, Dean Student Welfare, CFO, etc. for ${selectedUniversity?.name || 'this university'}.`}
        />
      ) : (
        <div className="card" style={{ borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', boxShadow: 'none', background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Configured Posts ({posts.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--text-base)", textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Post Code / Identifier</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Post Title / Designation</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} style={{ borderBottom: '1px solid var(--bg-alt)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      <code style={{ background: 'var(--bg-alt)', color: '#475569', padding: '3px 7px', borderRadius: "var(--radius-2xs)" }}>
                        {post.code}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>
                      {post.name}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                      {post.description || '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: "var(--radius-2xs)",
                          background: post.status === 'ACTIVE' ? 'var(--green-150)' : 'var(--bg-alt)',
                          color: post.status === 'ACTIVE' ? 'var(--green-800)' : 'var(--muted)',
                        }}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: "var(--space-3)" }}>
                        <button
                          type="button"
                          style={{ padding: '5px 12px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', background: 'var(--card)', color: '#334155', fontWeight: 600, fontSize: "var(--text-base)", cursor: 'pointer' }}
                          onClick={() => handleOpenEdit(post)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          style={{ padding: '5px 8px', borderRadius: "var(--radius-sm)", border: '1px solid var(--red-200)', background: 'var(--card)', color: 'var(--red-700)', cursor: 'pointer' }}
                          onClick={() => handleDelete(post)}
                          title="Delete Post"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Post Modal */}
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
                {isEdit ? '✏️ Edit Administrative Post' : '👔 Add New Administrative Post'}
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
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Post Title / Name*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder="e.g. Registrar, HR, Dean Student Welfare, Chief Financial Officer"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Post Code / Identifier*</label>
                  <input
                    type="text"
                    style={{ width: '100%', height: '38px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '0 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    placeholder="e.g. REGISTRAR, HR, DSW, PLACEMENT, CFO"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>Description / Department Office</label>
                  <textarea
                    style={{ width: '100%', borderRadius: "var(--radius-sm)", border: '1px solid var(--border-strong)', padding: '8px 10px', fontSize: "var(--text-base)", boxSizing: 'border-box' }}
                    rows={2}
                    placeholder="e.g. Office of the Registrar, responsible for governance & academic operations"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
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
                  {isEdit ? 'Update Post' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
