'use client';

import React from 'react';
import { decodePassphrase, isMeetStaging } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
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
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
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
        </div>
      ) : (
        <RoomErrorBoundary>
          <VideoConferenceComponent
            connectionDetails={connectionDetails}
            userChoices={preJoinChoices}
            options={{ codec: props.codec, hq: props.hq }}
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
  };
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: true, // Enable discontinuous transmission for bandwidth savings during silence
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: isMeetStaging(),
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const [room] = React.useState(() => new Room(roomOptions));

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
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
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const [connectionState, setConnectionState] = React.useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    toast.error(`Encountered an unexpected error: ${error.message}`, {
      duration: 5000,
      position: 'top-center',
    });
  }, []);
  
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    toast.error(`Encryption error: ${error.message}`, {
      duration: 5000,
      position: 'top-center',
    });
  }, []);

  // Event listeners - separate from connection logic
  React.useEffect(() => {
    const handleReconnecting = () => setConnectionState('reconnecting');
    const handleReconnected = () => setConnectionState('connected');
    const handleDisconnected = () => setConnectionState('disconnected');

    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);

    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
    };
  }, [room, handleOnLeave, handleError, handleEncryptionError]);

  // Connection logic - separate effect
  React.useEffect(() => {
    if (!e2eeSetupComplete) return;

    room
      .connect(
        props.connectionDetails.serverUrl,
        props.connectionDetails.participantToken,
        connectOptions,
      )
      .catch((error) => {
        handleError(error);
      });
    if (props.userChoices.videoEnabled) {
      room.localParticipant.setCameraEnabled(true).catch((error) => {
        handleError(error);
      });
    }
    if (props.userChoices.audioEnabled) {
      room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
        handleError(error);
      });
    }
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices, connectOptions, handleError]);

  // Cleanup - let LiveKit handle track cleanup automatically
  React.useEffect(() => {
    return () => {
      room.disconnect();
    };
  }, [room]);

  const lowPowerMode = useLowCPUOptimizer(room);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  return (
    <div className="lk-room-container">
      {connectionState === 'reconnecting' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: 'var(--lk-warning, #f59e0b)',
            color: 'white',
            padding: '8px',
            textAlign: 'center',
            zIndex: 1000,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          🔄 Reconnecting to room...
        </div>
      )}
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}
