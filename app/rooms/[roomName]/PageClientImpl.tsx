'use client';

import React from 'react';
import { isMeetStaging } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { CustomPreJoin } from '@/lib/CustomPreJoin';
import { ConnectionQualityTooltip } from '@/lib/ConnectionQualityTooltip';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  RoomAudioRenderer,
  RoomContext,
  VideoConference,
  ControlBar,
  Chat,
  useTracks,
  LayoutContextProvider,
  useMaybeLayoutContext,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
  Track,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerformanceOptimizer';
import { loadUserPreferences, VideoResolution } from '@/lib/userPreferences';
import toast from 'react-hot-toast';
import { RoomErrorBoundary } from '@/app/ErrorBoundary';
import { ReconnectionBanner } from '@/lib/ReconnectionBanner';
import { BrowserWindowPIP } from '@/lib/BrowserWindowPIP';
import { CarouselNavigation } from '@/lib/CarouselNavigation';
import { LocalParticipantMarker } from '@/lib/LocalParticipantMarker';
import { ProcessorLoadingProvider } from '@/lib/ProcessorLoadingContext';
import { ProcessorLoadingOverlay } from '@/lib/ProcessorLoadingOverlay';
import { AdaptiveVideoLayout } from '@/lib/AdaptiveVideoLayout';
// Note: LiveKit v2 chat uses native sendChatMessage() API
// E2EE only applies to media tracks, not chat messages

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [useEncryption, setUseEncryption] = React.useState(true);
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    try {
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      url.searchParams.append('roomName', props.roomName);
      url.searchParams.append('participantName', values.username);
      if (props.region) {
        url.searchParams.append('region', props.region);
      }
      const connectionDetailsResp = await fetch(url.toString());
      
      if (!connectionDetailsResp.ok) {
        const errorText = await connectionDetailsResp.text();
        let errorMessage = 'Failed to get connection details';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const connectionDetailsData = await connectionDetailsResp.json();
      setConnectionDetails(connectionDetailsData);
    } catch (error) {
      console.error('Connection details error:', error);
      const message = error instanceof Error ? error.message : 'Failed to connect to the room';
      toast.error(message, {
        duration: 5000,
        position: 'top-center',
      });
      setPreJoinChoices(undefined);
    }
  }, [props.roomName, props.region]);
  
  const handlePreJoinValidate = React.useCallback((values: LocalUserChoices) => {
    if (!values.username || values.username.trim().length === 0) {
      return false;
    }
    if (values.username.length > 50) {
      return false;
    }
    if (!/^[a-zA-Z0-9\s._-]+$/.test(values.username)) {
      return false;
    }
    return true;
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => {
    console.error('PreJoin error:', e);
    toast.error('Failed to initialize devices. Please check permissions.', {
      duration: 5000,
      position: 'top-center',
    });
  }, []);

  return (
    <ProcessorLoadingProvider>
      <ProcessorLoadingOverlay />
      <main data-lk-theme="default" style={{ height: '100%' }}>
        {connectionDetails === undefined || preJoinChoices === undefined ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <CustomPreJoin
              defaults={preJoinDefaults}
              onSubmit={handlePreJoinSubmit}
              onValidate={handlePreJoinValidate}
              onError={handlePreJoinError}
            />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useEncryption}
                  onChange={(e) => setUseEncryption(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Use end-to-end encryption
              </label>
            </div>
          </div>
        ) : (
          <RoomErrorBoundary>
            <VideoConferenceComponent
              connectionDetails={connectionDetails}
              userChoices={preJoinChoices}
              codec={props.codec}
              hq={props.hq}
              useEncryption={useEncryption}
            />
          </RoomErrorBoundary>
        )}
      </main>
    </ProcessorLoadingProvider>
  );
}

