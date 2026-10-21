import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import {
  clearSessionRoom,
  clearStoredRoom,
  discardLastRoom,
  readLastRoom,
  saveLastRoom,
  storeSessionRoom,
} from './roomStorage';

const seat = { roomCode: 'ABC123', playerToken: 'tok', playerName: 'Anna' };

describe('session room', () => {
  it('stores and clears this tab’s seat', () => {
    storeSessionRoom('ABC123', 'tok');
    expect(sessionStorage.getItem(STORAGE_KEYS.roomCode)).toBe('ABC123');
    expect(sessionStorage.getItem(STORAGE_KEYS.playerToken)).toBe('tok');
    clearSessionRoom();
    expect(sessionStorage.length).toBe(0);
  });
});

describe('last room', () => {
  it('round-trips with a timestamp', () => {
    saveLastRoom(seat);
    expect(readLastRoom()).toEqual({ ...seat, savedAt: expect.any(Number) });
    discardLastRoom();
    expect(readLastRoom()).toBeNull();
  });

  it('ignores entries older than two hours and corrupt data', () => {
    vi.useFakeTimers();
    saveLastRoom(seat);
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(readLastRoom()).toBeNull();

    localStorage.setItem(STORAGE_KEYS.lastRoom, '{oops');
    expect(readLastRoom()).toBeNull();
  });
});

describe('clearStoredRoom', () => {
  it('drops this tab’s seat and its own saved room', () => {
    storeSessionRoom('ABC123', 'tok');
    saveLastRoom(seat);
    clearStoredRoom();
    expect(sessionStorage.length).toBe(0);
    expect(readLastRoom()).toBeNull();
  });

  it('keeps a room another tab saved since', () => {
    storeSessionRoom('ABC123', 'tok');
    saveLastRoom({ ...seat, playerToken: 'other-tab' });
    clearStoredRoom();
    expect(readLastRoom()).toMatchObject({ playerToken: 'other-tab' });
  });
});
