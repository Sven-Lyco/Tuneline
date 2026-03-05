// Spotify Web Playback SDK — dynamisch geladen, globaler Singleton

interface SpotifyWebPlayer {
  connect(): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getCurrentState(): Promise<{ paused: boolean } | null>;
  addListener(event: 'ready', cb: (data: { device_id: string }) => void): boolean;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    cb: (data: { message: string }) => void
  ): boolean;
  addListener(event: string, cb: (data: unknown) => void): boolean;
}

declare global {
  interface Window {
    Spotify: {
      Player: new (config: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyWebPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

let player: SpotifyWebPlayer | null = null;
let deviceId: string | null = null;
let tokenGetter: (() => Promise<string | null>) | null = null;
let readyResolve: (() => void) | null = null;
let readyReject: ((e: Error) => void) | null = null;

const playerReady = new Promise<void>((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});

function loadSdk(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.head.appendChild(script);
  });
}

export async function initSpotifyPlayer(getToken: () => Promise<string | null>): Promise<void> {
  tokenGetter = getToken;

  await loadSdk();

  player = new window.Spotify.Player({
    name: 'Tuneline',
    getOAuthToken: (cb) => {
      getToken().then((token) => {
        if (token) cb(token);
      });
    },
    volume: 0.8,
  });

  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    readyResolve?.();
  });

  player.addListener('initialization_error', ({ message }) => {
    readyReject?.(new Error(message));
  });

  player.addListener('authentication_error', ({ message }) => {
    readyReject?.(new Error(message));
  });

  player.addListener('account_error', ({ message }) => {
    readyReject?.(new Error(message));
  });

  player.connect();
  return playerReady;
}

export async function playTrack(uri: string, positionMs = 60_000): Promise<void> {
  await playerReady;
  if (!deviceId || !tokenGetter) return;

  const token = await tokenGetter();
  if (!token) return;

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
  });
}

export async function stopTrack(): Promise<void> {
  await player?.pause();
}

export async function toggleTrack(): Promise<boolean> {
  if (!player) return false;
  const state = await player.getCurrentState();
  if (!state) return false;

  if (state.paused) {
    await player.resume();
    return true;
  } else {
    await player.pause();
    return false;
  }
}
