import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { LoginScreen } from './LoginScreen';
import { HelpScreen } from './HelpScreen';
import { JoinScreen } from './JoinScreen';
import { PlaylistScreen } from './PlaylistScreen';
import { MenuScreen } from './MenuScreen';
import { LoadingScreen } from './LoadingScreen';
import { LobbyScreen } from './LobbyScreen';
import { GameScreen } from './GameScreen';
import { ResultScreen } from './ResultScreen';
import { getUserPlaylists, redirectToSpotify } from '../api/spotify';
import { gameState, lobby, player, playlist, song } from '../test/data';

vi.mock('../api/spotify', () => ({
  getUserPlaylists: vi.fn(async () => ({ playlists: [], problem: null })),
  redirectToSpotify: vi.fn(async () => {}),
}));

describe('LoginScreen', () => {
  it('starts the Spotify login, the guest join or the help', () => {
    const onJoinAsGuest = vi.fn();
    const onHelp = vi.fn();
    render(<LoginScreen onJoinAsGuest={onJoinAsGuest} onHelp={onHelp} />);
    fireEvent.click(screen.getByText('Mit Spotify einloggen'));
    fireEvent.click(screen.getByText('Raum beitreten (Gast)'));
    fireEvent.click(screen.getByTitle('Spielanleitung'));
    expect(redirectToSpotify).toHaveBeenCalled();
    expect(onJoinAsGuest).toHaveBeenCalled();
    expect(onHelp).toHaveBeenCalled();
  });
});

