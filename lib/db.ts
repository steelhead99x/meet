import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chat.db');

// Singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    try {
      db = new Database(dbPath);
      
      // Enable WAL mode for better concurrency
      db.pragma('journal_mode = WAL');
      
      // Create chat_messages table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_name TEXT NOT NULL,
          participant_identity TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
      `);
      
      // Create index separately to avoid errors if it already exists
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_room_timestamp ON chat_messages(room_name, timestamp)`);
      } catch (indexError) {
        // Index might already exist, ignore
        console.warn('Index creation warning (may already exist):', indexError);
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
  
  return db;
}

export interface ChatMessage {
  id: number;
  room_name: string;
  participant_identity: string;
  message: string;
  timestamp: number;
  created_at: number;
}

export function saveChatMessage(
  roomName: string,
  participantIdentity: string,
  message: string,
  timestamp: number
): ChatMessage {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO chat_messages (room_name, participant_identity, message, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(roomName, participantIdentity, message, timestamp);
  
  return {
    id: result.lastInsertRowid as number,
    room_name: roomName,
    participant_identity: participantIdentity,
    message,
    timestamp,
    created_at: Date.now() / 1000,
  };
}

export function getChatHistory(
  roomName: string,
  limit: number = 100,
  beforeTimestamp?: number
): ChatMessage[] {
  const db = getDb();
  
  let query = `
    SELECT id, room_name, participant_identity, message, timestamp, created_at
    FROM chat_messages
    WHERE room_name = ?
  `;
  
  const params: any[] = [roomName];
  
  if (beforeTimestamp !== undefined) {
    query += ' AND timestamp < ?';
    params.push(beforeTimestamp);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  
  // Reverse to get chronological order (oldest first)
  return rows.reverse().map((row) => ({
    id: row.id,
    room_name: row.room_name,
    participant_identity: row.participant_identity,
    message: row.message,
    timestamp: row.timestamp,
    created_at: row.created_at,
  }));
}

