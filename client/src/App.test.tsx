import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { isAuthenticated, loadSongsFromPlaylists, logout } from './api/spotify';
import { isSeatActiveElsewhere } from './utils/tabPresence';
import { readLastRoom, saveLastRoom } from './utils/roomStorage';
import { STORAGE_KEYS } from './constants';
import { emittedPayloads, serverEmit, socket } from './test/fakeSocket';
import { gameState, lobby, player, playlist, song } from './test/data';

vi.mock('./api/spotify', () => ({
  isAuthenticated: vi.fn(),
  loadSongsFromPlaylists: vi.fn(),
  logout: vi.fn(async () => {}),
  getUserPlaylists: vi.fn(async () => [
    { id: 'a', name: 'Playlist a', coverUrl: null, trackCount: 40, ownerName: 'Me' },
  ]),
  redirectToSpotify: vi.fn(),
}));
vi.mock('./utils/tabPresence', () => ({ isSeatActiveElsewhere: vi.fn() }));

function openAt(url: string) {
  window.history.replaceState({}, '', url);
  return render(<App />);
}

/** Puts the app into the lobby as host with a chosen playlist. */
async function hostLobby() {
  sessionStorage.setItem(STORAGE_KEYS.selectedPlaylists, JSON.stringify([playlist('a')]));
  openAt('/');
  await screen.findByText('Raum beitreten (Gast)');
  socket.connected = true;
  serverEmit('room_joined', { playerId: 'host', playerToken: 'tok', room: lobby() });
  await screen.findByText('Spiel starten →');
}

beforeEach(() => {
  vi.mocked(isAuthenticated).mockResolvedValue(false);
  vi.mocked(isSeatActiveElsewhere).mockResolvedValue(false);
  vi.mocked(loadSongsFromPlaylists).mockResolvedValue([]);
});

describe('start screens', () => {
  it('joins as a guest from the login screen', async () => {
    openAt('/');
    fireEvent.click(await screen.findByText('Raum beitreten (Gast)'));
    const [code, name] = screen.getAllByRole('textbox');
    fireEvent.change(code, { target: { value: 'ROOM01' } });
    fireEvent.change(name, { target: { value: 'Anna' } });
    fireEvent.click(screen.getByText('Beitreten →'));
    expect(socket.connected).toBe(true);
    expect(emittedPayloads('join_room')).toEqual([
      { roomCode: 'ROOM01', playerName: 'Anna', playerToken: undefined },
    ]);

    serverEmit('room_joined', { playerId: 'me', playerToken: 'tok', room: lobby() });
    expect(
      await screen.findByText('Warten darauf, dass der Host das Spiel startet…')
    ).toBeInTheDocument();
  });

  it('opens the join screen for a room link and cleans the url', async () => {
    openAt('/?room=room01');
    expect(await screen.findByDisplayValue('ROOM01')).toBeInTheDocument();
    expect(window.location.search).toBe('');
    fireEvent.click(screen.getByText('← Zurück'));
    expect(screen.getByText('Raum beitreten (Gast)')).toBeInTheDocument();
  });

  it('reports a failed Spotify login', async () => {
    openAt('/?auth_error=true');
    expect(
      await screen.findByText('Spotify-Login fehlgeschlagen. Bitte erneut versuchen.')
    ).toBeInTheDocument();
  });

  it('goes straight to the playlists when logged in', async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    openAt('/');
    expect(await screen.findByText('Wähle eine oder mehrere Playlisten aus:')).toBeInTheDocument();
  });

  it('shows the help and comes back', async () => {
    openAt('/');
    fireEvent.click(await screen.findByTitle('Spielanleitung'));
    fireEvent.click(await screen.findByText('←'));
    expect(screen.getByText('Raum beitreten (Gast)')).toBeInTheDocument();
  });
});

