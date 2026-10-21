import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { GameStateForClient, LobbyState, RoomPlayer, SongFull } from '@tuneline/shared';
import { REVEAL_DURATION_MS } from '@tuneline/shared';
import { useSocketEvents } from './useSocketEvents';
import {
  emittedPayloads,
  managerEmit,
  serverEmit,
  serverEmitBatch,
  socket,
} from '../test/fakeSocket';
import { STORAGE_KEYS } from '../constants';
import { readLastRoom, saveLastRoom } from '../utils/roomStorage';
import { isAuthenticated } from '../api/spotify';

vi.mock('../api/spotify', () => ({ isAuthenticated: vi.fn(async () => false) }));

const startSong = vi.fn();
const stopSong = vi.fn();
const showError = vi.fn();

const player = (id: string, overrides: Partial<RoomPlayer> = {}): RoomPlayer => ({
  id,
  name: id,
  isHost: id === 'host',
  isConnected: true,
  score: 0,
  timeline: [],
  ...overrides,
});
const lobby = (overrides: Partial<LobbyState> = {}): LobbyState => ({
  roomCode: 'ROOM01',
  players: [player('host'), player('me')],
  rounds: 5,
  audioMode: 'all',
  turnLimit: 0,
  status: 'lobby',
  ...overrides,
});
const state = (overrides: Partial<GameStateForClient> = {}): GameStateForClient => ({
  players: [player('host'), player('me')],
  currentPlayerId: 'me',
  round: 1,
  rounds: 5,
  audioMode: 'all',
  deckRemaining: 10,
  turnEndsInMs: null,
  ...overrides,
});
const clip = (n = 1) => ({ preview: `https://audio/${n}.m4a` });
const full = (year: number): SongFull => ({
  id: `s${year}`,
  title: 'T',
  artist: 'A',
  cover: null,
  preview: 'p',
  year,
});

function setup() {
  return renderHook(() => useSocketEvents({ startSong, stopSong, showError }));
}

/** Joins as "me" and starts a game where "me" is on turn. */
function inGame(gameOverrides: Partial<GameStateForClient> = {}) {
  const hook = setup();
  serverEmit('room_joined', { playerId: 'me', playerToken: 'tok', room: lobby() });
  serverEmit('game_started', { gameState: state(gameOverrides), currentSong: clip(1) });
  return hook;
}

