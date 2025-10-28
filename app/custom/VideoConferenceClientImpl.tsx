'use client';

import { formatChatMessageLinks, RoomAudioRenderer, RoomContext, VideoConference } from '@livekit/components-react';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerformanceOptimizer';
import { isMeetStaging } from '@/lib/client-utils';
import toast from 'react-hot-toast';
import { RoomErrorBoundary } from '@/app/ErrorBoundary';
import { ReconnectionBanner } from '@/lib/ReconnectionBanner';
import { E2EEStatusIndicator } from '@/lib/E2EEStatusIndicator';
import { createE2EEMessageDecoder, createE2EEMessageEncoder } from '@/lib/e2eeChatCodec';

export function VideoConferenceClientImpl(props: {
  liveKitUrl: string;
  token: string;
  codec: VideoCodec | undefined;
}) {
  const keyProvider = useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [room, setRoom] = useState<Room | null>(null);
  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  // Set up E2EE and create room
  useEffect(() => {
    let cancelled = false;

    const setupRoomWithE2EE = async () => {
      try {
        // Step 1: Set the key BEFORE creating the room
        if (e2eeEnabled) {
          console.log('E2EE Setup (Custom): Starting encryption setup');
          console.log('E2EE Setup (Custom): Passphrase length:', e2eePassphrase?.length);
          console.log('E2EE Setup (Custom): Worker available:', !!worker);
          
          await keyProvider.setKey(e2eePassphrase);
          console.log('E2EE Setup (Custom): Key set successfully on keyProvider');
        } else {
          console.log('E2EE Setup (Custom): E2EE disabled (no passphrase or worker)');
        }

        if (cancelled) return;

        // Step 2: Create room options with E2EE config
        const roomOptions: RoomOptions = {
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

        // Step 3: Create the room with keyProvider that already has the key
        const newRoom = new Room(roomOptions);
        
        if (cancelled) {
          newRoom.disconnect();
          return;
        }

        if (e2eeEnabled) {
          // Enable E2EE before connecting
          await newRoom.setE2EEEnabled(true);
          console.log('E2EE Setup (Custom): Room created with E2EE');
          console.log('E2EE Setup (Custom): E2EE enabled successfully');
          console.log('E2EE Setup (Custom): room.isE2EEEnabled =', newRoom.isE2EEEnabled);
          toast.success('🔒 End-to-end encryption enabled', {
            duration: 3000,
            position: 'top-center',
          });
        }

        setRoom(newRoom);
        setE2eeSetupComplete(true);
      } catch (e) {
        if (cancelled) return;
        
        console.error('E2EE setup error:', e);
        toast.error(
          'End-to-end encryption could not be enabled. Joining without encryption.',
          {
            duration: 6000,
            position: 'top-center',
          }
        );

        // Create room without E2EE
        const roomOptions: RoomOptions = {
          publishDefaults: {
            videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
            red: true,
            videoCodec: props.codec,
          },
          adaptiveStream: { pixelDensity: 'screen' },
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
  }, [e2eeEnabled, e2eePassphrase, keyProvider, worker, props.codec]);

  // Event listeners for errors
  useEffect(() => {
    if (!room) return;

    const handleError = (error: Error) => {
      console.error('Room error:', error);
      toast.error(`Error: ${error.message}`, {
        duration: 5000,
        position: 'top-center',
      });
    };

    room.on(RoomEvent.MediaDevicesError, handleError);

    return () => {
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [room]);

  // Connection logic with one-time guard to prevent redundant reconnects
  const hasConnectedRef = useRef(false);
  useEffect(() => {
    if (!room || !e2eeSetupComplete || hasConnectedRef.current) return;

    hasConnectedRef.current = true;
    room
      .connect(props.liveKitUrl, props.token, connectOptions)
      .then(() => room.localParticipant.enableCameraAndMicrophone())
      .then(async () => {
        // Reassert E2EE key after connection to ensure worker picks up keys for local participant
        if (e2eeEnabled) {
          try {
            await keyProvider.setKey(e2eePassphrase);
          } catch (err) {
            console.error('Encryption error after connect:', err);
          }
        }
      })
      .catch((error) => {
        console.error('Connection/Media error:', error);
        toast.error(`Failed to connect: ${error.message}`, {
          duration: 5000,
          position: 'top-center',
        });
      });
  }, [room, e2eeSetupComplete, connectOptions, props.liveKitUrl, props.token, e2eeEnabled, keyProvider, e2eePassphrase]);

  // Cleanup - let LiveKit handle track cleanup automatically
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  useLowCPUOptimizer(room);

  // Show loading state while room is being created
  if (!room) {
    return (
      <div className="lk-room-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Setting up encrypted connection...</div>
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
          SettingsComponent={
            process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
          }
        />
        <RoomAudioRenderer />
        <DebugMode logLevel={LogLevel.debug} />
      </RoomContext.Provider>
    </div>
  );
}


