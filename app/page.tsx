'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import Image from 'next/image';
import styles from '../styles/Home.module.css';
// Single-room app: always join the Ruha Meetup room
const RUHA_ROOM_NAME = 'Ruha Meetup';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default function Page() {
  const router = useRouter();

  const startMeeting = () => {
    router.push(`/rooms/${encodeURIComponent(RUHA_ROOM_NAME)}`);
  };

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <div className={styles.header}>
          <Image src="/images/ruha-logo.jpg" alt="Ruha logo" width={96} height={96} style={{ borderRadius: 16, objectFit: 'cover' }} />
          <h1 className={styles.title}>Ruha Meetup</h1>
          <p className={styles.subtitle}>Welcome to the Ruha Meetup room.</p>
        </div>

        <div className={styles.content}>
          <button 
            className={`lk-button ${styles.startButton}`} 
            onClick={startMeeting}
            aria-label="Start Meeting"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              minWidth: '80px',
              minHeight: '80px',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M15 10L19.553 7.724C19.7054 7.64822 19.8747 7.61339 20.0441 7.62295C20.2136 7.63251 20.3773 7.68606 20.5193 7.77828C20.6614 7.8705 20.7769 7.99837 20.8549 8.14917C20.933 8.29997 20.9708 8.46865 20.965 8.639V15.361C20.9708 15.5313 20.933 15.7 20.8549 15.8508C20.7769 16.0016 20.6614 16.1295 20.5193 16.2217C20.3773 16.3139 20.2136 16.3675 20.0441 16.377C19.8747 16.3866 19.7054 16.3518 19.553 16.276L15 14V10Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>

        </div>
      </main>
      <footer className={styles.footer} data-lk-theme="default" suppressHydrationWarning>
        <a href="https://artist-space.com" rel="noopener" target="_blank">
          artist-space.com
        </a>
      </footer>
    </>
  );
}

