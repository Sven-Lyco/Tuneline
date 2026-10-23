import { randomBytes } from 'crypto';
import { forgetSession } from './playlistCache.js';

export const SESSION_COOKIE = 'tuneline_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  /** The host's Spotify user id, to tell own playlists from followed ones; unknown if /me failed. */
  userId?: string;
}

const sessions = new Map<string, { data: SessionData; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) deleteSession(id);
  }
}, SWEEP_INTERVAL_MS).unref();

export function createSession(data: SessionData): string {
  const id = randomBytes(32).toString('hex');
  sessions.set(id, { data, expiresAt: Date.now() + SESSION_MAX_AGE_MS });
  return id;
}

export function getSession(id: string): SessionData | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    deleteSession(id);
    return null;
  }
  return session.data;
}

export function updateSession(id: string, data: SessionData): void {
  const session = sessions.get(id);
  if (session) session.data = data;
}

/** Also drops the host's cached Spotify data (the terms want it gone on disconnect). */
export function deleteSession(id: string): void {
  sessions.delete(id);
  forgetSession(id);
}
