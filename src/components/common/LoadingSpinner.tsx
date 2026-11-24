import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label }) => {
  const dim = size === 'sm' ? 18 : size === 'lg' ? 36 : 24;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-amber)"
        strokeWidth="3"
        strokeLinecap="round"
        style={{
          animation: 'spin 0.8s linear infinite',
        }}
      >
        <circle cx="12" cy="12" r="10" stroke="rgba(245, 165, 36, 0.2)" />
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      {label && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>}
      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
