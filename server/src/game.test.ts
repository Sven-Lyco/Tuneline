import { describe, expect, it } from 'vitest';
import type { SongFull } from '@tuneline/shared';
import {
  finishGame,
  pausedPlayerId,
  placeSong,
  returnToLobby,
  seatPlayer,
  skipDisconnectedPlayer,
  startGame,
  timeoutTurn,
} from './game.js';
import { MAX_SONGS } from './types.js';
import { PREVIEW, playingRoom, room, song, songs } from './test/fixtures.js';

describe('startGame', () => {
  it('rejects too few, too many or malformed songs and bad audio modes', () => {
    const r = room(['a', 'b']);
    expect(startGame(r, [song(1990)], 5, 'all')).toEqual({ ok: false, error: 'Zu wenige Songs (min. 2).' });
    expect(startGame(r, null as unknown as SongFull[], 5, 'all').ok).toBe(false);
    expect(startGame(r, songs(MAX_SONGS + 1), 5, 'all').ok).toBe(false);
    expect(startGame(r, songs(10), 5, 'loud' as never)).toEqual({ ok: false, error: 'Ungültiger Audio-Modus.' });

    const bad: unknown[] = [
      null,
      { ...song(1990), title: 42 },
      { ...song(1990), title: 'x'.repeat(201) },
      { ...song(1990), year: 1850 },
      { ...song(1990), year: 2200 },
      { ...song(1990), preview: 'https://evil.example.com/a.m4a' },
      { ...song(1990), id: undefined },
      { ...song(1990), artist: undefined },
    ];
    for (const entry of bad) {
      const result = startGame(r, [...songs(5), entry as SongFull], 5, 'all');
      expect(result).toEqual({ ok: false, error: 'Ungültige Song-Daten.' });
    }
  });

  it('needs two connected players and enough songs for them', () => {
    const r = room(['a', 'b', 'c']);
    r.players.get('b')!.isConnected = false;
    r.players.get('c')!.isConnected = false;
    expect(startGame(r, songs(10), 5, 'all')).toEqual({
      ok: false,
      error: 'Es müssen mindestens 2 Spieler verbunden sein.',
    });

    const full = room(['a', 'b', 'c']);
    expect(startGame(full, songs(5), 5, 'all')).toEqual({ ok: false, error: 'Zu wenige Songs für 3 Spieler.' });
  });

  it('deals a starting card each, leaves offline players out and resets old scores', () => {
    const r = room(['a', 'b', 'c']);
    r.players.get('c')!.isConnected = false;
    r.players.get('c')!.score = 7;
    r.lastCorrectSong.set('a', song(1999));

    expect(startGame(r, songs(10), 3, 'host-only')).toEqual({ ok: true });
    expect(r.status).toBe('playing');
    expect(r.playerOrder).toEqual(['a', 'b']);
    expect(r.players.get('a')!.timeline).toHaveLength(1);
    expect(r.players.get('b')!.timeline).toHaveLength(1);
    expect(r.players.get('c')!.timeline).toEqual([]);
    expect(r.players.get('c')!.score).toBe(0);
    expect(r.deck).toHaveLength(8);
    expect(r.audioMode).toBe('host-only');
    expect(r.rounds).toBe(3);
    expect(r.lastCorrectSong.size).toBe(0);
    expect([r.currentSongIndex, r.currentPlayerIndex, r.round]).toEqual([0, 0, 1]);
  });

  it('caps the rounds to what the deck covers for everyone', () => {
    const r = room(['a', 'b']);
    startGame(r, songs(10), 20, 'all');
    expect(r.rounds).toBe(4); // 8 songs left for 2 players
  });
});

