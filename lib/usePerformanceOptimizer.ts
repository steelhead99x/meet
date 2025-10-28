import {
  Room,
  ParticipantEvent,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  VideoQuality,
  LocalVideoTrack,
  isVideoTrack,
} from 'livekit-client';
import * as React from 'react';

export type LowCPUOptimizerOptions = {
  reducePublisherVideoQuality: boolean;
  reduceSubscriberVideoQuality: boolean;
  disableVideoProcessing: boolean;
};

const defaultOptions: LowCPUOptimizerOptions = {
  reducePublisherVideoQuality: true,
  reduceSubscriberVideoQuality: true,
  disableVideoProcessing: false,
} as const;

/**
 * Optimizes room performance on low-power devices by reducing video quality
 * when CPU constraints are detected.
 * 
 * This hook monitors CPU usage and automatically adjusts video quality settings
 * when the device is under CPU stress. It can reduce both published and subscribed
 * video quality, and optionally disable video processing.
 * 
 * @param room - The LiveKit Room instance to optimize
 * @param options - Configuration options for optimization behavior
 * @param options.reducePublisherVideoQuality - Reduce outgoing video quality (default: true)
 * @param options.reduceSubscriberVideoQuality - Reduce incoming video quality (default: true)
 * @param options.disableVideoProcessing - Disable video processors like background blur (default: false)
 * @returns Boolean indicating if low power mode is currently active
 * 
 * @example
 * ```tsx
 * const lowPowerMode = useLowCPUOptimizer(room, {
 *   reducePublisherVideoQuality: true,
 *   reduceSubscriberVideoQuality: true,
 *   disableVideoProcessing: true,
 * });
 * 
 * if (lowPowerMode) {
 *   // Show notification to user
 * }
 * ```
 */
export function useLowCPUOptimizer(room: Room, options: Partial<LowCPUOptimizerOptions> = {}): boolean {
  const [lowPowerMode, setLowPowerMode] = React.useState(false);
  const opts = React.useMemo(() => ({ ...defaultOptions, ...options }), [options]);
  React.useEffect(() => {
    const handleCpuConstrained = async (track: LocalVideoTrack) => {
      setLowPowerMode(true);
      console.warn('Local track CPU constrained', track);
      if (opts.reducePublisherVideoQuality) {
        track.prioritizePerformance();
      }
      if (opts.disableVideoProcessing && isVideoTrack(track)) {
        track.stopProcessor();
      }
      if (opts.reduceSubscriberVideoQuality) {
        room.remoteParticipants.forEach((participant) => {
          participant.videoTrackPublications.forEach((publication) => {
            publication.setVideoQuality(VideoQuality.LOW);
          });
        });
      }
    };

    room.localParticipant.on(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstrained);
    return () => {
      room.localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstrained);
    };
  }, [room, opts.reducePublisherVideoQuality, opts.reduceSubscriberVideoQuality]);

  React.useEffect(() => {
    const lowerQuality = (_: RemoteTrack, publication: RemoteTrackPublication) => {
      publication.setVideoQuality(VideoQuality.LOW);
    };
    if (lowPowerMode && opts.reduceSubscriberVideoQuality) {
      room.on(RoomEvent.TrackSubscribed, lowerQuality);
    }

    return () => {
      room.off(RoomEvent.TrackSubscribed, lowerQuality);
    };
  }, [lowPowerMode, room, opts.reduceSubscriberVideoQuality]);

  return lowPowerMode;
}
