import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import '../styles/modern-theme.css';
import type { Metadata, Viewport } from 'next';
import { ToasterProvider } from './ToasterProvider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Ruha Meetup',
    template: '%s',
  },
  description: 'Single-room video meetup. Welcome to the Ruha Meetup.',
  twitter: {
    creator: '@livekitted',
    site: '@livekitted',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://example.com',
    images: [
      {
        url: '/images/ruha-logo.jpg',
        width: 192,
        height: 192,
        type: 'image/jpeg',
      },
    ],
    siteName: 'Ruha Meetup',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/images/ruha-logo.jpg',
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Allow zoom for accessibility
  userScalable: true, // Allow users to zoom
  viewportFit: 'cover', // For iPhone notch/safe areas
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