describe('creating a room', () => {
  it('walks from Spotify login through playlists and menu into the lobby', async () => {
    openAt('/?authenticated=true');
    fireEvent.click(await screen.findByText('Playlist a'));
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.selectedPlaylists)!)).toHaveLength(1);
    fireEvent.click(screen.getByText('Weiter →'));

    fireEvent.change(screen.getByPlaceholderText('z.B. Alex'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByText('30s'));
    fireEvent.click(screen.getByText('Raum erstellen →'));
    expect(emittedPayloads('create_room')).toEqual([
      { hostName: 'Alex', rounds: 5, audioMode: 'host-only', turnLimit: 30 },
    ]);

    serverEmit('room_created', { roomCode: 'ROOM01', playerId: 'host', playerToken: 'tok' });
    serverEmit('room_updated', { room: lobby({ turnLimit: 30, audioMode: 'host-only' }) });
    fireEvent.click(await screen.findByText('10'));
    fireEvent.click(screen.getByText(/Alle hören/));
    fireEvent.click(screen.getByText('60s'));
    expect(emittedPayloads('update_settings')).toEqual([
      { rounds: 10, audioMode: 'host-only', turnLimit: 30 },
      { rounds: 10, audioMode: 'all', turnLimit: 30 },
      { rounds: 10, audioMode: 'all', turnLimit: 60 },
    ]);

    fireEvent.click(screen.getByTitle('Spieler entfernen'));
    expect(emittedPayloads('kick_player')).toEqual([{ playerId: 'me' }]);

    fireEvent.click(screen.getByText('ändern →'));
    fireEvent.click(await screen.findByText('Weiter →'));
    expect(await screen.findByText('Spiel starten →')).toBeInTheDocument();
  });

  it('goes back from the menu to the playlists and logs out there', async () => {
    openAt('/?authenticated=true');
    fireEvent.click(await screen.findByText('Playlist a'));
    fireEvent.click(screen.getByText('Weiter →'));
    fireEvent.click(
      screen.getByText('PLAYLISTEN', { exact: false }).parentElement!.querySelector('button')!
    );
    fireEvent.click(await screen.findByText('Abmelden'));
    expect(logout).toHaveBeenCalled();
    expect(await screen.findByText('Mit Spotify einloggen')).toBeInTheDocument();
  });
});

describe('coming back', () => {
  const storeSeat = () => {
    sessionStorage.setItem(STORAGE_KEYS.roomCode, 'ROOM01');
    sessionStorage.setItem(STORAGE_KEYS.playerToken, 'tok');
  };

  it('rejoins automatically after a reload', async () => {
    storeSeat();
    openAt('/');
    await waitFor(() =>
      expect(emittedPayloads('rejoin_room')).toEqual([{ roomCode: 'ROOM01', playerToken: 'tok' }])
    );
    expect(screen.getByText('Verbinde mit dem Raum…')).toBeInTheDocument();
  });

  it('starts fresh in a duplicated tab', async () => {
    storeSeat();
    vi.mocked(isSeatActiveElsewhere).mockResolvedValue(true);
    openAt('/');
    expect(await screen.findByText('Raum beitreten (Gast)')).toBeInTheDocument();
    expect(emittedPayloads('rejoin_room')).toEqual([]);
    expect(sessionStorage.getItem(STORAGE_KEYS.playerToken)).toBeNull();
  });

  it('offers the last room after the tab was closed', async () => {
    saveLastRoom({ roomCode: 'ROOM01', playerToken: 'tok', playerName: 'Anna' });
    openAt('/');
    fireEvent.click(await screen.findByText('Zurück ins Spiel'));
    expect(emittedPayloads('rejoin_room')).toEqual([{ roomCode: 'ROOM01', playerToken: 'tok' }]);
  });

  it('can dismiss the offer, and hides it while another tab plays the seat', async () => {
    saveLastRoom({ roomCode: 'ROOM01', playerToken: 'tok', playerName: 'Anna' });
    const { unmount } = openAt('/');
    fireEvent.click(await screen.findByLabelText('Hinweis schließen'));
    expect(screen.queryByText('Zurück ins Spiel')).not.toBeInTheDocument();
    expect(readLastRoom()).toBeNull();
    unmount();

    saveLastRoom({ roomCode: 'ROOM01', playerToken: 'tok', playerName: 'Anna' });
    vi.mocked(isSeatActiveElsewhere).mockResolvedValue(true);
    openAt('/');
    await screen.findByText('Raum beitreten (Gast)');
    await waitFor(() => expect(isSeatActiveElsewhere).toHaveBeenCalled());
    expect(screen.queryByText('Zurück ins Spiel')).not.toBeInTheDocument();
  });
});

