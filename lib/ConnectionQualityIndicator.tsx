'use client';

import { useConnectionQualityIndicator } from '@livekit/components-react';
import { Participant, ConnectionQuality } from 'livekit-client';

/**
 * Displays a connection quality indicator for a participant.
 * Shows a colored icon representing the connection quality:
 * - 🟢 Excellent
 * - 🟡 Good  
 * - 🟠 Poor
 * - 🔴 Lost/Unknown
 * 
 * @param participant - The participant to show connection quality for
 */
export function ConnectionQualityIndicator({ participant }: { participant: Participant }) {
  const quality = useConnectionQualityIndicator({ participant });
  
  const getQualityDisplay = () => {
    // quality is an object with className and quality properties
    const qualityLevel = typeof quality === 'object' ? quality.quality : quality;
    
    switch (qualityLevel) {
      case ConnectionQuality.Excellent:
        return { icon: '🟢', label: 'Excellent connection' };
      case ConnectionQuality.Good:
        return { icon: '🟡', label: 'Good connection' };
      case ConnectionQuality.Poor:
        return { icon: '🟠', label: 'Poor connection' };
      default:
        return { icon: '🔴', label: 'Connection issues' };
    }
  };
  
  const display = getQualityDisplay();
  
  return (
    <div 
      title={display.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '14px',
        cursor: 'help',
      }}
    >
      <span role="img" aria-label={display.label}>
        {display.icon}
      </span>
    </div>
  );
}

