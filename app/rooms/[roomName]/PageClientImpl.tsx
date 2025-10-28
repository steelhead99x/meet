'use client';

import React from 'react';
import { isMeetStaging } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { E2EEStatusIndicator } from '@/lib/E2EEStatusIndicator';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomAudioRenderer,
  RoomContext,
  VideoConference,
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
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerformanceOptimizer';
import toast from 'react-hot-toast';
import { RoomErrorBoundary } from '@/app/ErrorBoundary';
import { ReconnectionBanner } from '@/lib/ReconnectionBanner';
import { createE2EEMessageDecoder, createE2EEMessageEncoder } from '@/lib/e2eeChatCodec';

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
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
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
            options={{ codec: props.codec, hq: props.hq, useEncryption }}
          />
        </RoomErrorBoundary>
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
    useEncryption: boolean;
  };
}) {
  const keyProvider = React.useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase, isResolved } = useSetupE2EE();
  const e2eeEnabled = !!(props.options.useEncryption && e2eePassphrase && worker);

  const [room, setRoom] = React.useState<Room | null>(null);
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  // Set up E2EE and create room
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
          console.log('E2EE Setup: Starting encryption setup');
          console.log('E2EE Setup: Passphrase length:', e2eePassphrase?.length);
          console.log('E2EE Setup: Worker available:', !!worker);
          
          await keyProvider.setKey(e2eePassphrase);
          console.log('E2EE Setup: Key set successfully on keyProvider');
        } else {
          console.log('E2EE Setup: E2EE disabled (no passphrase or worker)');
        }

        if (cancelled) return;

        // Step 2: Create room options with E2EE config
        let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
        if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
          videoCodec = undefined;
        }

        const videoCaptureDefaults: VideoCaptureOptions = {
          deviceId: props.userChoices.videoDeviceId ?? undefined,
          resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
        };

        const publishDefaults: TrackPublishDefaults = {
          dtx: true,
          videoSimulcastLayers: props.options.hq
            ? [VideoPresets.h1080, VideoPresets.h720]
            : [VideoPresets.h540, VideoPresets.h216],
          red: !e2eeEnabled,
          videoCodec,
        };

        const roomOptions: RoomOptions = {
          videoCaptureDefaults,
          publishDefaults,
          audioCaptureDefaults: {
            deviceId: props.userChoices.audioDeviceId ?? undefined,
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
          console.log('E2EE Setup: Room created with E2EE');
          console.log('E2EE Setup: E2EE enabled successfully');
          console.log('E2EE Setup: room.isE2EEEnabled =', newRoom.isE2EEEnabled);
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
            deviceId: props.userChoices.videoDeviceId ?? undefined,
            resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
          },
          publishDefaults: {
            dtx: true,
            videoSimulcastLayers: props.options.hq
              ? [VideoPresets.h1080, VideoPresets.h720]
              : [VideoPresets.h540, VideoPresets.h216],
            red: true,
            videoCodec: props.options.codec,
          },
          audioCaptureDefaults: {
            deviceId: props.userChoices.audioDeviceId ?? undefined,
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
  }, [isResolved, e2eeEnabled, e2eePassphrase, keyProvider, worker, props.options.hq, props.options.codec, props.userChoices]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  
  const handleError = React.useCallback((error: Error | unknown) => {
    console.error(error);
    const errorMessage = error instanceof Error && error.message 
      ? error.message 
      : 'An unexpected error occurred';
    toast.error(`Encountered an unexpected error: ${errorMessage}`, {
      duration: 5000,
      position: 'top-center',
    });
  }, []);
  
  const handleEncryptionError = React.useCallback((error: Error | unknown) => {
    console.error(error);
    const errorMessage = error instanceof Error && error.message 
      ? error.message 
      : 'Encryption setup failed';
    toast.error(`Encryption error: ${errorMessage}`, {
      duration: 5000,
      position: 'top-center',
    });
  }, []);

  // Event listeners - separate from connection logic
  React.useEffect(() => {
    if (!room) return;

    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [room, handleOnLeave, handleError, handleEncryptionError]);

  // Ensure we only connect once to avoid blinks on unrelated state changes
  const hasConnectedRef = React.useRef(false);
  React.useEffect(() => {
    if (!room || !e2eeSetupComplete || hasConnectedRef.current) return;

    hasConnectedRef.current = true;
    room
      .connect(
        props.connectionDetails.serverUrl,
        props.connectionDetails.participantToken,
        connectOptions,
      )
      .then(() => {
        if (props.userChoices.videoEnabled) {
          return room.localParticipant.setCameraEnabled(true);
        }
      })
      .then(() => {
        if (props.userChoices.audioEnabled) {
          return room.localParticipant.setMicrophoneEnabled(true);
        }
      })
      .then(async () => {
        // Reassert E2EE key after connection to ensure worker picks up keys for local participant
        if (e2eeEnabled) {
          try {
            await keyProvider.setKey(e2eePassphrase);
          } catch (err) {
            handleEncryptionError(err);
          }
        }
      })
      .catch((error) => {
        handleError(error);
      });
  }, [room, e2eeSetupComplete, connectOptions, handleError, handleEncryptionError, e2eeEnabled, keyProvider, e2eePassphrase, props.connectionDetails.serverUrl, props.connectionDetails.participantToken, props.userChoices.audioEnabled, props.userChoices.videoEnabled]);

  // Cleanup - let LiveKit handle track cleanup automatically
  React.useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const lowPowerMode = useLowCPUOptimizer(room);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Show loading state while room is being created
  if (!room) {
    return (
      <div className="lk-room-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>{e2eeEnabled ? 'Setting up encrypted connection...' : 'Preparing connection...'}</div>
      </div>
    );
  }

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <E2EEStatusIndicator />
        <ReconnectionBanner />
        <KeyboardShortcuts />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          chatMessageEncoder={createE2EEMessageEncoder(worker, room.localParticipant.identity)}
          chatMessageDecoder={createE2EEMessageDecoder(worker, room.localParticipant.identity)}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        <RoomAudioRenderer />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}


