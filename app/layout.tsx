import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import '../styles/modern-theme.css';
import '../styles/hide-videoconference-chat.css';
import type { Metadata, Viewport } from 'next';
import { ToasterProvider } from './ToasterProvider';

export const metadata: Metadata = {
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
    icon: '/favicon.ico',
    apple: '/images/ruha-logo.jpg',
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
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