describe('placeSong', () => {
  const base = () =>
    playingRoom(['a', 'b'], [song(1980), song(1990), song(2000)], {
      a: [song(1970, 'a1'), song(1990, 'a2')],
      b: [song(1985, 'b1')],
    });

  it('refuses when the game is not running, paused, not your turn or the position is odd', () => {
    const r = base();
    expect(placeSong(r, 'b', 0)).toEqual({ ok: false, error: 'Du bist nicht dran.' });
    expect(placeSong(r, 'a', 0.5)).toEqual({ ok: false, error: 'Ungültige Position.' });

    r.players.get('a')!.isConnected = false;
    expect(placeSong(r, 'a', 0)).toEqual({ ok: false, error: 'Das Spiel ist pausiert.' });

    r.status = 'finished';
    expect(placeSong(r, 'a', 0)).toEqual({ ok: false, error: 'Spiel läuft nicht.' });
  });

  it('refuses when the deck is exhausted', () => {
    const r = base();
    r.currentSongIndex = r.deck.length;
    expect(placeSong(r, 'a', 0)).toEqual({ ok: false, error: 'Kein Song verfügbar.' });
  });

  it('inserts a correct placement and scores it', () => {
    const r = base();
    const result = placeSong(r, 'a', 1); // 1980 between 1970 and 1990
    expect(result).toMatchObject({ ok: true, correct: true, timedOut: false, gameOver: false, lastPlayerId: 'a' });
    expect(r.players.get('a')!.timeline.map((s) => s.year)).toEqual([1970, 1980, 1990]);
    expect(r.players.get('a')!.score).toBe(1);
    expect(r.lastCorrectSong.get('a')?.year).toBe(1980);
    expect(r.playerOrder[r.currentPlayerIndex]).toBe('b');
  });

  it('discards a wrong placement', () => {
    const r = base();
    expect(placeSong(r, 'a', 0)).toMatchObject({ ok: true, correct: false });
    expect(r.players.get('a')!.timeline).toHaveLength(2);
    expect(r.players.get('a')!.score).toBe(0);
  });

  it('accepts equal years on either side and clamps positions past the end', () => {
    const r = playingRoom(['a', 'b'], [song(1990, 'x'), song(1990, 'y')], {
      a: [song(1990, 'a1')],
      b: [song(1990, 'b1')],
    });
    expect(placeSong(r, 'a', 0)).toMatchObject({ correct: true });
    expect(placeSong(r, 'b', 99)).toMatchObject({ correct: true });
    expect(r.players.get('b')!.timeline.map((s) => s.id)).toEqual(['b1', 'y']);
  });

  it('starts a new round after the last player', () => {
    const r = base();
    placeSong(r, 'a', 0);
    placeSong(r, 'b', 0);
    expect(r.round).toBe(2);
    expect(r.currentPlayerIndex).toBe(0);
  });

  it('ends after the last round', () => {
    const r = playingRoom(['a', 'b'], songs(10), {}, { rounds: 1 });
    placeSong(r, 'a', 0);
    expect(placeSong(r, 'b', 0)).toMatchObject({ gameOver: true });
    expect(r.status).toBe('finished');
  });

  it('ends at a round boundary when the deck cannot cover another full round', () => {
    const r = playingRoom(['a', 'b'], songs(3), {}, { rounds: 5 });
    placeSong(r, 'a', 0);
    expect(placeSong(r, 'b', 0)).toMatchObject({ gameOver: true }); // 1 song left, 2 players
  });

  it('ends mid-round only when no song is left at all', () => {
    const r = playingRoom(['a', 'b', 'c'], songs(1), {}, { rounds: 5 });
    expect(placeSong(r, 'a', 0)).toMatchObject({ gameOver: true });
  });
});

describe('timeoutTurn', () => {
  it('resolves the current turn as a timed-out miss', () => {
    const r = playingRoom(['a', 'b'], songs(4));
    expect(timeoutTurn(r)).toMatchObject({ correct: false, timedOut: true, lastPlayerId: 'a' });
    expect(r.currentSongIndex).toBe(1);
    expect(r.playerOrder[r.currentPlayerIndex]).toBe('b');
  });

  it('does nothing outside a running, unpaused turn', () => {
    expect(timeoutTurn(room(['a', 'b']))).toBeNull();

    const paused = playingRoom(['a', 'b'], songs(4));
    paused.players.get('a')!.isConnected = false;
    expect(timeoutTurn(paused)).toBeNull();

    const empty = playingRoom(['a', 'b'], []);
    expect(timeoutTurn(empty)).toBeNull();
  });
});

describe('pausedPlayerId', () => {
  it('pauses for an offline host or an offline player on turn only', () => {
    const r = playingRoom(['host', 'b', 'c'], songs(6));
    expect(pausedPlayerId(r)).toBeNull();

    r.players.get('c')!.isConnected = false; // not on turn
    expect(pausedPlayerId(r)).toBeNull();

    r.currentPlayerIndex = 2;
    expect(pausedPlayerId(r)).toBe('c');

    r.players.get('host')!.isConnected = false;
    expect(pausedPlayerId(r)).toBe('host');

    r.status = 'finished';
    expect(pausedPlayerId(r)).toBeNull();
  });
});

