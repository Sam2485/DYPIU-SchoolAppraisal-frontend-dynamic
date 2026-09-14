import React from 'react';

const base = (size, children, strokeWidth = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const GraduationCapIcon = ({ size = 22 }) => base(size, (
  <>
    <path d="M12 3 2 8l10 5 10-5-10-5Z" />
    <path d="M6 10.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-5.5" />
  </>
));

export const BuildingIcon = ({ size = 22 }) => base(size, (
  <>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 21v-4h6v4" />
    <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
  </>
));

export const SchoolHouseIcon = ({ size = 22 }) => base(size, (
  <>
    <path d="M4 21V10l8-5 8 5v11" />
    <path d="M9 21v-6h6v6" />
    <path d="M12 5V2" />
    <path d="M12 2h3" />
  </>
));

export const UsersIcon = ({ size = 22 }) => base(size, (
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15 14c2.8.3 5 2.4 5 6" />
  </>
));

export const InfoBadgeIcon = ({ size = 22 }) => base(size, (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </>
));

export const TipBadgeIcon = ({ size = 22 }) => base(size, (
  <>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.5.5.9 1.2 1 2.5h6c.1-1.3.5-2 1-2.5A6 6 0 0 0 12 3Z" />
  </>
));

export const IconBadge = ({ icon, tone = 'indigo', size = 42 }) => {
  const tones = {
    indigo: { background: '#e0e7ff', color: '#4338ca' },
    emerald: { background: '#d1fae5', color: '#047857' },
  };
  const { background, color } = tones[tone] || tones.indigo;
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        borderRadius: '10px',
        display: 'grid',
        placeItems: 'center',
        background,
        color,
      }}
    >
      {icon}
    </div>
  );
};

export const EmptyState = ({ icon, title, description, tone = 'indigo' }) => {
  const tones = {
    indigo: { background: '#eef2ff', color: '#a5b4fc' },
    emerald: { background: '#ecfdf5', color: '#6ee7b7' },
  };
  const { background, color } = tones[tone] || tones.indigo;
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: '72px', height: '72px', margin: '0 auto 18px', borderRadius: '50%', background, color, display: 'grid', placeItems: 'center' }}>
        {icon}
      </div>
      <h4 className="fw-bold text-dark mb-1" style={{ fontSize: '16px' }}>{title}</h4>
      <p className="text-muted mb-0" style={{ fontSize: '13px', maxWidth: '440px', margin: '0 auto' }}>{description}</p>
    </div>
  );
};

export const AlertIcon = ({ size = 22 }) => base(size, (
  <>
    <path d="M12 3.5 2 20h20L12 3.5Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </>
));

export const ErrorState = ({ title = 'Unable to load right now', message, onRetry }) => (
  <div style={{ padding: '40px 24px', textAlign: 'center' }}>
    <div style={{ width: '72px', height: '72px', margin: '0 auto 18px', borderRadius: '50%', background: '#fef2f2', color: '#f87171', display: 'grid', placeItems: 'center' }}>
      <AlertIcon size={30} />
    </div>
    <h4 className="fw-bold text-dark mb-1" style={{ fontSize: '16px' }}>{title}</h4>
    <p className="text-muted mb-3" style={{ fontSize: '13px', maxWidth: '440px', margin: '0 auto' }}>{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        style={{ border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '13px', padding: '8px 18px', cursor: 'pointer' }}
      >
        Retry
      </button>
    )}
  </div>
);