describe('HelpScreen', () => {
  it('switches between the player and host guides', () => {
    const onBack = vi.fn();
    render(<HelpScreen onBack={onBack} />);
    expect(screen.getByText(/für alle verborgen/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Als Host'));
    expect(screen.queryByText(/für alle verborgen/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Als Spieler'));
    fireEvent.click(screen.getByText('←'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('JoinScreen', () => {
  it('needs a six-letter code and a name before joining', () => {
    const onJoin = vi.fn();
    const onBack = vi.fn();
    render(<JoinScreen initialCode="ab" onJoin={onJoin} onBack={onBack} />);
    const [code, name] = screen.getAllByRole('textbox');
    const join = screen.getByText('Beitreten →');
    expect(join).toBeDisabled();

    fireEvent.change(code, { target: { value: 'room01' } });
    expect(code).toHaveValue('ROOM01');
    fireEvent.keyDown(code, { key: 'Enter' });
    expect(onJoin).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: ' Anna ' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.click(join);
    expect(onJoin).toHaveBeenCalledWith('ROOM01', 'Anna');
    expect(onJoin).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('← Zurück'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('PlaylistScreen', () => {
  it('loads playlists and lets the host pick some', async () => {
    vi.mocked(getUserPlaylists).mockResolvedValueOnce({
      playlists: [playlist('a'), playlist('b', { coverUrl: null })],
      problem: null,
    });
    const onToggle = vi.fn();
    const onConfirm = vi.fn();
    const onLogout = vi.fn();
    const { rerender } = render(
      <PlaylistScreen selected={[]} onToggle={onToggle} onConfirm={onConfirm} onLogout={onLogout} />
    );
    expect(screen.getByText('Playlisten werden geladen...')).toBeInTheDocument();
    await screen.findByText('Playlist a');
    expect(screen.getByText('Keine Playlist gewählt')).toBeInTheDocument();
    expect(screen.getByText('Weiter →')).toBeDisabled();

    fireEvent.click(screen.getByText('Playlist a'));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    fireEvent.error(screen.getByAltText('Playlist a'));
    expect(screen.getByAltText('Playlist a')).toHaveStyle({ display: 'none' });

    rerender(
      <PlaylistScreen
        selected={[playlist('a'), playlist('b')]}
        onToggle={onToggle}
        onConfirm={onConfirm}
        onLogout={onLogout}
      />
    );
    expect(screen.getByText('2 Playlisten gewählt')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2);
    fireEvent.click(screen.getByText('Weiter →'));
    fireEvent.click(screen.getByText('Abmelden'));
    expect(onConfirm).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });

  it('explains why Spotify gave no playlists', async () => {
    vi.mocked(getUserPlaylists).mockResolvedValueOnce({
      playlists: [],
      problem: 'not_allowlisted',
    });
    render(
      <PlaylistScreen selected={[]} onToggle={() => {}} onConfirm={() => {}} onLogout={() => {}} />
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht freigeschaltet/);
    expect(screen.queryByText('Keine Playlisten gefunden.')).not.toBeInTheDocument();
  });

  it('says so when there are no playlists', async () => {
    render(
      <PlaylistScreen
        selected={[playlist('a')]}
        onToggle={() => {}}
        onConfirm={() => {}}
        onLogout={() => {}}
      />
    );
    await screen.findByText('Keine Playlisten gefunden.');
    expect(screen.getByText('1 Playlist gewählt')).toBeInTheDocument();
  });
});

describe('MenuScreen', () => {
  it('collects the room settings', () => {
    const props = {
      playlists: [playlist('a')],
      hostName: '',
      setHostName: vi.fn(),
      rounds: 5,
      setRounds: vi.fn(),
      audioMode: 'all' as const,
      setAudioMode: vi.fn(),
      turnLimit: 0,
      setTurnLimit: vi.fn(),
      onCreateRoom: vi.fn(),
      onChangePlaylists: vi.fn(),
    };
    render(<MenuScreen {...props} />);
    fireEvent.change(screen.getByPlaceholderText('z.B. Alex'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByText('15'));
    fireEvent.click(screen.getByText('90s'));
    fireEvent.click(screen.getByText(/Nur Host/));
    fireEvent.click(screen.getByText('Raum erstellen →'));
    expect(props.setHostName).toHaveBeenCalledWith('Alex');
    expect(props.setRounds).toHaveBeenCalledWith(15);
    expect(props.setTurnLimit).toHaveBeenCalledWith(90);
    expect(props.setAudioMode).toHaveBeenCalledWith('host-only');
    expect(props.onCreateRoom).toHaveBeenCalled();
  });
});

describe('LoadingScreen', () => {
  it('offers to cancel only when allowed', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <LoadingScreen message="Songs werden geladen…" onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onCancel).toHaveBeenCalled();
    rerender(<LoadingScreen message="Host lädt Songs…" />);
    expect(screen.queryByText('Abbrechen')).not.toBeInTheDocument();
  });

  it('explains after a while that iTunes slows loading down', () => {
    vi.useFakeTimers();
    render(<LoadingScreen message="Songs werden geladen…" />);
    expect(screen.getByText('Das kann ein paar Sekunden dauern...')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByText(/iTunes erlaubt nur wenige Suchen pro Minute/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('LobbyScreen', () => {
  type Props = ComponentProps<typeof LobbyScreen>;
  const props = (overrides: Partial<Props> = {}): Props => ({
    roomCode: 'ROOM01',
    lobbyState: lobby(),
    myPlayerId: 'host',
    isHost: true,
    selectedPlaylists: [playlist('a')],
    onStart: vi.fn(),
    onKick: vi.fn(),
    onLeave: vi.fn(),
    onAudioModeChange: vi.fn(),
    onRoundsChange: vi.fn(),
    onTurnLimitChange: vi.fn(),
    onChangePlaylists: vi.fn(),
    ...overrides,
  });

  it('lets the host configure, kick and start', () => {
    const p = props();
    render(<LobbyScreen {...p} />);
    fireEvent.click(screen.getByTitle('Spieler entfernen'));
    fireEvent.click(screen.getByText('20'));
    fireEvent.click(screen.getByText('30s'));
    fireEvent.click(screen.getByText(/Alle hören/));
    fireEvent.click(screen.getByText('ändern →'));
    fireEvent.click(screen.getByText('Spiel starten →'));
    fireEvent.click(screen.getByText('← Raum verlassen'));
    expect(p.onKick).toHaveBeenCalledWith('me');
    expect(p.onRoundsChange).toHaveBeenCalledWith(20);
    expect(p.onTurnLimitChange).toHaveBeenCalledWith(30);
    expect(p.onAudioModeChange).toHaveBeenCalledWith('all');
    expect(p.onChangePlaylists).toHaveBeenCalled();
    expect(p.onStart).toHaveBeenCalled();
    expect(p.onLeave).toHaveBeenCalled();
  });

  it('only counts connected players for the start', () => {
    render(
      <LobbyScreen
        {...props({
          lobbyState: lobby({ players: [player('host'), player('me', { isConnected: false })] }),
        })}
      />
    );
    expect(screen.getByText('Spiel starten →')).toBeDisabled();
    expect(screen.getByText('Warten auf weitere Spieler…')).toBeInTheDocument();
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('shows guests a waiting note or a warning when the host is offline', () => {
    const { rerender } = render(<LobbyScreen {...props({ isHost: false, myPlayerId: 'me' })} />);
    expect(screen.getByText('du')).toBeInTheDocument();
    expect(screen.getByText('Warten darauf, dass der Host das Spiel startet…')).toBeInTheDocument();
    rerender(
      <LobbyScreen
        {...props({
          isHost: false,
          myPlayerId: 'me',
          lobbyState: lobby({ players: [player('host', { isConnected: false }), player('me')] }),
        })}
      />
    );
    expect(screen.getByText(/Der Host ist gerade offline/)).toBeInTheDocument();
  });
});

describe('GameScreen', () => {
  type Props = ComponentProps<typeof GameScreen>;
  const props = (overrides: Partial<Props> = {}): Props => ({
    myPlayerId: 'me',
    roomCode: 'ROOM01',
    isHost: false,
    gameState: gameState(),
    turnEndsAt: null,
    revealedSong: null,
    feedback: null,
    revealed: false,
    lastPlacedPlayerId: null,
    playing: false,
    volume: 0.8,
    slot: null,
    setSlot: vi.fn(),
    placing: false,
    onToggleAudio: vi.fn(),
    onVolumeChange: vi.fn(),
    onPlace: vi.fn(),
    disconnectedPlayer: null,
    onSkipPlayer: vi.fn(),
    ...overrides,
  });

  it('guides the player on turn through placing', () => {
    const p = props();
    const { rerender } = render(<GameScreen {...p} />);
    expect(screen.getByText('Position wählen...')).toBeDisabled();
    rerender(<GameScreen {...props({ slot: 1, onPlace: p.onPlace })} />);
    fireEvent.click(screen.getByText('Hier platzieren ▶'));
    expect(p.onPlace).toHaveBeenCalled();
    rerender(<GameScreen {...props({ slot: 1, placing: true })} />);
    expect(screen.getByText('Wird platziert…')).toBeDisabled();
  });

  it('centres the timelines on a new turn only once the reveal is over', () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
    const { rerender } = render(<GameScreen {...props({ revealed: true })} />);
    expect(scrollTo).not.toHaveBeenCalled();
    rerender(<GameScreen {...props({ revealed: false })} />);
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  it('shows others whose turn it is, spectators a hint and pauses an overlay', () => {
    const { rerender } = render(
      <GameScreen {...props({ gameState: gameState({ currentPlayerId: 'host' }) })} />
    );
    expect(screen.getAllByText('Warten auf host…').length).toBeGreaterThan(0);

    rerender(<GameScreen {...props({ myPlayerId: 'watcher' })} />);
    expect(screen.getByText(/Du schaust gerade zu/)).toBeInTheDocument();

    rerender(
      <GameScreen
        {...props({
          gameState: gameState({ audioMode: 'host-only' }),
          disconnectedPlayer: { id: 'host', name: 'host', isHostDisconnected: true },
        })}
      />
    );
    expect(screen.getByText('🔈 Die Musik läuft beim Host')).toBeInTheDocument();
    expect(screen.getByText('Host hat die Verbindung verloren')).toBeInTheDocument();
  });
});

describe('ResultScreen', () => {
  type Props = ComponentProps<typeof ResultScreen>;
  const props = (overrides: Partial<Props> = {}): Props => ({
    players: [
      player('host', { score: 2, timeline: [song(1970), song(1985)] }),
      player('me', { score: 1, timeline: [song(1990)] }),
    ],
    isHost: true,
    lastSong: song(1985),
    lastCorrect: true,
    lastPlayerId: 'host',
    winnerLastSong: null,
    roomPlayers: null,
    onRestart: vi.fn(),
    onLeave: vi.fn(),
    ...overrides,
  });

  it('marks players who left the room or dropped, keeping their scores', () => {
    const { rerender } = render(
      <ResultScreen
        {...props({
          players: [player('host', { score: 2 }), player('me', { isConnected: false })],
        })}
      />
    );
    expect(screen.getByText('offline')).toBeInTheDocument();

    const finalPlayers = [player('host', { score: 2 }), player('me'), player('ben', { score: 1 })];
    rerender(
      <ResultScreen
        {...props({
          players: finalPlayers,
          roomPlayers: [player('host'), player('me', { isConnected: false })],
        })}
      />
    );
    expect(screen.getByText('verlassen')).toBeInTheDocument();
    expect(screen.getByText('offline')).toBeInTheDocument();
    // Names also appear as winner and timeline labels; only the ranking row has data-away.
    const awayOf = (name: string) =>
      screen
        .getAllByText(name)
        .map((el) => el.closest('[data-away]')?.getAttribute('data-away'))
        .find(Boolean);
    expect(awayOf('ben')).toBe('true');
    expect(awayOf('host')).toBe('false');
  });

  it('crowns the winner, recaps the last move and offers restart and leave', () => {
    const p = props();
    render(<ResultScreen {...p} />);
    expect(screen.getByText('gewinnt mit 2 Punkten!')).toBeInTheDocument();
    expect(screen.getByText(/richtig platziert/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('↻ Nochmal spielen'));
    fireEvent.click(screen.getByText('← Raum verlassen'));
    expect(p.onRestart).toHaveBeenCalled();
    expect(p.onLeave).toHaveBeenCalled();
  });

  it('handles ties, wrong last moves and guests', () => {
    render(
      <ResultScreen
        {...props({
          players: [
            player('host', { score: 1 }),
            player('me', { score: 1, timeline: [song(1990)] }),
          ],
          lastCorrect: false,
          lastPlayerId: 'me',
          lastSong: song(2001),
          winnerLastSong: song(1990),
          isHost: false,
        })}
      />
    );
    expect(screen.getByText('Unentschieden!')).toBeInTheDocument();
    expect(screen.getByText(/falsch platziert/)).toBeInTheDocument();
    expect(screen.getByText('2001')).toBeInTheDocument();
    expect(screen.queryByText('↻ Nochmal spielen')).not.toBeInTheDocument();
    expect(screen.getByText('← Raum verlassen')).toBeInTheDocument();
  });

  it('renders without a last move to recap', async () => {
    render(<ResultScreen {...props({ lastSong: null })} />);
    await waitFor(() => expect(screen.getAllByText('host').length).toBeGreaterThan(0));
  });
});
