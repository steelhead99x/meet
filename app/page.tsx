'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
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
          <img src="/images/ruha-logo.jpg" alt="Ruha logo" style={{ width: 96, height: 96, borderRadius: 16, objectFit: 'cover' }} />
          <h1 className={styles.title}>Ruha Meetup</h1>
          <p className={styles.subtitle}>Welcome to the Ruha Meetup room.</p>
        </div>

        <div className={styles.content}>
          <button className={`lk-button ${styles.startButton}`} onClick={startMeeting}>
            Start Meeting
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

