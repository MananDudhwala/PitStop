import React, { useState, useRef } from 'react';
import { useUIStore } from '@/store';
import { DrawerSnapPoint } from '@/types';

interface BottomDrawerProps {
  children: React.ReactNode;
}

const SNAP_HEIGHTS: Record<DrawerSnapPoint, string> = {
  collapsed: '90px',
  half: '52vh',
  expanded: '88vh',
};

export const BottomDrawer: React.FC<BottomDrawerProps> = ({ children }) => {
  const { drawerSnapPoint, setDrawerSnapPoint } = useUIStore();
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number>(0);
  const currentHeightRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Swipe down
    if (deltaY > 50) {
      if (drawerSnapPoint === 'expanded') setDrawerSnapPoint('half');
      else if (drawerSnapPoint === 'half') setDrawerSnapPoint('collapsed');
    }
    // Swipe up
    else if (deltaY < -50) {
      if (drawerSnapPoint === 'collapsed') setDrawerSnapPoint('half');
      else if (drawerSnapPoint === 'half') setDrawerSnapPoint('expanded');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: SNAP_HEIGHTS[drawerSnapPoint],
        backgroundColor: 'var(--surface)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        border: '1px solid var(--surface-border)',
        borderBottom: 'none',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        boxShadow: 'var(--shadow-hud)',
        transition: isDragging ? 'none' : 'height 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      {/* Glove-friendly Drag Handle Pill */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (drawerSnapPoint === 'collapsed') setDrawerSnapPoint('half');
          else if (drawerSnapPoint === 'half') setDrawerSnapPoint('expanded');
          else setDrawerSnapPoint('half');
        }}
        style={{
          width: '100%',
          padding: '12px 0 8px 0',
          display: 'flex',
          justifyContent: 'center',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            width: 48,
            height: 5,
            borderRadius: 3,
            backgroundColor: 'var(--surface-border)',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px 16px' }}>
        {children}
      </div>
    </div>
  );
};
