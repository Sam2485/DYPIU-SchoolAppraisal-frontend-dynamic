import React, { useState, useEffect } from 'react';
import { SchemaManager } from './SchemaManager';
import { FormBuilderCanvas } from './FormBuilderCanvas';
import { LiveFormPreview } from './LiveFormPreview';
import { SchoolManager } from './SchoolManager';
import { PostManager } from './PostManager';
import { GraduationCapIcon, BuildingIcon } from './StudioIcons';
import apiClient from '../../../api/client';

export default function AppraisalFormStudio({ currentUser }) {
  // Top-Level Form Type Selector: 'academic' vs 'administrative'
  const [formType, setFormType] = useState('academic');

  // Sub-navigation:
  // For academic: 'schemas' | 'schools'
  // For administrative: 'single-form' | 'posts'
  const [academicNav, setAcademicNav] = useState('schemas');
  const [adminNav, setAdminNav] = useState('single-form');

  // Main Canvas View: 'list' (shows sub-nav views) | 'builder' | 'preview'
  const [viewMode, setViewMode] = useState('list');
  const [activeVersionId, setActiveVersionId] = useState(null);
  const [currentUniversity, setCurrentUniversity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentUniversity({
      id: 1,
      code: 'DYPIU',
      name: currentUser?.universityName || 'University',
    });
    setLoading(false);
  }, [currentUser]);

  const handleOpenBuilder = (versionId) => {
    setActiveVersionId(versionId);
    setViewMode('builder');
  };

  const handleOpenPreview = (versionId) => {
    setActiveVersionId(versionId);
    setViewMode('preview');
  };

  if (loading) {
    return (
      <div className="p-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Initializing Appraisal Form Studio...</p>
      </div>
    );
  }

  return (
    <div className="appraisal-form-studio-root" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      {/* Top Banner & Main Form Type Selector (Academic vs Administrative) */}
      {viewMode === 'list' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: "var(--radius-sm)", boxShadow: 'none', marginBottom: "var(--space-8)" }}>
          {/* Header & University Info */}
          <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: "var(--space-5)" }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                IQAC Appraisal Form Studio
              </div>
              <h2 style={{ margin: '2px 0 0', fontSize: "var(--text-2xl)", fontWeight: 800, color: 'var(--ink)' }}>
                Institutional Form & Schema Studio
              </h2>
            </div>

            {/* Form Type Selector (A: Academic vs B: Administrative) */}
            <div style={{ display: 'inline-flex', background: 'var(--bg-alt)', padding: "var(--space-1)", borderRadius: "var(--radius-md)", border: '1px solid var(--border)' }}>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: formType === 'academic' ? 'var(--primary)' : 'transparent',
                  color: formType === 'academic' ? 'var(--card)' : '#475569',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: formType === 'academic' ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: "var(--space-2)",
                }}
                onClick={() => setFormType('academic')}
              >
                <GraduationCapIcon size={16} />
                <span>A) Academic Flow</span>
              </button>

              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: "var(--radius-sm)",
                  border: 'none',
                  background: formType === 'administrative' ? 'var(--primary)' : 'transparent',
                  color: formType === 'administrative' ? 'var(--card)' : '#475569',
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: formType === 'administrative' ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: "var(--space-2)",
                }}
                onClick={() => setFormType('administrative')}
              >
                <BuildingIcon size={16} />
                <span>B) Administrative Flow</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs based on Form Type */}
          <div style={{ padding: '0 24px', display: 'flex', gap: "var(--space-3)", borderTop: '1px solid var(--bg-alt)' }}>
            {formType === 'academic' ? (
              <>
                <button
                  type="button"
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: academicNav === 'schemas' ? '3px solid var(--primary)' : '3px solid transparent',
                    background: 'transparent',
                    color: academicNav === 'schemas' ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: academicNav === 'schemas' ? 800 : 600,
                    fontSize: "var(--text-base)",
                    cursor: 'pointer',
                    borderRadius: 0,
                  }}
                  onClick={() => setAcademicNav('schemas')}
                >
                   Form Schemas & Versions (Academic)
                </button>
                <button
                  type="button"
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: academicNav === 'schools' ? '3px solid var(--primary)' : '3px solid transparent',
                    background: 'transparent',
                    color: academicNav === 'schools' ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: academicNav === 'schools' ? 800 : 600,
                    fontSize: "var(--text-base)",
                    cursor: 'pointer',
                    borderRadius: 0,
                  }}
                  onClick={() => setAcademicNav('schools')}
                >
                   University Schools & Departments
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: adminNav === 'single-form' ? '3px solid var(--primary)' : '3px solid transparent',
                    background: 'transparent',
                    color: adminNav === 'single-form' ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: adminNav === 'single-form' ? 800 : 600,
                    fontSize: "var(--text-base)",
                    cursor: 'pointer',
                    borderRadius: 0,
                  }}
                  onClick={() => setAdminNav('single-form')}
                >
                   Single Administrative Form
                </button>
                <button
                  type="button"
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: adminNav === 'posts' ? '3px solid var(--primary)' : '3px solid transparent',
                    background: 'transparent',
                    color: adminNav === 'posts' ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: adminNav === 'posts' ? 800 : 600,
                    fontSize: "var(--text-base)",
                    cursor: 'pointer',
                    borderRadius: 0,
                  }}
                  onClick={() => setAdminNav('posts')}
                >
                   Administrative Posts & Offices
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content Rendering */}
      {viewMode === 'list' && formType === 'academic' && academicNav === 'schemas' && (
        <SchemaManager
          selectedUniversity={currentUniversity}
          formType="academic"
          onOpenBuilder={handleOpenBuilder}
          onOpenPreview={handleOpenPreview}
        />
      )}

      {viewMode === 'list' && formType === 'academic' && academicNav === 'schools' && (
        <SchoolManager selectedUniversity={currentUniversity} />
      )}

      {viewMode === 'list' && formType === 'administrative' && adminNav === 'single-form' && (
        <SchemaManager
          selectedUniversity={currentUniversity}
          formType="administrative"
          onOpenBuilder={handleOpenBuilder}
          onOpenPreview={handleOpenPreview}
        />
      )}

      {viewMode === 'list' && formType === 'administrative' && adminNav === 'posts' && (
        <PostManager selectedUniversity={currentUniversity} />
      )}

      {viewMode === 'builder' && (
        <FormBuilderCanvas
          versionId={activeVersionId}
          selectedUniversity={currentUniversity}
          onPublishSuccess={() => {}}
          onOpenPreview={handleOpenPreview}
          onBackToSchemas={() => setViewMode('list')}
        />
      )}

      {viewMode === 'preview' && (
        <LiveFormPreview
          versionId={activeVersionId}
          onBack={() => setViewMode('builder')}
        />
      )}
    </div>
  );
}
