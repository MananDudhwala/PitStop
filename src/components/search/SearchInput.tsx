import React, { useState, useRef, useEffect } from 'react';
import { useGeocodeSearch } from '@/hooks';
import { GeoPoint, SearchSuggestion } from '@/types';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface SearchInputProps {
  label: string;
  placeholder: string;
  value: string;
  biasPoint?: GeoPoint;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClear: () => void;
  onUseCurrentLocation?: () => void;
  iconType: 'origin' | 'destination';
}

export const SearchInput: React.FC<SearchInputProps> = ({
  label,
  placeholder,
  value,
  biasPoint,
  onSelect,
  onClear,
  onUseCurrentLocation,
  iconType,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { searchTerm, setSearchTerm, suggestions, isLoading } = useGeocodeSearch(biasPoint);

  useEffect(() => {
    setSearchTerm(value);
  }, [value, setSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (s: SearchSuggestion) => {
    setIsOpen(false);
    onSelect(s);
  };

  const accentColor = iconType === 'origin' ? 'var(--accent-emerald)' : 'var(--accent-amber)';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius)',
          padding: '4px 12px',
          minHeight: 'var(--touch-min)',
          gap: 10,
        }}
      >
        {/* Dot Icon Indicator */}
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: accentColor,
            flexShrink: 0,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
        />

        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          aria-label={label}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 15,
            fontWeight: 500,
          }}
        />

        {isLoading && <LoadingSpinner size="sm" />}

        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              onClear();
            }}
            aria-label="Clear field"
            style={{
              padding: 4,
              color: 'var(--text-secondary)',
              minHeight: 36,
              minWidth: 36,
            }}
          >
            ✕
          </button>
        )}

        {onUseCurrentLocation && !searchTerm && (
          <button
            type="button"
            onClick={onUseCurrentLocation}
            title="Use current GPS location"
            style={{
              padding: '6px 8px',
              color: 'var(--accent-cyan)',
              minHeight: 36,
              minWidth: 36,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3m-10-10h3m14 0h3" />
            </svg>
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--surface-overlay)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius)',
            maxHeight: 280,
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: 'var(--shadow-hud)',
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelect(s)}
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {s.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.displayName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