describe('skipDisconnectedPlayer', () => {
  it('refuses when nothing is paused', () => {
    expect(skipDisconnectedPlayer(playingRoom(['a', 'b'], songs(4)))).toEqual({
      ok: false,
      error: 'Spiel ist nicht pausiert.',
    });
  });

  it('removes the offline player on turn and hands the turn to the next one', () => {
    const r = playingRoom(['a', 'b', 'c', 'd'], songs(8), {}, { currentPlayerIndex: 1 });
    r.players.get('b')!.isConnected = false;
    expect(skipDisconnectedPlayer(r)).toEqual({ ok: true, gameOver: false });
    expect(r.playerOrder).toEqual(['a', 'c', 'd']);
    expect(r.playerOrder[r.currentPlayerIndex]).toBe('c');
    expect(r.round).toBe(1);
  });

  it('wraps into the next round when the last player of a round is skipped', () => {
    const r = playingRoom(['a', 'b', 'c'], songs(8), {}, { currentPlayerIndex: 2 });
    r.players.get('c')!.isConnected = false;
    skipDisconnectedPlayer(r);
    expect(r.currentPlayerIndex).toBe(0);
    expect(r.round).toBe(2);
  });

  it('keeps the current player when someone before them is removed', () => {
    const r = playingRoom(['host', 'b', 'c'], songs(8), {}, { currentPlayerIndex: 2 });
    r.players.get('host')!.isConnected = false;
    skipDisconnectedPlayer(r);
    expect(r.playerOrder[r.currentPlayerIndex]).toBe('c');
  });

  it('ends the game when only one player is left', () => {
    const r = playingRoom(['a', 'b'], songs(8), {}, { currentPlayerIndex: 1 });
    r.players.get('b')!.isConnected = false;
    expect(skipDisconnectedPlayer(r)).toEqual({ ok: true, gameOver: true });
    expect(r.status).toBe('finished');
  });
});

describe('seatPlayer', () => {
  it('appends a returning player who still has cards', () => {
    const r = playingRoom(['a', 'b'], songs(10));
    const back = r.players.get('b')!;
    r.playerOrder = ['a'];
    back.timeline = [song(1999)];
    seatPlayer(r, back);
    expect(r.playerOrder).toEqual(['a', 'b']);
  });

  it('deals a starting card from the deck to a newcomer', () => {
    const r = playingRoom(['a', 'b'], songs(10));
    const late = { ...r.players.get('b')!, id: 'late', timeline: [] as SongFull[] };
    r.players.set('late', late);
    seatPlayer(r, late);
    expect(late.timeline).toEqual([expect.objectContaining({ preview: PREVIEW })]);
    expect(r.deck).toHaveLength(9);
    expect(r.playerOrder).toContain('late');
  });

  it('leaves newcomers watching when the deck cannot spare a card', () => {
    const r = playingRoom(['a', 'b'], songs(2));
    const late = { ...r.players.get('b')!, id: 'late', timeline: [] as SongFull[] };
    seatPlayer(r, late);
    expect(r.playerOrder).not.toContain('late');
  });

  it('does nothing outside a game or for seated players', () => {
    const lobby = room(['a', 'b']);
    seatPlayer(lobby, lobby.players.get('b')!);
    expect(lobby.playerOrder).toEqual(['a', 'b']);

    const r = playingRoom(['a', 'b'], songs(4));
    seatPlayer(r, r.players.get('a')!);
    expect(r.playerOrder).toEqual(['a', 'b']);
  });
});

describe('returnToLobby / finishGame', () => {
  it('resets the game and brings everyone back into the turn order', () => {
    const r = playingRoom(['a', 'b', 'c'], songs(6), { a: [song(1999)] }, { round: 3, currentPlayerIndex: 1 });
    r.playerOrder = ['a'];
    r.players.get('a')!.score = 4;
    returnToLobby(r);
    expect(r.status).toBe('lobby');
    expect(r.playerOrder).toEqual(['a', 'b', 'c']);
    expect(r.deck).toEqual([]);
    expect([r.round, r.currentPlayerIndex, r.currentSongIndex]).toEqual([1, 0, 0]);
    expect(r.players.get('a')!.score).toBe(0);
    expect(r.players.get('a')!.timeline).toEqual([]);
  });

  it('marks a game as finished', () => {
    const r = playingRoom(['a', 'b'], songs(4));
    finishGame(r);
    expect(r.status).toBe('finished');
  });
});
