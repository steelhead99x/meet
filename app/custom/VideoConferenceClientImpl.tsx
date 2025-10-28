'use client';

import { formatChatMessageLinks, RoomContext, VideoConference } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  LogLevel,
  Room,
  RoomConnectOptions,
  RoomEvent,
  RoomOptions,
  VideoPresets,
  type VideoCodec,
} from 'livekit-client';
import { DebugMode } from '@/lib/Debug';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerformanceOptimizer';
import { isMeetStaging } from '@/lib/client-utils';
import toast from 'react-hot-toast';
import { RoomErrorBoundary } from '@/app/ErrorBoundary';

export function VideoConferenceClientImpl(props: {
  liveKitUrl: string;
  token: string;
  codec: VideoCodec | undefined;
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);

  const roomOptions = useMemo((): RoomOptions => {
    return {
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec: props.codec,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
      singlePeerConnection: isMeetStaging(),
    };
  }, [e2eeEnabled, props.codec, keyProvider, worker]);

  const [room] = useState(() => new Room(roomOptions));

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

  useEffect(() => {
    if (e2eeEnabled) {
      keyProvider.setKey(e2eePassphrase).then(() => {
        room.setE2EEEnabled(true).then(() => {
          setE2eeSetupComplete(true);
        });
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, keyProvider, room, setE2eeSetupComplete]);

  // Event listeners for connection state
  useEffect(() => {
    const handleReconnecting = () => setConnectionState('reconnecting');
    const handleReconnected = () => setConnectionState('connected');
    const handleDisconnected = () => setConnectionState('disconnected');
    
    const handleError = (error: Error) => {
      console.error('Room error:', error);
      toast.error(`Error: ${error.message}`, {
        duration: 5000,
        position: 'top-center',
      });
    };

    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.MediaDevicesError, handleError);

    return () => {
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [room]);

  // Connection logic
  useEffect(() => {
    if (!e2eeSetupComplete) return;

    room.connect(props.liveKitUrl, props.token, connectOptions).catch((error) => {
      console.error('Connection error:', error);
      toast.error(`Failed to connect: ${error.message}`, {
        duration: 5000,
        position: 'top-center',
      });
    });
    room.localParticipant.enableCameraAndMicrophone().catch((error) => {
      console.error('Media error:', error);
      toast.error(`Failed to enable camera/microphone: ${error.message}`, {
        duration: 5000,
        position: 'top-center',
      });
    });
  }, [room, props.liveKitUrl, props.token, connectOptions, e2eeSetupComplete]);

  // Cleanup - let LiveKit handle track cleanup automatically
  useEffect(() => {
    return () => {
      room.disconnect();
    };
  }, [room]);

  useLowCPUOptimizer(room);

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
          SettingsComponent={
            process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
          }
        />
        <DebugMode logLevel={LogLevel.debug} />
      </RoomContext.Provider>
    </div>
  );
}
