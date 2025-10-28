import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Returns a deterministic daily E2EE passphrase derived from a secret salt and the current date.
// The key rotates at UTC midnight to keep all users in sync without manual sharing.

function getUTCDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function getNextUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
}

function deriveDailyKey(dateStr: string, salt: string): string {
  // 32-byte hex string derived via HMAC-SHA256(dateStr, salt)
  const hmac = crypto.createHmac('sha256', salt);
  hmac.update(dateStr);
  return hmac.digest('hex');
}

export async function GET() {
  const now = new Date();
  const salt = process.env.E2EE_DAILY_SALT || process.env.LIVEKIT_API_SECRET || 'default-salt';

  const dateStr = getUTCDateString(now);
  const passphrase = deriveDailyKey(dateStr, salt);
  const validUntil = getNextUtcMidnight(now);

  return NextResponse.json({
    passphrase,
    scope: 'daily',
    timezone: 'UTC',
    validUntilISO: validUntil.toISOString(),
    date: dateStr,
  });
}