// Helper function to convert user preferences to room configuration
function getVideoConfigFromPreferences(e2eeEnabled: boolean, urlCodec?: VideoCodec, urlHq?: boolean) {
  const prefs = loadUserPreferences();
  const videoQuality = prefs.videoQuality;

  // Resolution presets
  const resolutionPresets: Record<VideoResolution, { width: number; height: number }> = {
    '480p': { width: 640, height: 480 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 },
    '4K': { width: 3840, height: 2160 },
  };

  // Determine resolution
  let resolution = { width: 1280, height: 720, frameRate: 30 };
  if (videoQuality?.resolution) {
    const res = resolutionPresets[videoQuality.resolution];
    resolution = { ...res, frameRate: videoQuality.framerate || 30 };
  } else if (videoQuality?.preset) {
    switch (videoQuality.preset) {
      case 'standard':
        resolution = { width: 1280, height: 720, frameRate: 30 };
        break;
      case 'high':
        resolution = { width: 1920, height: 1080, frameRate: 30 };
        break;
      case 'ultra':
        resolution = { width: 2560, height: 1440, frameRate: 60 };
        break;
      default: // auto
        resolution = { width: 1280, height: 720, frameRate: 30 };
    }
  } else if (urlHq) {
    // Fallback to URL param
    resolution = { width: 1920, height: 1080, frameRate: 30 };
  }

  // Determine bitrate
  let maxBitrate = videoQuality?.maxBitrate || (urlHq ? 3_000_000 : 2_000_000);
  if (videoQuality?.preset && !videoQuality.maxBitrate) {
    switch (videoQuality.preset) {
      case 'standard':
        maxBitrate = 2_000_000;
        break;
      case 'high':
        maxBitrate = 3_000_000;
        break;
      case 'ultra':
        maxBitrate = 5_000_000;
        break;
    }
  }

  // Determine codec (URL param takes precedence, then user pref, then default)
  let videoCodec: VideoCodec | undefined = urlCodec || videoQuality?.codec || 'vp9';
  if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
    videoCodec = undefined; // E2EE doesn't support VP9/AV1
  }

  // Determine simulcast layers based on resolution
  const simulcastLayers = resolution.height >= 1080
    ? [VideoPresets.h1080, VideoPresets.h720, VideoPresets.h360]
    : resolution.height >= 720
    ? [VideoPresets.h720, VideoPresets.h360, VideoPresets.h180]
    : [VideoPresets.h360, VideoPresets.h180];

  return {
    resolution,
    videoEncoding: {
      maxBitrate,
      maxFramerate: resolution.frameRate,
    },
    videoSimulcastLayers: simulcastLayers,
    videoCodec,
    dynacast: videoQuality?.dynacast !== false, // Default to true
    adaptiveStream: videoQuality?.adaptiveStream !== false, // Default to true
  };
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  codec: VideoCodec;
  hq: boolean;
  useEncryption: boolean;
}) {
  const keyProvider = React.useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase, isResolved } = useSetupE2EE();
  const e2eeEnabled = !!(props.useEncryption && e2eePassphrase && worker);

  const [room, setRoom] = React.useState<Room | null>(null);
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  // Extract specific values from userChoices to avoid object reference issues
  const videoDeviceId = props.userChoices.videoDeviceId;
  const audioDeviceId = props.userChoices.audioDeviceId;

  // Set up E2EE and create room - only recreate when essential config changes
  React.useEffect(() => {
    let cancelled = false;

    const setupRoomWithE2EE = async () => {
      try {
        // Wait until E2EE resolution completes to avoid double room creation
        if (!isResolved) {
          return;
        }
        // Step 1: Set the key BEFORE creating the room
        if (e2eeEnabled) {
          await keyProvider.setKey(e2eePassphrase);
        }

        if (cancelled) return;

        // Step 2: Create room options with E2EE config and user preferences
        const videoConfig = getVideoConfigFromPreferences(e2eeEnabled, props.codec, props.hq);

        const videoCaptureDefaults: VideoCaptureOptions = {
          deviceId: videoDeviceId ?? undefined,
          resolution: videoConfig.resolution,
        };

        const publishDefaults: TrackPublishDefaults = {
          dtx: true,
          videoEncoding: videoConfig.videoEncoding,
          videoSimulcastLayers: videoConfig.videoSimulcastLayers,
          red: !e2eeEnabled,
          videoCodec: videoConfig.videoCodec,
        };

        const roomOptions: RoomOptions = {
          videoCaptureDefaults,
          publishDefaults,
          audioCaptureDefaults: {
            deviceId: audioDeviceId ?? undefined,
          },
          adaptiveStream: videoConfig.adaptiveStream,
          dynacast: videoConfig.dynacast,
          e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
          singlePeerConnection: isMeetStaging(),
        };

        // Step 3: Create the room with keyProvider that already has the key
        const newRoom = new Room(roomOptions);
        
        if (cancelled) {
          newRoom.disconnect();
          return;
        }

        if (e2eeEnabled) {
          // Enable E2EE before connecting
          await newRoom.setE2EEEnabled(true);
          toast.success('🔒 End-to-end encryption enabled', {
            duration: 3000,
            position: 'top-center',
          });
        }

        setRoom(newRoom);
        setE2eeSetupComplete(true);
      } catch (e) {
        if (cancelled) return;
        
        if (e instanceof DeviceUnsupportedError) {
          console.error('E2EE not supported:', e);
          toast.error(
            'Your browser does not support encrypted meetings. Please update to the latest version.',
            {
              duration: 8000,
              position: 'top-center',
            }
          );
        } else {
          console.error('E2EE setup error:', e);
          toast.error(
            'End-to-end encryption could not be enabled. Joining without encryption.',
            {
              duration: 6000,
              position: 'top-center',
            }
          );
        }

        // Create room without E2EE (using same video config)
        const videoConfig = getVideoConfigFromPreferences(false, props.codec, props.hq);
        
        const roomOptions: RoomOptions = {
          videoCaptureDefaults: {
            deviceId: videoDeviceId ?? undefined,
            resolution: videoConfig.resolution,
          },
          publishDefaults: {
            dtx: true,
            videoEncoding: videoConfig.videoEncoding,
            videoSimulcastLayers: videoConfig.videoSimulcastLayers,
            red: true,
            videoCodec: videoConfig.videoCodec,
          },
          audioCaptureDefaults: {
            deviceId: audioDeviceId ?? undefined,
          },
          adaptiveStream: videoConfig.adaptiveStream,
          dynacast: videoConfig.dynacast,
          singlePeerConnection: isMeetStaging(),
        };

        const newRoom = new Room(roomOptions);
        if (!cancelled) {
          setRoom(newRoom);
          setE2eeSetupComplete(true);
        }
      }
    };

    setupRoomWithE2EE();

    return () => {
      cancelled = true;
    };
    // Only recreate room when these specific values change, not when userChoices object reference changes
  }, [isResolved, e2eeEnabled, e2eePassphrase, keyProvider, worker, props.hq, props.codec, videoDeviceId, audioDeviceId]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const router = useRouter();
  
  // Use refs for handlers to avoid recreating event listeners
  const handlersRef = React.useRef({
    handleOnLeave: () => router.push('/'),
    handleError: (error: Error | unknown) => {
      console.error(error);
      const errorMessage = error instanceof Error && error.message 
        ? error.message 
        : 'An unexpected error occurred';
      const errorName = error instanceof Error ? error.name : '';
      
      // Provide better error messages based on error type
      if (errorName === 'NotReadableError') {
        // NotReadableError typically occurs with screen sharing or when device is in use
        toast.error('Could not access media device. It may be in use by another application or tab.', {
          duration: 7000,
          position: 'top-center',
        });
      } else if (errorMessage.includes('Could not start video source') || 
                 errorMessage.includes('Timeout starting video source') ||
                 (error instanceof Error && error.name === 'AbortError')) {
        toast.error('Camera or screen share failed to start. Please check permissions and try again.', {
          duration: 7000,
          position: 'top-center',
        });
      } else if (errorName === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
        toast.error('Permission denied. Please allow camera/microphone access and try again.', {
          duration: 6000,
          position: 'top-center',
        });
      } else if (errorName === 'NotFoundError') {
        toast.error('Camera or microphone not found. Please check your device connections.', {
          duration: 6000,
          position: 'top-center',
        });
      } else {
        toast.error(`Encountered an unexpected error: ${errorMessage}`, {
          duration: 5000,
          position: 'top-center',
        });
      }
    },
    handleEncryptionError: (error: Error | unknown) => {
      console.error(error);
      const errorMessage = error instanceof Error && error.message 
        ? error.message 
        : 'Encryption setup failed';
      toast.error(`Encryption error: ${errorMessage}`, {
        duration: 5000,
        position: 'top-center',
      });
    },
  });

  // Keep handlers up to date without triggering effect dependencies
  React.useEffect(() => {
    handlersRef.current.handleOnLeave = () => router.push('/');
  }, [router]);

  // Event listeners - stable references prevent unnecessary re-attachment
  React.useEffect(() => {
    if (!room) return;

    const onDisconnected = () => handlersRef.current.handleOnLeave();
    const onEncryptionError = (error: Error) => handlersRef.current.handleEncryptionError(error);
    const onMediaDevicesError = (error: Error) => handlersRef.current.handleError(error);

    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.EncryptionError, onEncryptionError);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.EncryptionError, onEncryptionError);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room]);

  // Screen share event listeners for debugging
  React.useEffect(() => {
    if (!room) return;

    const onLocalTrackPublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        console.log('[ScreenShare] ✅ Track published successfully:', {
          trackSid: publication.trackSid,
          kind: publication.kind,
          isSubscribed: !!publication.track,
          dimensions: publication.dimensions,
        });
        toast.success('Screen sharing started', {
          duration: 3000,
          position: 'top-center',
        });
      }
    };

    const onLocalTrackUnpublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        console.log('[ScreenShare] ❌ Track unpublished:', {
          trackSid: publication.trackSid,
        });
      }
    };

    const onTrackPublished = (publication: any, participant: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        console.log('[ScreenShare] 📺 Remote screen share track published by:', participant.identity);
      }
    };

    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.on(RoomEvent.TrackPublished, onTrackPublished);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
    };
  }, [room]);

  // Extract connection values to avoid object reference dependency issues
  const serverUrl = props.connectionDetails.serverUrl;
  const participantToken = props.connectionDetails.participantToken;
  const videoEnabled = props.userChoices.videoEnabled;
  const audioEnabled = props.userChoices.audioEnabled;
  const roomName = props.connectionDetails.roomName;

  // Chat message persistence - save messages to database via DOM observation
  // This approach works regardless of how LiveKit's Chat component sends messages
  React.useEffect(() => {
    if (!room || !roomName) return;

    const saveMessageToDb = async (message: string, participantIdentity: string, timestamp: number) => {
      try {
        await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantIdentity,
            message,
            timestamp,
          }),
        });
      } catch (error) {
        console.error('Failed to save chat message to database:', error);
        // Don't show toast - silent failure to avoid spam
      }
    };

    // Track saved messages to avoid duplicates
    const savedMessages = new Set<string>();

    // Watch for new messages in the chat UI
    const observeChatMessages = () => {
      // LiveKit renders messages container as UL with both lk-list and lk-chat-messages classes
      const messagesContainer = document.querySelector('[data-lk-theme] .lk-list.lk-chat-messages') ||
                                 document.querySelector('[data-lk-theme] .lk-chat-messages');
      if (!messagesContainer) return;

      const entries = Array.from(messagesContainer.querySelectorAll('.lk-chat-entry'));
      
      entries.forEach((entry) => {
        const messageBodyEl = entry.querySelector('.lk-message-body') || 
                             entry.querySelector('.lk-chat-message');
        const messageBodyText = messageBodyEl ? null : entry.textContent?.trim();
        const timeEl = entry.querySelector('time');
        const participantEl = entry.querySelector('.lk-participant-name');
        
        // Extract message text - either from element's textContent or direct text
        const messageText = messageBodyEl 
          ? (messageBodyEl.textContent?.trim() || '')
          : (messageBodyText || '');
        
        if (!messageText || !timeEl) return;

        const timestamp = timeEl.getAttribute('datetime');
        const participant = participantEl?.textContent?.trim() ||
                          (entry.hasAttribute('data-lk-local') ? room.localParticipant.identity : 'unknown');

        if (!timestamp) return;

        // Create unique key to avoid duplicates
        const messageKey = `${timestamp}-${participant}-${messageText.slice(0, 50)}`;
        
        if (savedMessages.has(messageKey)) return;
        
        savedMessages.add(messageKey);
        const timestamp_ms = new Date(timestamp).getTime();
        
        // Only save if message is recent (within last hour) or if it's new
        // This prevents saving historical messages we're loading
        const isRecent = Date.now() - timestamp_ms < 3600000; // 1 hour
        if (isRecent || !entry.hasAttribute('data-historical')) {
          saveMessageToDb(messageText, participant, timestamp_ms);
        }
      });
    };

    // Initial check
    const checkInterval = setInterval(observeChatMessages, 2000); // Check every 2 seconds

    // Also use MutationObserver for immediate detection
    const observer = new MutationObserver(() => {
      observeChatMessages();
    });

    // Watch for changes in chat container
    const chatContainer = document.querySelector('[data-lk-theme] .lk-chat-messages');
    if (chatContainer) {
      observer.observe(chatContainer, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearInterval(checkInterval);
      observer.disconnect();
    };
  }, [room, roomName]);

  // Load historical messages when room connects
  React.useEffect(() => {
    if (!room || !roomName || room.state !== 'connected') return;

    let retryCount = 0;
    const maxRetries = 10;
    const timeoutIds: NodeJS.Timeout[] = [];

    const loadHistoricalMessages = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/chat/messages?roomName=${encodeURIComponent(roomName)}&limit=100`);
        if (!response.ok) {
          console.error('Failed to fetch historical messages:', response.statusText);
          return;
        }
        
        const data = await response.json();
        const messages = data.messages || [];
        
        if (messages.length === 0) return;

        // Get the chat messages container - try multiple selectors
        // LiveKit renders messages container as UL with both lk-list and lk-chat-messages classes
        const messagesContainer = document.querySelector('[data-lk-theme] .lk-list.lk-chat-messages') ||
                                  document.querySelector('[data-lk-theme] .lk-chat-messages') ||
                                  document.querySelector('.lk-list.lk-chat-messages') ||
                                  document.querySelector('.lk-chat-messages');
        
        if (!messagesContainer) {
          retryCount++;
          if (retryCount < maxRetries) {
            const timeoutId = setTimeout(() => {
              loadHistoricalMessages();
            }, 500);
            timeoutIds.push(timeoutId);
          }
          return;
        }

        // No longer needed - messagesContainer is already the list
        const listContainer = messagesContainer;

        // Mark existing messages to avoid duplicates
        const existingMessages = new Set<string>();
        const existingEntries = Array.from(listContainer.querySelectorAll('.lk-chat-entry'));
        existingEntries.forEach((entry: Element) => {
          const timeEl = entry.querySelector('time');
          const textEl = entry.querySelector('.lk-message-body') ||
                        entry.querySelector('.lk-chat-message');
          const textContent = textEl 
            ? (textEl.textContent?.trim() || '')
            : (entry.textContent?.trim() || '');
          
          if (timeEl && textContent) {
            const timestamp = timeEl.getAttribute('datetime');
            if (timestamp) {
              existingMessages.add(`${timestamp}-${textContent.slice(0, 50)}`);
            }
          }
        });

        // Insert historical messages that don't already exist
        messages.forEach((msg: any) => {
          const timestamp = new Date(msg.timestamp);
          const timeStr = timestamp.toISOString();
          const messageKey = `${timeStr}-${msg.message.slice(0, 50)}`;
          
          if (existingMessages.has(messageKey)) return;

          // Create a message entry element matching LiveKit's structure
          const entry = document.createElement('li');
          entry.className = 'lk-chat-entry';
          entry.setAttribute('data-historical', 'true'); // Mark as historical
          
          const isLocal = msg.participant_identity === room.localParticipant.identity;
          if (isLocal) {
            entry.setAttribute('data-lk-local', 'true');
            entry.classList.add('lk-chat-entry-local');
          }

          // Escape HTML to prevent XSS
          const escapeHtml = (text: string) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          };
          
          entry.innerHTML = `
            <div class="lk-meta-data">
              <span class="lk-participant-name">${escapeHtml(msg.participant_identity)}</span>
              <time datetime="${timeStr}">${timestamp.toLocaleTimeString()}</time>
            </div>
            <div class="lk-message-body">${escapeHtml(msg.message)}</div>
          `;

          // Insert at the beginning (oldest messages first)
          // But if there are existing messages, insert before the first existing one
          const firstExisting = listContainer.querySelector('.lk-chat-entry:not([data-historical])');
          if (firstExisting) {
            listContainer.insertBefore(entry, firstExisting);
          } else {
            listContainer.appendChild(entry);
          }
        });

        // Scroll to bottom after loading historical messages
        setTimeout(() => {
          const chatMessages = document.querySelector('[data-lk-theme] .lk-chat-messages');
          if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }, 100);
      } catch (error) {
        console.error('Failed to load historical messages:', error);
      }
    };

    // Load messages after room is connected and chat UI is ready
    const initialTimeoutId = setTimeout(loadHistoricalMessages, 1500);
    timeoutIds.push(initialTimeoutId);
    
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [room, roomName, room?.state]);

  // Ensure we only connect once to avoid blinks on unrelated state changes
  const hasConnectedRef = React.useRef(false);
  React.useEffect(() => {
    if (!room || !e2eeSetupComplete || hasConnectedRef.current) return;

    hasConnectedRef.current = true;
    
    const connectToRoom = async () => {
      try {
        await room.connect(serverUrl, participantToken, connectOptions);
        
        // Enable tracks - CameraSettings will apply blur immediately when tracks become available
        // The blur will be applied before the track is published to other participants
        if (audioEnabled) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch (error) {
            console.error('Failed to enable microphone:', error);
            toast.error('Could not enable microphone', {
              duration: 4000,
              position: 'top-center',
            });
          }
        }
        
        if (videoEnabled) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch (error) {
            console.error('Failed to enable camera with selected device:', error);
            
            // If camera fails (likely due to invalid deviceId), try with default device
            if (videoDeviceId) {
              console.log('Retrying camera with default device...');
              try {
                // Clear the problematic deviceId from localStorage
                const { saveUserPreferences } = await import('@/lib/userPreferences');
                saveUserPreferences({ videoDeviceId: undefined });
                
                // Recreate room without specific deviceId
                const roomOptions = room.options;
                if (roomOptions.videoCaptureDefaults) {
                  roomOptions.videoCaptureDefaults.deviceId = undefined;
                }
                
                // Try enabling camera again (LiveKit will use default device)
                await room.localParticipant.setCameraEnabled(true);
                
                toast.success('Switched to default camera', {
                  duration: 3000,
                  position: 'top-center',
                });
              } catch (retryError) {
                console.error('Failed to enable camera with default device:', retryError);
                toast.error('Camera could not be started. Please check permissions.', {
                  duration: 5000,
                  position: 'top-center',
                });
              }
            } else {
              toast.error('Camera could not be started. Please check permissions.', {
                duration: 5000,
                position: 'top-center',
              });
            }
          }
        }
        
        // Reassert E2EE key after connection to ensure worker picks up keys for local participant
        if (e2eeEnabled) {
          try {
            await keyProvider.setKey(e2eePassphrase);
          } catch (err) {
            handlersRef.current.handleEncryptionError(err);
          }
        }
      } catch (error) {
        handlersRef.current.handleError(error);
      }
    };
    
    connectToRoom();
  }, [room, e2eeSetupComplete, connectOptions, e2eeEnabled, keyProvider, e2eePassphrase, serverUrl, participantToken, videoEnabled, audioEnabled, videoDeviceId]);

  // Cleanup - let LiveKit handle track cleanup automatically
  React.useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  // Must call hooks before any conditional rendering
  useLowCPUOptimizer(room ?? undefined);

  // Render loading state or room content
  return (
    <div className="lk-room-container">
      {!room ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>{e2eeEnabled ? 'Setting up encrypted connection...' : 'Preparing connection...'}</div>
        </div>
      ) : (
        <RoomContent room={room} worker={worker} />
      )}
    </div>
  );
}

// Hook to group chat messages from the same sender within a timeframe
function useChatMessageGrouping() {
  React.useEffect(() => {
    const groupMessages = () => {
      // LiveKit renders messages container as UL with both lk-list and lk-chat-messages classes
      const messagesContainer = document.querySelector('[data-lk-theme] .lk-list.lk-chat-messages') ||
                               document.querySelector('[data-lk-theme] .lk-chat-messages');
      if (!messagesContainer) return;

      const entries = Array.from(messagesContainer.querySelectorAll('.lk-chat-entry')) as HTMLElement[];
      
      if (entries.length === 0) return;

      // Clear all existing grouping markers
      entries.forEach(entry => {
        entry.removeAttribute('data-grouped');
      });

      // Group messages from same sender within 2 minutes (120000ms)
      const TIME_THRESHOLD = 120000; // 2 minutes in milliseconds
      
      for (let i = 1; i < entries.length; i++) {
        const currentEntry = entries[i];
        const previousEntry = entries[i - 1];
        
        // Check if local messages (your messages)
        // LiveKit uses data-lk-message-origin="local" attribute
        const currentIsLocal = currentEntry.getAttribute('data-lk-message-origin') === 'local' ||
                               currentEntry.hasAttribute('data-lk-local') || 
                               currentEntry.classList.contains('lk-chat-entry-local');
        const previousIsLocal = previousEntry.getAttribute('data-lk-message-origin') === 'local' ||
                                previousEntry.hasAttribute('data-lk-local') || 
                                previousEntry.classList.contains('lk-chat-entry-local');
        
        // Get participant names (for non-local messages)
        const currentNameEl = currentEntry.querySelector('.lk-participant-name');
        const previousNameEl = previousEntry.querySelector('.lk-participant-name');
        const currentName = currentNameEl?.textContent?.trim() || '';
        const previousName = previousNameEl?.textContent?.trim() || '';
        
        // Extract timestamps - try multiple methods
        let currentTimestamp: number | null = null;
        let previousTimestamp: number | null = null;
        
        // Method 1: Try datetime attribute on time element
        const currentTimeEl = currentEntry.querySelector('time');
        const previousTimeEl = previousEntry.querySelector('time');
        
        if (currentTimeEl) {
          const datetime = currentTimeEl.getAttribute('datetime');
          if (datetime) {
            currentTimestamp = new Date(datetime).getTime();
          }
          // If no datetime attribute, try title attribute on the entry
          if (!currentTimestamp && currentEntry.hasAttribute('title')) {
            const title = currentEntry.getAttribute('title');
            if (title) {
              const parsed = new Date(title);
              if (!isNaN(parsed.getTime())) {
                currentTimestamp = parsed.getTime();
              }
            }
          }
          // Last resort: try parsing time element text
          if (!currentTimestamp) {
            const timeText = currentTimeEl.textContent?.trim();
            if (timeText) {
              // Try to parse common time formats
              const parsed = new Date(timeText);
              if (!isNaN(parsed.getTime())) {
                currentTimestamp = parsed.getTime();
              }
            }
          }
        }
        
        if (previousTimeEl) {
          const datetime = previousTimeEl.getAttribute('datetime');
          if (datetime) {
            previousTimestamp = new Date(datetime).getTime();
          }
          // If no datetime attribute, try title attribute
          if (!previousTimestamp && previousEntry.hasAttribute('title')) {
            const title = previousEntry.getAttribute('title');
            if (title) {
              const parsed = new Date(title);
              if (!isNaN(parsed.getTime())) {
                previousTimestamp = parsed.getTime();
              }
            }
          }
          // Last resort: try parsing time element text
          if (!previousTimestamp) {
            const timeText = previousTimeEl.textContent?.trim();
            if (timeText) {
              const parsed = new Date(timeText);
              if (!isNaN(parsed.getTime())) {
                previousTimestamp = parsed.getTime();
              }
            }
          }
        }
        
        // Determine if messages should be grouped
        // Same sender if: both are local, or both are remote with same name
        const sameSender = 
          (currentIsLocal && previousIsLocal) || 
          (!currentIsLocal && !previousIsLocal && currentName === previousName && currentName !== '');
        
        // Within timeframe if timestamps are close enough
        let withinTimeframe = false;
        if (currentTimestamp !== null && previousTimestamp !== null) {
          const timeDiff = Math.abs(currentTimestamp - previousTimestamp);
          withinTimeframe = timeDiff <= TIME_THRESHOLD;
        } else if (currentTimestamp === null && previousTimestamp === null) {
          // If we can't get timestamps but same sender, assume they're close enough
          withinTimeframe = true;
        }
        
        // If same sender and within timeframe, mark as grouped
        if (sameSender && withinTimeframe) {
          currentEntry.setAttribute('data-grouped', 'true');
        }
      }
    };

    // Initial grouping
    groupMessages();

    // Watch for new messages
    // LiveKit renders messages container as UL with both lk-list and lk-chat-messages classes
    const messagesContainer = document.querySelector('[data-lk-theme] .lk-list.lk-chat-messages') ||
                              document.querySelector('[data-lk-theme] .lk-chat-messages');
    if (!messagesContainer) return;

    const observer = new MutationObserver(() => {
      // Debounce grouping to avoid excessive work
      setTimeout(groupMessages, 50);
    });

    observer.observe(messagesContainer, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);
}

// Wrapper component to apply chat visibility attributes and message grouping
function ChatWrapper({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  
  // Apply message grouping
  useChatMessageGrouping();
  
  React.useEffect(() => {
    const updateChatAttributes = () => {
      if (wrapperRef.current) {
        const chatElement = wrapperRef.current.querySelector('.lk-chat') as HTMLElement;
        if (chatElement) {
          chatElement.setAttribute('data-lk-chat-open', isOpen ? 'true' : 'false');
          chatElement.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
          return true;
        }
      }
      return false;
    };
    
    // Try to update immediately
    if (updateChatAttributes()) {
      return;
    }
    
    // If chat element not found yet, wait for it to be rendered
    const observer = new MutationObserver(() => {
      if (updateChatAttributes()) {
        observer.disconnect();
      }
    });
    
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current, {
        childList: true,
        subtree: true,
      });
    }
    
    // Also try after a short delay in case MutationObserver doesn't catch it
    const timeout = setTimeout(() => {
      updateChatAttributes();
      observer.disconnect();
    }, 100);
    
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isOpen]);
  
  return <div ref={wrapperRef} style={{ height: '100%' }}>{children}</div>;
}

// Separate component for room content to isolate hooks
function RoomContent({ room, worker }: { room: Room; worker: Worker | undefined }) {
  return (
    <RoomContext.Provider value={room}>
      <RoomContentInner />
      <RoomAudioRenderer />
      <DebugMode />
      <RecordingIndicator />
      <ProcessorLoadingOverlay />
    </RoomContext.Provider>
  );
}

// Inner component that uses hooks requiring room context
function RoomContentInner() {
  // Check if anyone is screen sharing - now safe to use useTracks inside RoomContext
  const tracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const hasScreenShare = tracks.length > 0;
  
  // Track settings menu open state manually (for when not using VideoConference)
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  // Track chat open state manually (for when not using VideoConference)
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const layoutContext = useMaybeLayoutContext();

  console.log('[RoomContent] Rendering', {
    hasScreenShare,
    screenShareCount: tracks.length,
  });
  
  // Listen for settings button clicks from ControlBar and LayoutContext
  React.useEffect(() => {
    if (hasScreenShare) return; // VideoConference handles settings
    
    const checkSettingsState = () => {
      // Check LayoutContext widget state first (most reliable)
      if (layoutContext?.widget?.state) {
        const state = layoutContext.widget.state as any;
        const isOpen = state.settings === true;
        setIsSettingsOpen(isOpen);
        return;
      }
      
      // Fallback: check DOM for modal state
      const modal = document.querySelector('.lk-settings-menu-modal');
      const isOpen = modal && modal.getAttribute('aria-hidden') !== 'true';
      setIsSettingsOpen(!!isOpen);
    };
    
    // Check initial state
    checkSettingsState();
    
    // Subscribe to widget state changes if available
    let unsubscribe: (() => void) | undefined;
    const widget = layoutContext?.widget as any;
    if (widget?.subscribe) {
      unsubscribe = widget.subscribe((state: any) => {
        const isOpen = state.settings === true;
        setIsSettingsOpen(isOpen);
      });
    }
    
    // Watch for DOM changes (when LiveKit toggles settings via ControlBar)
    const observer = new MutationObserver(() => {
      checkSettingsState();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'data-lk-settings-menu-open']
    });
    
    return () => {
      observer.disconnect();
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [hasScreenShare, layoutContext]);
  
  // Listen for chat button clicks from ControlBar and LayoutContext
  React.useEffect(() => {
    if (hasScreenShare) return; // VideoConference handles chat
    
    const checkChatState = () => {
      // Check LayoutContext widget state first (most reliable)
      if (layoutContext?.widget?.state) {
        const state = layoutContext.widget.state as any;
        const isOpen = state.chat === true;
        setIsChatOpen(isOpen);
        return;
      }
      
      // Fallback: check DOM for chat state
      const chat = document.querySelector('.lk-chat');
      const isOpen = chat && (
        chat.getAttribute('data-lk-chat-open') === 'true' ||
        chat.getAttribute('aria-hidden') !== 'true'
      );
      setIsChatOpen(!!isOpen);
    };
    
    // Check initial state
    checkChatState();
    
    // Subscribe to widget state changes if available
    let unsubscribe: (() => void) | undefined;
    const widget = layoutContext?.widget as any;
    if (widget?.subscribe) {
      unsubscribe = widget.subscribe((state: any) => {
        const isOpen = state.chat === true;
        setIsChatOpen(isOpen);
      });
    }
    
    // Watch for DOM changes (when LiveKit toggles chat via ControlBar)
    const observer = new MutationObserver(() => {
      checkChatState();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'data-lk-chat-open']
    });
    
    return () => {
      observer.disconnect();
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [hasScreenShare, layoutContext]);

  // Also listen for direct button clicks as fallback
  React.useEffect(() => {
    if (hasScreenShare) return;
    
    const handleSettingsClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click is on settings button - try multiple selectors
      const button = target.closest('button[aria-label*="Settings"]') || 
                     target.closest('button[aria-label*="settings"]') ||
                     target.closest('.lk-settings-menu-toggle') ||
                     target.closest('.lk-settings-toggle') ||
                     target.closest('button[data-lk-source="settings"]');
      
      // Don't handle clicks inside the settings menu itself or the modal overlay
      if (button && !target.closest('.settings-menu') && !target.closest('.lk-settings-menu-modal')) {
        const buttonLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const buttonClass = (button.className || '').toLowerCase();
        const isSettingsButton = buttonLabel.includes('setting') ||
                               buttonClass.includes('settings') ||
                               buttonClass.includes('lk-settings');
        
        if (isSettingsButton) {
          e.preventDefault();
          e.stopPropagation();
          
          // Toggle via LayoutContext if available
          if (layoutContext?.widget?.dispatch) {
            layoutContext.widget.dispatch({ msg: 'toggle_settings' });
          } else {
            // Fallback: toggle manually
            setIsSettingsOpen(prev => {
              const newState = !prev;
              console.log('[Settings] Toggling settings menu:', newState);
              return newState;
            });
          }
        }
      }
      
      // Close menu when clicking outside (on overlay)
      if (!target.closest('.settings-menu') && target.closest('.lk-settings-menu-modal')) {
        if (layoutContext?.widget?.dispatch) {
          layoutContext.widget.dispatch({ msg: 'toggle_settings' });
        } else {
          setIsSettingsOpen(false);
        }
      }
    };
    
    // Use capture phase to catch the event early
    document.addEventListener('click', handleSettingsClick, true);
    return () => {
      document.removeEventListener('click', handleSettingsClick, true);
    };
  }, [hasScreenShare, layoutContext]);

  // Also listen for direct chat button clicks as fallback
  React.useEffect(() => {
    if (hasScreenShare) return;
    
    const handleChatClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click is on chat button - try multiple selectors
      const button = target.closest('.lk-chat-toggle') ||
                     target.closest('button[aria-label*="Chat"]') || 
                     target.closest('button[aria-label*="chat"]') ||
                     target.closest('button[data-lk-source="chat"]');
      
      // Don't handle clicks inside the chat panel itself
      if (button && !target.closest('.lk-chat') && !target.closest('.lk-chat-messages') && !target.closest('.lk-chat-form')) {
        const buttonLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const buttonClass = (button.className || '').toLowerCase();
        const isChatButton = buttonClass.includes('lk-chat-toggle') ||
                           buttonLabel.includes('chat') ||
                           buttonClass.includes('chat');
        
        if (isChatButton) {
          console.log('[Chat] Chat button clicked, current state:', isChatOpen);
          e.preventDefault();
          e.stopPropagation();
          
          // Always toggle manually - more reliable
          setIsChatOpen(prev => {
            const newState = !prev;
            console.log('[Chat] Toggling chat panel to:', newState);
            return newState;
          });
          
          // Also try LayoutContext dispatch if available (but don't rely on it)
          if (layoutContext?.widget?.dispatch) {
            try {
              layoutContext.widget.dispatch({ msg: 'toggle_chat' });
            } catch (err) {
              console.warn('[Chat] LayoutContext dispatch failed:', err);
            }
          }
        }
      }
    };
    
    // Use capture phase to catch the event early
    document.addEventListener('click', handleChatClick, true);
    return () => {
      document.removeEventListener('click', handleChatClick, true);
    };
  }, [hasScreenShare, layoutContext, isChatOpen]);

  // Handle close button in chat header (X button)
  React.useEffect(() => {
    if (hasScreenShare) return;
    
    const handleChatCloseClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click is on the close button in chat header
      const closeButton = target.closest('.lk-chat-header button') ||
                         (target.closest('.lk-chat-header') && target.closest('button'));
      
      if (closeButton) {
        // Verify we're actually in the chat header
        const chatHeader = target.closest('.lk-chat-header');
        if (chatHeader) {
          console.log('[Chat] Close button clicked in chat header');
          e.preventDefault();
          e.stopPropagation();
          
          // Close the chat
          setIsChatOpen(false);
          
          // Also try LayoutContext dispatch if available
          if (layoutContext?.widget?.dispatch) {
            try {
              layoutContext.widget.dispatch({ msg: 'toggle_chat' });
            } catch (err) {
              console.warn('[Chat] LayoutContext dispatch failed:', err);
            }
          }
        }
      }
    };
    
    // Use capture phase to catch the event early
    document.addEventListener('click', handleChatCloseClick, true);
    return () => {
      document.removeEventListener('click', handleChatCloseClick, true);
    };
  }, [hasScreenShare, layoutContext]);

  return (
    <>
      <KeyboardShortcuts />
      <ReconnectionBanner />
      <ConnectionQualityTooltip />
      <LocalParticipantMarker />
      <BrowserWindowPIP />
      <CarouselNavigation />

      {/* Custom adaptive layout with chat and controls */}
      <LayoutContextProvider>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            position: 'relative',
            overflow: 'hidden',
            background: '#000',
          }}
        >
          {/* Main video area - use adaptive layout when no screen share, or default VideoConference with screen share */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Videos */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {hasScreenShare ? (
                // When screen sharing, use default VideoConference layout (better for screen share viewing)
                // VideoConference provides its own LayoutContextProvider
                <VideoConference
                  SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
                  chatMessageFormatter={formatChatMessageLinks}
                />
              ) : (
                // When no screen share, use adaptive PIP layout
                <AdaptiveVideoLayout />
              )}
            </div>

            {/* Control bar at bottom - only show when using adaptive layout */}
            {!hasScreenShare && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 60%, transparent 100%)',
                  padding: '20px 0 16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ControlBar
                  controls={{
                    microphone: true,
                    camera: true,
                    screenShare: true,
                    chat: true,
                    leave: true,
                    settings: SHOW_SETTINGS_MENU,
                  }}
                />
              </div>
            )}
          </div>

          {/* Chat panel - only show when not using VideoConference (which has its own chat) */}
          {/* Chat visibility is controlled by ControlBar via LayoutContext */}
          {!hasScreenShare && (
            <ChatWrapper isOpen={isChatOpen}>
              <Chat
                style={{
                  height: '100%',
                  width: '380px',
                }}
                messageFormatter={formatChatMessageLinks}
              />
            </ChatWrapper>
          )}
        </div>

        {/* Settings menu - ControlBar manages it via LayoutContext */}
        {/* Wrap in modal structure that LiveKit expects when settings is toggled */}
        {!hasScreenShare && SHOW_SETTINGS_MENU && (
          <div 
            className="lk-settings-menu-modal" 
            aria-hidden={!isSettingsOpen ? "true" : "false"}
            data-lk-settings-menu-open={isSettingsOpen ? "true" : undefined}
            onClick={(e) => {
              // Close when clicking on the overlay (not on the menu itself)
              if (e.target === e.currentTarget) {
                if (layoutContext?.widget?.dispatch) {
                  layoutContext.widget.dispatch({ msg: 'toggle_settings' });
                } else {
                  setIsSettingsOpen(false);
                }
              }
            }}
          >
            <SettingsMenu />
          </div>
        )}
      </LayoutContextProvider>
    </>
  );
}


