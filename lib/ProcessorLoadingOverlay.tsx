'use client';

import React from 'react';
import { useProcessorLoading } from './ProcessorLoadingContext';

export function ProcessorLoadingOverlay() {
  const { isApplyingProcessor } = useProcessorLoading();

  if (!isApplyingProcessor) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      zIndex: 9999,
      pointerEvents: 'none', // Allow clicks through to underlying UI
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{ 
        color: '#fff', 
        fontSize: '16px', 
        fontWeight: 600,
        textAlign: 'center',
        padding: '0 20px'
      }}>
        Securing your privacy...
      </div>
      <div style={{ 
        color: 'rgba(255, 255, 255, 0.7)', 
        fontSize: '13px',
        textAlign: 'center',
        padding: '0 20px'
      }}>
        Applying background effect
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

