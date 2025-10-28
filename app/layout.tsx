import '../styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { ToasterProvider } from './ToasterProvider';
import { StylesProvider } from './StylesProvider';

export const metadata: Metadata = {
  title: {
    default: 'LiveKit Meet | Conference app build with LiveKit open source',
    template: '%s',
  },
  description:
    'LiveKit is an open source WebRTC project that gives you everything needed to build scalable and real-time audio and/or video experiences in your applications.',
  twitter: {
    creator: '@livekitted',
    site: '@livekitted',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://meet.livekit.io',
    images: [
      {
        url: 'https://meet.livekit.io/images/livekit-meet-open-graph.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
    siteName: 'LiveKit Meet',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/images/livekit-apple-touch.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <StylesProvider>
          <ToasterProvider />
          {children}
        </StylesProvider>
      </body>
    </html>
  );
}
