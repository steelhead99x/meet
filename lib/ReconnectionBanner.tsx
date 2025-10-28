'use client';

import React from 'react';
import { useConnectionState } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

export function ReconnectionBanner() {
  const connectionState = useConnectionState();

  if (connectionState === ConnectionState.Connected) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      {connectionState === ConnectionState.Reconnecting && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            padding: '14px 24px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
          }}
        >
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Reconnecting to the room...</span>
        </div>
      )}
      {connectionState === ConnectionState.Disconnected && (
        <div
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            padding: '14px 24px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
          }}
        >
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <span>Connection lost. Please check your internet connection.</span>
        </div>
      )}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