describe('starting a game', () => {
  it('loads songs without the played ones and starts', async () => {
    vi.mocked(loadSongsFromPlaylists).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => song(1960 + i))
    );
    await hostLobby();
    fireEvent.click(screen.getByText('Spiel starten →'));
    expect(emittedPayloads('start_loading')).toHaveLength(1);
    await waitFor(() => expect(emittedPayloads('start_game')).toHaveLength(1));
    expect(loadSongsFromPlaylists).toHaveBeenCalledWith(['a'], 18, [], expect.any(AbortSignal));
    expect(emittedPayloads('start_game')[0]).toMatchObject({ rounds: 5, audioMode: 'all' });
  });

  it('goes back to the lobby when there are too few songs', async () => {
    await hostLobby();
    fireEvent.click(screen.getByText('Spiel starten →'));
    expect(
      await screen.findByText('Nicht genug Songs gefunden. Bitte andere Playlisten wählen.')
    ).toBeInTheDocument();
    expect(emittedPayloads('cancel_loading')).toHaveLength(1);
    expect(await screen.findByText('Spiel starten →', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('lets the host cancel while songs load', async () => {
    vi.mocked(loadSongsFromPlaylists).mockImplementation(
      (_ids, _target, _exclude, signal) =>
        new Promise((resolve) => signal.addEventListener('abort', () => resolve([])))
    );
    await hostLobby();
    fireEvent.click(screen.getByText('Spiel starten →'));
    fireEvent.click(await screen.findByText('Abbrechen'));
    expect(await screen.findByText('Spiel starten →')).toBeInTheDocument();
    expect(emittedPayloads('cancel_loading')).toHaveLength(1);
    expect(emittedPayloads('start_game')).toHaveLength(0);
  });
});

describe('playing and leaving', () => {
  it('places, skips a dropped player, restarts and leaves as host', async () => {
    await hostLobby();
    serverEmit('game_started', {
      gameState: gameState({
        currentPlayerId: 'host',
        players: [player('host', { timeline: [song(1980)] }), player('me')],
      }),
      currentSong: { preview: 'https://audio/1.m4a' },
    });
    fireEvent.click((await screen.findAllByLabelText('Song hier platzieren'))[0]);
    fireEvent.click(screen.getByText('Hier platzieren ▶'));
    fireEvent.click(screen.getByText('Wird platziert…'));
    expect(emittedPayloads('place_song')).toEqual([{ position: 0 }]);

    serverEmit('game_paused', {
      disconnectedPlayerId: 'me',
      disconnectedPlayerName: 'me',
      isHostDisconnected: false,
      gameState: gameState({ currentPlayerId: 'me' }),
      currentSong: { preview: null },
    });
    fireEvent.click(await screen.findByText('Ohne me weiterspielen'));
    expect(emittedPayloads('skip_player')).toHaveLength(1);

    serverEmit('game_over', {
      players: [player('host', { score: 1 }), player('me')],
      lastSong: null,
      lastCorrect: false,
      lastPlayerId: '',
      winnerLastSong: null,
    });
    fireEvent.click(await screen.findByText('↻ Nochmal spielen'));
    expect(emittedPayloads('return_to_lobby')).toHaveLength(1);

    fireEvent.click(screen.getByText('← Raum verlassen'));
    expect(emittedPayloads('leave_room')).toHaveLength(1);
    expect(socket.connected).toBe(false);
    expect(await screen.findByText('Raum erstellen →')).toBeInTheDocument();
  });

  it('sends guests back to the login when they leave, without a stale leave while offline', async () => {
    openAt('/');
    await screen.findByText('Raum beitreten (Gast)');
    serverEmit('room_joined', { playerId: 'me', playerToken: 'tok', room: lobby() });
    fireEvent.click(await screen.findByText('← Raum verlassen'));
    expect(emittedPayloads('leave_room')).toEqual([]);
    expect(await screen.findByText('Raum beitreten (Gast)')).toBeInTheDocument();
  });
});
