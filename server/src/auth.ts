import { randomBytes } from 'crypto';

export const SESSION_COOKIE = 'tuneline_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();

export function createSession(data: SessionData): string {
  const id = randomBytes(32).toString('hex');
  sessions.set(id, data);
  return id;
}

export function getSession(id: string): SessionData | null {
  return sessions.get(id) ?? null;
}

export function updateSession(id: string, data: SessionData): void {
  sessions.set(id, data);
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}
