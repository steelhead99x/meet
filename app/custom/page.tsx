import { videoCodecs, type VideoCodec } from 'livekit-client';
import { VideoConferenceClientImpl } from './VideoConferenceClientImpl';
import { isVideoCodec } from '@/lib/types';
import { RoomErrorBoundary } from '@/app/ErrorBoundary';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default async function CustomRoomConnection(props: {
  searchParams: Promise<{
    liveKitUrl?: string;
    token?: string;
    codec?: string;
  }>;
}) {
  const { liveKitUrl, token, codec } = await props.searchParams;
  if (typeof liveKitUrl !== 'string') {
    return <h2>Missing LiveKit URL</h2>;
  }
  if (typeof token !== 'string') {
    return <h2>Missing LiveKit token</h2>;
  }
  if (codec !== undefined && !isVideoCodec(codec)) {
    return <h2>Invalid codec, if defined it has to be [{videoCodecs.join(', ')}].</h2>;
  }

  // After validation, codec is either undefined or a valid VideoCodec
  const validatedCodec = codec as VideoCodec | undefined;

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      <RoomErrorBoundary>
        <VideoConferenceClientImpl liveKitUrl={liveKitUrl} token={token} codec={validatedCodec} />
      </RoomErrorBoundary>
    </main>
  );
}


