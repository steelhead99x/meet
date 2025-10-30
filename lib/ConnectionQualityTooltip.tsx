'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';

/**
 * Adds tooltips to LiveKit's native connection quality indicators
 * This approach is more robust than replacing the indicators
 */
export function ConnectionQualityTooltip() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    // Add tooltip styles to the document
    const styleId = 'connection-quality-tooltip-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .lk-connection-quality-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .lk-connection-quality-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.95);
          color: white;
          padding: 14px 18px;
          border-radius: 8px;
          font-size: 12px;
          white-space: normal;
          z-index: 9999;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          min-width: 280px;
          max-width: 320px;
        }

        .lk-connection-quality-wrapper:hover .lk-connection-quality-tooltip {
          opacity: 1;
        }

        .lk-connection-quality-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid rgba(0, 0, 0, 0.95);
        }

        .lk-connection-quality-tooltip-title {
          font-weight: bold;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          padding-bottom: 4px;
          font-size: 13px;
        }

        .lk-connection-quality-tooltip-stats {
          display: grid;
          gap: 6px;
        }

        .lk-connection-quality-tooltip-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .lk-connection-quality-tooltip-label {
          opacity: 0.8;
          flex: 1;
        }

        .lk-connection-quality-tooltip-value {
          font-weight: 500;
          margin-left: 12px;
        }

        .lk-connection-quality-tooltip-footer {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.2);
          font-size: 10px;
          opacity: 0.6;
          text-align: center;
        }

        .lk-connection-quality-tooltip-info {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.2);
          font-size: 10px;
          opacity: 0.7;
          line-height: 1.4;
        }

        .lk-stat-good {
          color: #4ade80;
        }

        .lk-stat-fair {
          color: #fbbf24;
        }

        .lk-stat-poor {
          color: #f87171;
        }
      `;
      document.head.appendChild(style);
    }

    const wrapIndicator = async (element: Element, participant: Participant) => {
      // Skip if already wrapped
      if (element.parentElement?.classList.contains('lk-connection-quality-wrapper')) {
        return;
      }

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'lk-connection-quality-wrapper';

      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'lk-connection-quality-tooltip';
      tooltip.innerHTML = `
        <div class="lk-connection-quality-tooltip-title">Loading...</div>
        <div class="lk-connection-quality-tooltip-stats">
          <div class="lk-connection-quality-tooltip-row">
            <span class="lk-connection-quality-tooltip-label">Loading stats...</span>
          </div>
        </div>
      `;

      // Wrap the element
      element.parentNode?.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      wrapper.appendChild(tooltip);

      // Fetch and update stats on hover
      wrapper.addEventListener('mouseenter', async () => {
        try {
          const stats = await fetchParticipantStats(participant);
          
          // Determine quality classes for each metric
          const videoBitrateClass = stats.videoBitrate > 1500 ? 'lk-stat-good' : 
                                   stats.videoBitrate > 500 ? 'lk-stat-fair' : 'lk-stat-poor';
          const audioBitrateClass = stats.audioBitrate > 64 ? 'lk-stat-good' : 
                                   stats.audioBitrate > 32 ? 'lk-stat-fair' : 'lk-stat-poor';
          const videoLossClass = stats.videoPacketsLost < 10 ? 'lk-stat-good' : 
                                stats.videoPacketsLost < 50 ? 'lk-stat-fair' : 'lk-stat-poor';
          const audioLossClass = stats.audioPacketsLost < 5 ? 'lk-stat-good' : 
                                stats.audioPacketsLost < 20 ? 'lk-stat-fair' : 'lk-stat-poor';
          const videoJitterClass = stats.videoJitter < 30 ? 'lk-stat-good' : 
                                  stats.videoJitter < 100 ? 'lk-stat-fair' : 'lk-stat-poor';
          const audioJitterClass = stats.audioJitter < 30 ? 'lk-stat-good' : 
                                  stats.audioJitter < 100 ? 'lk-stat-fair' : 'lk-stat-poor';
          
          tooltip.innerHTML = `
            <div class="lk-connection-quality-tooltip-title">${stats.qualityLabel}</div>
            <div class="lk-connection-quality-tooltip-stats">
              <div class="lk-connection-quality-tooltip-row">
                <span class="lk-connection-quality-tooltip-label">Video Bitrate:</span>
                <span class="lk-connection-quality-tooltip-value ${videoBitrateClass}">
                  ${stats.videoBitrate} kbps
                </span>
              </div>
              <div class="lk-connection-quality-tooltip-row">
                <span class="lk-connection-quality-tooltip-label">Audio Bitrate:</span>
                <span class="lk-connection-quality-tooltip-value ${audioBitrateClass}">
                  ${stats.audioBitrate} kbps
                </span>
              </div>
              <div class="lk-connection-quality-tooltip-row">
                <span class="lk-connection-quality-tooltip-label">Video Loss:</span>
                <span class="lk-connection-quality-tooltip-value ${videoLossClass}">
                  ${stats.videoPacketsLost} packets
                </span>
              </div>
              <div class="lk-connection-quality-tooltip-row">
                <span class="lk-connection-quality-tooltip-label">Audio Loss:</span>
                <span class="lk-connection-quality-tooltip-value ${audioLossClass}">
                  ${stats.audioPacketsLost} packets
                </span>
              </div>
              ${stats.videoJitter > 0 ? `
                <div class="lk-connection-quality-tooltip-row">
                  <span class="lk-connection-quality-tooltip-label">Video Jitter:</span>
                  <span class="lk-connection-quality-tooltip-value ${videoJitterClass}">
                    ${stats.videoJitter} ms
                  </span>
                </div>
              ` : ''}
              ${stats.audioJitter > 0 ? `
                <div class="lk-connection-quality-tooltip-row">
                  <span class="lk-connection-quality-tooltip-label">Audio Jitter:</span>
                  <span class="lk-connection-quality-tooltip-value ${audioJitterClass}">
                    ${stats.audioJitter} ms
                  </span>
                </div>
              ` : ''}
            </div>
            <div class="lk-connection-quality-tooltip-info">
              <strong>Good connection:</strong> High bitrate (video >1500 kbps, audio >64 kbps), low packet loss (<10), low jitter (<30ms).
              <br><strong>Poor connection:</strong> Low bitrate, high packet loss (>50), high jitter (>100ms).
            </div>
            <div class="lk-connection-quality-tooltip-footer">
              Updated: ${new Date().toLocaleTimeString()}
            </div>
          `;
        } catch (error) {
          console.error('Failed to fetch stats:', error);
          tooltip.innerHTML = `
            <div class="lk-connection-quality-tooltip-title">Connection Quality</div>
            <div class="lk-connection-quality-tooltip-stats">
              <div class="lk-connection-quality-tooltip-row">
                <span class="lk-connection-quality-tooltip-label">Unable to fetch stats</span>
              </div>
            </div>
          `;
        }
      });
    };

    const processIndicators = () => {
      // Find all participant tiles
      const tiles = document.querySelectorAll('[data-lk-participant]');
      console.log('[ConnectionQualityTooltip] Found', tiles.length, 'participant tiles');

      tiles.forEach((tile) => {
        const participantIdentity = tile.getAttribute('data-lk-participant');
        if (!participantIdentity) return;

        // Find participant
        let participant: Participant | undefined;
        if (room.localParticipant.identity === participantIdentity) {
          participant = room.localParticipant;
        } else {
          participant = room.remoteParticipants.get(participantIdentity);
        }

        if (!participant) return;

        // Find connection quality indicator (try multiple approaches)
        // LiveKit v2 uses different class naming patterns
        let indicator = 
          tile.querySelector('.lk-connection-quality') ||
          tile.querySelector('[class*="connection-quality"]') ||
          tile.querySelector('[data-lk-connection-quality]') ||
          tile.querySelector('[class*="ConnectionQuality"]') ||
          // Look for SVG with typical connection bars pattern
          Array.from(tile.querySelectorAll('svg')).find(svg => {
            const paths = svg.querySelectorAll('path, rect');
            // Connection quality typically has 3-5 bars/paths
            return paths.length >= 2 && paths.length <= 6 && svg.getAttribute('viewBox')?.includes('0 0');
          });

        if (indicator) {
          console.log('[ConnectionQualityTooltip] Found indicator for', participantIdentity);
          wrapIndicator(indicator, participant);
        } else {
          // Log what elements are in the tile for debugging
          const classes = Array.from(tile.querySelectorAll('[class]')).map(el => el.className).filter(Boolean);
          console.log('[ConnectionQualityTooltip] No indicator found for', participantIdentity, 'Available classes:', classes);
        }
      });
    };

    // Run with retries and more logging
    console.log('[ConnectionQualityTooltip] Starting indicator detection');
    processIndicators();
    setTimeout(() => {
      console.log('[ConnectionQualityTooltip] Retry 1 (100ms)');
      processIndicators();
    }, 100);
    setTimeout(() => {
      console.log('[ConnectionQualityTooltip] Retry 2 (500ms)');
      processIndicators();
    }, 500);
    setTimeout(() => {
      console.log('[ConnectionQualityTooltip] Retry 3 (1000ms)');
      processIndicators();
    }, 1000);
    setTimeout(() => {
      console.log('[ConnectionQualityTooltip] Retry 4 (2000ms)');
      processIndicators();
    }, 2000);

    // Watch for DOM changes
    const observer = new MutationObserver(() => {
      processIndicators();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [room]);

  return null;
}

async function fetchParticipantStats(participant: Participant) {
  let videoBitrate = 0;
  let audioBitrate = 0;
  let videoPacketsLost = 0;
  let audioPacketsLost = 0;
  let videoJitter = 0;
  let audioJitter = 0;

  const trackPublications = Array.from(participant.trackPublications.values());

  for (const publication of trackPublications) {
    if (publication.track) {
      const track = publication.track;
      const bitrate = Math.ceil(track.currentBitrate / 1000);

      if (publication.kind === 'video') {
        videoBitrate += bitrate;
      } else if (publication.kind === 'audio') {
        audioBitrate += bitrate;
      }

      try {
        if (track.mediaStreamTrack && 'receiver' in track && (track as any).receiver) {
          const receiver = (track as any).receiver as RTCRtpReceiver;
          const rtcStats = await receiver.getStats();

          rtcStats.forEach((report) => {
            if (report.type === 'inbound-rtp') {
              const packetsLost = report.packetsLost || 0;
              const jitter = report.jitter ? Math.round(report.jitter * 1000) : 0;

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
        // RTCStats not available
      }
    }
  }

  // Determine quality label based on packet loss and bitrate
  let qualityLabel = 'Connection Quality';
  if (videoPacketsLost > 50 || audioPacketsLost > 50) {
    qualityLabel = 'Poor connection';
  } else if (videoPacketsLost > 20 || audioPacketsLost > 20) {
    qualityLabel = 'Fair connection';
  } else if (videoBitrate > 1000 || audioBitrate > 100) {
    qualityLabel = 'Excellent connection';
  } else {
    qualityLabel = 'Good connection';
  }

  return {
    videoBitrate,
    audioBitrate,
    videoPacketsLost,
    audioPacketsLost,
    videoJitter,
    audioJitter,
    qualityLabel,
  };
}

