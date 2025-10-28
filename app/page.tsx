'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default function Page() {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState('');
  
  // Generate passphrase on client side only to avoid hydration mismatch
  useEffect(() => {
    setSharedPassphrase(randomString(64));
  }, []);
  
  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <div className={styles.header}>
          <h1 className={styles.title}>🎵 Artist-Space Meet</h1>
          <p className={styles.subtitle}>
            Welcome to Artist-Space Meet. Chat for free with your band members with E2E video and chat.
          </p>
        </div>

        <div className={styles.content}>
          <button className={`lk-button ${styles.startButton}`} onClick={startMeeting}>
            Start Meeting
          </button>
          
          <div className={styles.options}>
            <div className={styles.option}>
              <input
                id="use-e2ee"
                type="checkbox"
                checked={e2ee}
                onChange={(ev) => setE2ee(ev.target.checked)}
              />
              <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
            </div>
            
            {e2ee && (
              <div className={styles.passphraseContainer}>
                <label htmlFor="passphrase">Passphrase:</label>
                <input
                  id="passphrase"
                  type="password"
                  value={sharedPassphrase}
                  onChange={(ev) => setSharedPassphrase(ev.target.value)}
                  className={styles.passphraseInput}
                />
              </div>
            )}
          </div>
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

