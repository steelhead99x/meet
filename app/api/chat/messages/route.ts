import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory, saveChatMessage } from '@/lib/db';

// GET: Fetch chat history for a room
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomName = searchParams.get('roomName');
    const limitParam = searchParams.get('limit');
    const beforeTimestampParam = searchParams.get('beforeTimestamp');

    if (!roomName) {
      return NextResponse.json(
        { error: 'roomName is required' },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    const beforeTimestamp = beforeTimestampParam
      ? parseInt(beforeTimestampParam, 10)
      : undefined;

    const messages = getChatHistory(roomName, limit, beforeTimestamp);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}

// POST: Save a new chat message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, participantIdentity, message, timestamp } = body;

    if (!roomName || !participantIdentity || !message || timestamp === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, participantIdentity, message, timestamp' },
        { status: 400 }
      );
    }

    const savedMessage = saveChatMessage(
      roomName,
      participantIdentity,
      message,
      timestamp
    );

    return NextResponse.json({ message: savedMessage });
  } catch (error) {
    console.error('Error saving chat message:', error);
    return NextResponse.json(
      { error: 'Failed to save chat message' },
      { status: 500 }
    );
  }
}

