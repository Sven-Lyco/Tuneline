import type {
  GameStateForClient,
  LobbyState,
  RoomPlayer,
  SongFull,
  SpotifyPlaylist,
} from '@tuneline/shared';

export const player = (id: string, overrides: Partial<RoomPlayer> = {}): RoomPlayer => ({
  id,
  name: id,
  isHost: id === 'host',
  isConnected: true,
  score: 0,
  timeline: [],
  ...overrides,
});

export const song = (year: number, overrides: Partial<SongFull> = {}): SongFull => ({
  id: `s${year}`,
  title: `Title ${year}`,
  artist: `Artist ${year}`,
  cover: null,
  preview: `https://audio/${year}.m4a`,
  year,
  ...overrides,
});

export const lobby = (overrides: Partial<LobbyState> = {}): LobbyState => ({
  roomCode: 'ROOM01',
  players: [player('host'), player('me')],
  rounds: 5,
  audioMode: 'all',
  turnLimit: 0,
  status: 'lobby',
  ...overrides,
});

export const gameState = (overrides: Partial<GameStateForClient> = {}): GameStateForClient => ({
  players: [player('host'), player('me', { timeline: [song(1980)] })],
  currentPlayerId: 'me',
  round: 1,
  rounds: 5,
  audioMode: 'all',
  deckRemaining: 10,
  turnEndsInMs: null,
  ...overrides,
});

export const playlist = (
  id: string,
  overrides: Partial<SpotifyPlaylist> = {}
): SpotifyPlaylist => ({
  id,
  name: `Playlist ${id}`,
  coverUrl: `https://cover/${id}.jpg`,
  trackCount: 40,
  ownerName: 'Me',
  ...overrides,
});
