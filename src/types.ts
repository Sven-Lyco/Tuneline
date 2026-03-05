export interface Song {
  id: string;
  uri: string; // spotify:track:xxx
  title: string;
  artist: string;
  year: number;
  cover: string | null;
}

export interface Player {
  name: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  coverUrl: string | null;
  trackCount: number;
  ownerName: string;
}

export type Screen = 'login' | 'playlists' | 'menu' | 'loading' | 'game' | 'result';
export type Feedback = 'ok' | 'no' | null;
