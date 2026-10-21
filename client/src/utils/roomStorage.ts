import { STORAGE_KEYS } from '../constants';

/** The room this browser last played in; survives closing the tab (unlike sessionStorage). */
export interface LastRoom {
  roomCode: string;
  playerToken: string;
  playerName: string;
  savedAt: number;
}

// Matches the server's room TTL; older rooms are gone anyway.
const LAST_ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** This tab's seat — used for the automatic rejoin after a reload. */
export function storeSessionRoom(roomCode: string, playerToken: string): void {
  sessionStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
  sessionStorage.setItem(STORAGE_KEYS.playerToken, playerToken);
}

export function clearSessionRoom(): void {
  sessionStorage.removeItem(STORAGE_KEYS.playerToken);
  sessionStorage.removeItem(STORAGE_KEYS.roomCode);
}

export function saveLastRoom(room: Omit<LastRoom, 'savedAt'>): void {
  localStorage.setItem(STORAGE_KEYS.lastRoom, JSON.stringify({ ...room, savedAt: Date.now() }));
}

export function readLastRoom(): LastRoom | null {
  try {
    const room = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.lastRoom) ?? 'null'
    ) as LastRoom | null;
    return room && Date.now() - room.savedAt < LAST_ROOM_MAX_AGE_MS ? room : null;
  } catch {
    return null;
  }
}

export function discardLastRoom(): void {
  localStorage.removeItem(STORAGE_KEYS.lastRoom);
}

/** Forget this tab's room for good: no rejoin on reload and no "back to game" offer. */
export function clearStoredRoom(): void {
  const token = sessionStorage.getItem(STORAGE_KEYS.playerToken);
  // Another tab may have saved a different room since; only drop our own.
  if (token && readLastRoom()?.playerToken === token) discardLastRoom();
  clearSessionRoom();
}
