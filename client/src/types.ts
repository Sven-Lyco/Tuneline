export type { SpotifyPlaylist } from '@tuneline/shared';

export type Screen =
  | 'login'
  | 'join'
  | 'playlists'
  | 'menu'
  | 'loading'
  | 'lobby'
  | 'game'
  | 'result'
  | 'help'
  | 'privacy'
  | 'terms';

export type Feedback = 'ok' | 'no' | 'timeout' | null;

export interface GameResult {
  players: import('@tuneline/shared').RoomPlayer[];
  lastSong: import('@tuneline/shared').SongFull | null;
  lastCorrect: boolean;
  lastPlayerId: string;
  winnerLastSong: import('@tuneline/shared').SongFull | null;
}
