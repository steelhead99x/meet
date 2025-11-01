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
import toast from 'react-hot-toast';
import { RoomErrorBoundary } from '@/app/ErrorBoundary';
import { ReconnectionBanner } from '@/lib/ReconnectionBanner';
import { ScreenSharePIP } from '@/lib/ScreenSharePIP';
import { BrowserWindowPIP } from '@/lib/BrowserWindowPIP';
import { CarouselNavigation } from '@/lib/CarouselNavigation';
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

        // Step 2: Create room options with E2EE config
        let videoCodec: VideoCodec | undefined = props.codec ? props.codec : 'vp9';
        if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
          videoCodec = undefined;
        }

        const videoCaptureDefaults: VideoCaptureOptions = {
          deviceId: videoDeviceId ?? undefined,
          resolution: props.hq 
            ? { width: 1920, height: 1080, frameRate: 30 }
            : { width: 1280, height: 720, frameRate: 30 },
        };

        const publishDefaults: TrackPublishDefaults = {
          dtx: true,
          // Enhanced video encoding for better quality
          videoEncoding: props.hq 
            ? {
                maxBitrate: 3_000_000, // 3 Mbps for high quality
                maxFramerate: 30,
              }
            : {
                maxBitrate: 2_000_000, // 2 Mbps for standard quality
                maxFramerate: 30,
              },
          // Better simulcast layers with higher bitrates
          videoSimulcastLayers: props.hq
            ? [
                VideoPresets.h1080,
                VideoPresets.h720,
                VideoPresets.h360,
              ]
            : [
                VideoPresets.h720,
                VideoPresets.h360,
                VideoPresets.h180,
              ],
          red: !e2eeEnabled,
          videoCodec,
        };

        const roomOptions: RoomOptions = {
          videoCaptureDefaults,
          publishDefaults,
          audioCaptureDefaults: {
            deviceId: audioDeviceId ?? undefined,
          },
          adaptiveStream: true,
          dynacast: true,
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

        // Create room without E2EE
        const roomOptions: RoomOptions = {
          videoCaptureDefaults: {
            deviceId: videoDeviceId ?? undefined,
            resolution: props.hq 
              ? { width: 1920, height: 1080, frameRate: 30 }
              : { width: 1280, height: 720, frameRate: 30 },
          },
          publishDefaults: {
            dtx: true,
            // Enhanced video encoding for better quality
            videoEncoding: props.hq 
              ? {
                  maxBitrate: 3_000_000, // 3 Mbps for high quality
                  maxFramerate: 30,
                }
              : {
                  maxBitrate: 2_000_000, // 2 Mbps for standard quality
                  maxFramerate: 30,
                },
            // Better simulcast layers with higher bitrates
            videoSimulcastLayers: props.hq
              ? [
                  VideoPresets.h1080,
                  VideoPresets.h720,
                  VideoPresets.h360,
                ]
              : [
                  VideoPresets.h720,
                  VideoPresets.h360,
                  VideoPresets.h180,
                ],
            red: true,
            videoCodec: props.codec,
          },
          audioCaptureDefaults: {
            deviceId: audioDeviceId ?? undefined,
          },
          adaptiveStream: true,
          dynacast: true,
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

  // Extract connection values to avoid object reference dependency issues
  const serverUrl = props.connectionDetails.serverUrl;
  const participantToken = props.connectionDetails.participantToken;
  const videoEnabled = props.userChoices.videoEnabled;
  const audioEnabled = props.userChoices.audioEnabled;

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

  console.log('[RoomContent] Rendering', {
    hasScreenShare,
    screenShareCount: tracks.length,
  });

  return (
    <>
      <KeyboardShortcuts />
      <ReconnectionBanner />
      <ConnectionQualityTooltip />
      <BrowserWindowPIP />
      <CarouselNavigation />

      {/* Custom adaptive layout with chat and controls */}
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
                padding: '20px 16px 16px',
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
      </div>
    </>
  );
}