beforeEach(() => {
  startSong.mockReset();
  stopSong.mockReset();
  showError.mockReset();
  vi.mocked(isAuthenticated).mockResolvedValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('joining', () => {
  it('remembers a created room as host', () => {
    const { result } = setup();
    serverEmit('room_created', { roomCode: 'ROOM01', playerId: 'host', playerToken: 'tok' });
    expect(result.current).toMatchObject({ roomCode: 'ROOM01', myPlayerId: 'host', isHost: true });
    expect(sessionStorage.getItem(STORAGE_KEYS.playerToken)).toBe('tok');
  });

  it('takes over the room settings and opens the lobby', () => {
    const { result } = setup();
    serverEmit('room_joined', {
      playerId: 'host',
      playerToken: 'tok',
      room: lobby({ rounds: 10, audioMode: 'host-only', turnLimit: 30 }),
    });
    expect(result.current).toMatchObject({
      screen: 'lobby',
      isHost: true,
      rounds: 10,
      audioMode: 'host-only',
      turnLimit: 30,
      roomCode: 'ROOM01',
    });
    expect(readLastRoom()).toMatchObject({
      roomCode: 'ROOM01',
      playerToken: 'tok',
      playerName: 'host',
    });
  });

  it('waits for the game state when joining a running game', () => {
    const { result } = setup();
    serverEmit('room_joined', {
      playerId: 'me',
      playerToken: 'tok',
      room: lobby({ status: 'playing' }),
    });
    expect(result.current.screen).toBe('login');
  });

  it('lets the host hear the song when the resume arrives right after the rejoin', () => {
    setup();
    serverEmitBatch([
      [
        'room_joined',
        {
          playerId: 'host',
          playerToken: 'tok',
          room: lobby({ status: 'playing', audioMode: 'host-only' }),
        },
      ],
      ['game_resumed', { gameState: state({ audioMode: 'host-only' }), currentSong: clip(5) }],
    ]);
    expect(startSong).toHaveBeenCalledWith('https://audio/5.m4a');
  });

  it('keeps the host in the playlist picker or a song load when a reconnect lands', () => {
    const { result } = setup();
    const rejoined = () =>
      serverEmit('room_joined', { playerId: 'host', playerToken: 'tok', room: lobby() });
    rejoined();
    act(() => result.current.setScreen('playlists'));
    rejoined();
    expect(result.current.screen).toBe('playlists');
    act(() => result.current.setScreen('loading'));
    rejoined();
    expect(result.current.screen).toBe('loading');
    act(() => result.current.setScreen('result'));
    rejoined();
    expect(result.current.screen).toBe('lobby');
  });

  it('rejoins automatically after a reconnect, but only with a stored seat', () => {
    setup();
    managerEmit('reconnect');
    expect(emittedPayloads('rejoin_room')).toEqual([]);
    sessionStorage.setItem(STORAGE_KEYS.roomCode, 'ROOM01');
    sessionStorage.setItem(STORAGE_KEYS.playerToken, 'tok');
    managerEmit('reconnect');
    expect(emittedPayloads('rejoin_room')).toEqual([{ roomCode: 'ROOM01', playerToken: 'tok' }]);
  });
});

describe('lobby updates', () => {
  it('returns from game or result to the lobby but never interrupts other screens', () => {
    const { result } = inGame();
    serverEmit('room_updated', { room: lobby({ rounds: 15 }) });
    expect(result.current.screen).toBe('lobby');
    expect(result.current.rounds).toBe(15);

    act(() => result.current.setScreen('playlists'));
    serverEmit('room_updated', { room: lobby() });
    expect(result.current.screen).toBe('playlists');

    serverEmit('room_updated', { room: lobby({ status: 'playing' }) });
    expect(result.current.screen).toBe('playlists');
  });

  it('shows and cancels the loading screen', () => {
    const { result } = setup();
    act(() => result.current.setScreen('lobby'));
    serverEmit('game_loading');
    expect(result.current).toMatchObject({ screen: 'loading', loadingMsg: 'Host lädt Songs…' });
    serverEmit('game_loading_cancelled');
    expect(result.current.screen).toBe('lobby');
    serverEmit('game_loading_cancelled');
    expect(result.current.screen).toBe('lobby');
  });
});

describe('turns', () => {
  it('starts the game, plays the song and remembers dealt cards', () => {
    const { result } = setup();
    serverEmit('room_joined', { playerId: 'me', playerToken: 'tok', room: lobby() });
    serverEmit('game_started', {
      gameState: state({ players: [player('host', { timeline: [full(1970)] }), player('me')] }),
      currentSong: clip(1),
    });
    expect(result.current.screen).toBe('game');
    expect(startSong).toHaveBeenCalledWith('https://audio/1.m4a');
    expect(result.current.getPlayedSongIds()).toEqual(['s1970']);
  });

  it('keeps guests silent in host-only mode and tells the host about fewer rounds', () => {
    const guest = setup();
    serverEmit('room_joined', { playerId: 'me', playerToken: 'tok', room: lobby() });
    serverEmit('game_started', {
      gameState: state({ audioMode: 'host-only' }),
      currentSong: clip(),
    });
    expect(startSong).not.toHaveBeenCalled();
    guest.unmount();

    setup();
    serverEmit('room_created', { roomCode: 'ROOM01', playerId: 'host', playerToken: 'tok' });
    serverEmit('game_started', { gameState: state({ rounds: 2 }), currentSong: clip() });
    expect(showError).toHaveBeenCalledWith('Nicht genug Songs für 5 Runden – ihr spielt 2.');
    expect(startSong).toHaveBeenCalled();
  });

  it('places a song and blocks double submits until the answer', () => {
    const { result } = inGame();
    act(() => result.current.placeSong(1));
    expect(result.current.placing).toBe(true);
    expect(emittedPayloads('place_song')).toEqual([{ position: 1 }]);
    serverEmit('error', { message: 'Nope' });
    expect(result.current.placing).toBe(false);
    expect(showError).toHaveBeenCalledWith('Nope');
  });

  it('reveals the result, then moves on to the next song', () => {
    vi.useFakeTimers();
    const { result } = inGame();
    serverEmit('placement_result', {
      correct: true,
      timedOut: false,
      song: full(1985),
      gameState: state({ currentPlayerId: 'host', turnEndsInMs: 33_000 }),
      nextSong: clip(2),
    });
    expect(result.current).toMatchObject({
      revealed: true,
      feedback: 'ok',
      lastPlacedPlayerId: 'me',
    });
    expect(result.current.turnEndsAt).toBe(Date.now() + 33_000);
    expect(result.current.getPlayedSongIds()).toContain('s1985');

    act(() => vi.advanceTimersByTime(REVEAL_DURATION_MS));
    expect(result.current).toMatchObject({ revealed: false, feedback: null, currentSong: clip(2) });
    expect(startSong).toHaveBeenLastCalledWith('https://audio/2.m4a');
  });

  it('labels misses and timeouts', () => {
    const { result } = inGame();
    const miss = { song: full(1985), gameState: state(), nextSong: null };
    serverEmit('placement_result', { ...miss, correct: false, timedOut: false });
    expect(result.current.feedback).toBe('no');
    serverEmit('placement_result', { ...miss, correct: false, timedOut: true });
    expect(result.current.feedback).toBe('timeout');
  });

  it('holds a pause back until the reveal is over', () => {
    vi.useFakeTimers();
    const { result } = inGame();
    serverEmit('placement_result', {
      correct: true,
      timedOut: false,
      song: full(1985),
      gameState: state({ currentPlayerId: 'host' }),
      nextSong: clip(2),
    });
    serverEmit('game_paused', {
      disconnectedPlayerId: 'host',
      disconnectedPlayerName: 'host',
      isHostDisconnected: true,
      gameState: state({ currentPlayerId: 'host' }),
      currentSong: clip(2),
    });
    expect(result.current.revealed).toBe(true);
    expect(result.current.disconnectedPlayer).toBeNull();

    startSong.mockReset();
    act(() => vi.advanceTimersByTime(REVEAL_DURATION_MS));
    expect(result.current.disconnectedPlayer).toEqual({
      id: 'host',
      name: 'host',
      isHostDisconnected: true,
    });
    expect(result.current.revealed).toBe(false);
    expect(startSong).not.toHaveBeenCalled();
  });

  it('pauses right away outside a reveal and resumes with music', () => {
    const { result } = inGame();
    serverEmit('game_paused', {
      disconnectedPlayerId: 'host',
      disconnectedPlayerName: 'host',
      isHostDisconnected: false,
      gameState: state(),
      currentSong: clip(3),
    });
    expect(result.current.disconnectedPlayer?.id).toBe('host');
    expect(stopSong).toHaveBeenCalled();

    serverEmit('game_resumed', {
      gameState: state({ turnEndsInMs: 30_000 }),
      currentSong: clip(3),
    });
    expect(result.current.disconnectedPlayer).toBeNull();
    expect(result.current.turnEndsAt).not.toBeNull();
    expect(startSong).toHaveBeenLastCalledWith('https://audio/3.m4a');
  });

  it('updates players without touching the turn', () => {
    const { result } = inGame();
    serverEmit('game_state_updated', {
      gameState: state({ players: [player('host', { isConnected: false })] }),
    });
    expect(result.current.gameState?.players[0].isConnected).toBe(false);
    expect(result.current.screen).toBe('game');
  });
});

describe('game over', () => {
  const players = [player('host', { score: 2 }), player('me')];

  it('reveals the last placement before the result', () => {
    vi.useFakeTimers();
    const { result } = inGame();
    serverEmit('game_over', {
      players,
      lastSong: full(1999),
      lastCorrect: false,
      lastPlayerId: 'me',
      winnerLastSong: null,
    });
    expect(result.current).toMatchObject({ screen: 'game', revealed: true, feedback: 'no' });
    act(() => vi.advanceTimersByTime(REVEAL_DURATION_MS));
    expect(result.current.screen).toBe('result');
    expect(result.current.result).toMatchObject({ lastPlayerId: 'me', players });
    expect(result.current.getPlayedSongIds()).toContain('s1999');
  });

  it('says time ran out when the final turn timed out', () => {
    const { result } = inGame();
    serverEmit('game_over', {
      players,
      lastSong: full(1999),
      lastCorrect: false,
      lastTimedOut: true,
      lastPlayerId: 'me',
      winnerLastSong: null,
    });
    expect(result.current.feedback).toBe('timeout');
  });

  it('reports at most as many played songs as the server accepts, newest last', () => {
    const { result } = setup();
    serverEmit('room_joined', { playerId: 'me', playerToken: 'tok', room: lobby() });
    const many = Array.from({ length: 1005 }, (_, i) => ({ ...full(1990), id: `x${i}` }));
    serverEmit('game_started', {
      gameState: state({ players: [player('host', { timeline: many }), player('me')] }),
      currentSong: clip(),
    });
    const ids = result.current.getPlayedSongIds();
    expect(ids).toHaveLength(1000);
    expect(ids.at(-1)).toBe('x1004');
  });

  it('shows the result directly without a last placement', () => {
    const { result } = inGame();
    serverEmit('game_over', {
      players,
      lastSong: null,
      lastCorrect: true,
      lastPlayerId: '',
      winnerLastSong: undefined,
    });
    expect(result.current.screen).toBe('result');
    expect(result.current.result?.winnerLastSong).toBeNull();
  });
});

describe('leaving the room', () => {
  const seatStored = () => {
    sessionStorage.setItem(STORAGE_KEYS.roomCode, 'ROOM01');
    sessionStorage.setItem(STORAGE_KEYS.playerToken, 'tok');
    saveLastRoom({ roomCode: 'ROOM01', playerToken: 'tok', playerName: 'me' });
  };

  it.each([
    ['rejoin_failed', 'Der Raum existiert nicht mehr.'],
    ['room_closed', 'Der Host hat den Raum geschlossen.'],
    ['player_kicked', 'Du wurdest aus dem Raum entfernt.'],
  ])('%s forgets the seat and returns to the start', async (event, message) => {
    const { result } = inGame();
    seatStored();
    socket.connected = true;
    serverEmit(event, { playerId: 'me' });
    expect(showError).toHaveBeenCalledWith(message);
    expect(socket.connected).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEYS.playerToken)).toBeNull();
    expect(readLastRoom()).toBeNull();
    expect(result.current.roomCode).toBe('');
    await waitFor(() => expect(result.current.screen).toBe('login'));
  });

  it('keeps the saved room for the tab that took over and sends logged-in users to playlists', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const { result } = inGame();
    seatStored();
    serverEmit('session_replaced');
    expect(showError).toHaveBeenCalledWith('Du spielst jetzt in einem anderen Tab weiter.');
    expect(sessionStorage.getItem(STORAGE_KEYS.playerToken)).toBeNull();
    expect(readLastRoom()).toMatchObject({ playerToken: 'tok' });
    await waitFor(() => expect(result.current.screen).toBe('playlists'));
  });

  it('exits for good, telling the server only while connected', () => {
    const { result } = inGame();
    seatStored();
    socket.connected = true;
    act(() => result.current.exitRoom());
    expect(emittedPayloads('leave_room')).toHaveLength(1);
    expect(stopSong).toHaveBeenCalled();
    expect(socket.connected).toBe(false);
    expect(readLastRoom()).toBeNull();
    expect(result.current.roomCode).toBe('');

    act(() => result.current.exitRoom());
    expect(emittedPayloads('leave_room')).toHaveLength(1);
  });

  it('warns before a server restart and resets on request', () => {
    const { result } = inGame();
    serverEmit('server_restarting');
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Server startet neu'));
    act(() => result.current.resetRoom());
    expect(result.current).toMatchObject({ roomCode: '', gameState: null, isHost: false });
    expect(result.current.getPlayedSongIds()).toEqual([]);
  });
});
