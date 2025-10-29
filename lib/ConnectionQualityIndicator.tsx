'use client';

import { useConnectionQualityIndicator } from '@livekit/components-react';
import { Participant, ConnectionQuality } from 'livekit-client';
import { useState, useEffect, useCallback } from 'react';

interface ConnectionStats {
  videoBitrate: number;
  audioBitrate: number;
  videoPacketsLost: number;
  audioPacketsLost: number;
  videoJitter: number;
  audioJitter: number;
  lastUpdated: Date;
}

/**
 * Displays a connection quality indicator for a participant.
 * Shows a colored icon representing the connection quality:
 * - 🟢 Excellent
 * - 🟡 Good  
 * - 🟠 Poor
 * - 🔴 Lost/Unknown
 * 
 * On hover, displays detailed connection statistics including bitrates,
 * packet loss, and jitter. Statistics refresh every 60 seconds.
 * 
 * @param participant - The participant to show connection quality for
 */
export function ConnectionQualityIndicator({ participant }: { participant: Participant }) {
  const quality = useConnectionQualityIndicator({ participant });
  const [showTooltip, setShowTooltip] = useState(false);
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  
  // Fetch connection statistics
  const fetchStats = useCallback(async () => {
    try {
      let videoBitrate = 0;
      let audioBitrate = 0;
      let videoPacketsLost = 0;
      let audioPacketsLost = 0;
      let videoJitter = 0;
      let audioJitter = 0;

      // Get stats from participant's tracks
      const trackPublications = Array.from(participant.trackPublications.values());
      
      for (const publication of trackPublications) {
        if (publication.track) {
          const track = publication.track;
          
          // Get current bitrate from track
          const bitrate = Math.ceil(track.currentBitrate / 1000); // Convert to kbps
          
          if (publication.kind === 'video') {
            videoBitrate += bitrate;
          } else if (publication.kind === 'audio') {
            audioBitrate += bitrate;
          }

          // Try to get RTCStats if available (only for remote tracks)
          try {
            if (track.mediaStreamTrack && 'receiver' in track && (track as any).receiver) {
              const receiver = (track as any).receiver as RTCRtpReceiver;
              const rtcStats = await receiver.getStats();
              
              rtcStats.forEach((report) => {
                if (report.type === 'inbound-rtp') {
                  const packetsLost = report.packetsLost || 0;
                  const jitter = report.jitter ? Math.round(report.jitter * 1000) : 0; // Convert to ms
                  
                  if (publication.kind === 'video') {
                    videoPacketsLost += packetsLost;
                    videoJitter = Math.max(videoJitter, jitter);
                  } else if (publication.kind === 'audio') {
                    audioPacketsLost += packetsLost;
                    audioJitter = Math.max(audioJitter, jitter);
                  }
                }
              });
            }
          } catch (e) {
            // RTCStats not available, skip
          }
        }
      }

      setStats({
        videoBitrate,
        audioBitrate,
        videoPacketsLost,
        audioPacketsLost,
        videoJitter,
        audioJitter,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Failed to fetch connection stats:', error);
    }
  }, [participant]);

  // Fetch stats on hover and refresh every 60 seconds
  useEffect(() => {
    if (showTooltip) {
      fetchStats();
      const interval = setInterval(fetchStats, 60000); // 60 seconds
      
      return () => clearInterval(interval);
    }
  }, [showTooltip, fetchStats]);
  
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
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
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
      
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
            minWidth: '200px',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>
            {display.label}
          </div>
          
          {!stats ? (
            <div style={{ textAlign: 'center', opacity: 0.7, padding: '8px 0' }}>
              Loading stats...
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Video Bitrate:</span>
                  <span style={{ fontWeight: 500, marginLeft: '12px' }}>{stats.videoBitrate} kbps</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Audio Bitrate:</span>
                  <span style={{ fontWeight: 500, marginLeft: '12px' }}>{stats.audioBitrate} kbps</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Video Loss:</span>
                  <span style={{ fontWeight: 500, marginLeft: '12px', color: stats.videoPacketsLost > 10 ? '#ff6b6b' : 'inherit' }}>
                    {stats.videoPacketsLost} packets
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Audio Loss:</span>
                  <span style={{ fontWeight: 500, marginLeft: '12px', color: stats.audioPacketsLost > 10 ? '#ff6b6b' : 'inherit' }}>
                    {stats.audioPacketsLost} packets
                  </span>
                </div>
                
                {stats.videoJitter > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Video Jitter:</span>
                    <span style={{ fontWeight: 500, marginLeft: '12px' }}>{stats.videoJitter} ms</span>
                  </div>
                )}
                
                {stats.audioJitter > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Audio Jitter:</span>
                    <span style={{ fontWeight: 500, marginLeft: '12px' }}>{stats.audioJitter} ms</span>
                  </div>
                )}
              </div>
              
              <div style={{ 
                marginTop: '8px', 
                paddingTop: '8px', 
                borderTop: '1px solid rgba(255,255,255,0.2)',
                fontSize: '10px',
                opacity: 0.6,
                textAlign: 'center'
              }}>
                Updated: {stats.lastUpdated.toLocaleTimeString()}
              </div>
            </>
          )}
          
          {/* Tooltip arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(0, 0, 0, 0.9)',
            }}
          />
        </div>
      )}
    </div>
  );
}

