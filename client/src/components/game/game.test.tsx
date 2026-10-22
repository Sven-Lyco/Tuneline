import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { SongCard } from './SongCard';
import { MyTimeline } from './MyTimeline';
import { OtherPlayers } from './OtherPlayers';
import { GameHeader } from './GameHeader';
import { DisconnectOverlay } from './DisconnectOverlay';
import { TurnTimer } from './TurnTimer';
import { player, song } from '../../test/data';

type SongCardProps = ComponentProps<typeof SongCard>;

const cardProps = (overrides: Partial<SongCardProps> = {}): SongCardProps => ({
  hasAudio: true,
  turnEndsAt: null,
  revealedSong: null,
  revealed: false,
  feedback: null,
  lastPlacedPlayerName: null,
  lastPlacedIsMe: false,
  playing: false,
  volume: 0.8,
  isMyTurn: true,
  activePlayerName: 'Anna',
  activePlayerColor: '#f00',
  onToggleAudio: vi.fn(),
  onVolumeChange: vi.fn(),
  ...overrides,
});

describe('SongCard', () => {
  it('hides everything about the song until it is revealed', () => {
    render(<SongCard {...cardProps({ revealedSong: song(1985, { title: 'Secret' }) })} />);
    expect(screen.getByText('Welcher Song ist das?')).toBeInTheDocument();
    expect(screen.getByText('???')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.queryByText('1985')).not.toBeInTheDocument();
    expect(
      screen.getByText('Wähle die richtige Position in deiner Timeline ↓')
    ).toBeInTheDocument();
  });

  it('shows the song and the verdict after the reveal', () => {
    const revealed = song(1985, { title: 'Secret', artist: 'Band', cover: 'https://c.jpg' });
    const { rerender } = render(
      <SongCard
        {...cardProps({
          revealed: true,
          revealedSong: revealed,
          feedback: 'ok',
          lastPlacedIsMe: true,
        })}
      />
    );
    expect(screen.getByText('Secret')).toBeInTheDocument();
    expect(screen.getByText('Band')).toBeInTheDocument();
    expect(screen.getByText('1985')).toBeInTheDocument();
    expect(screen.getByText('✓ Richtig! +1 Punkt für dich')).toBeInTheDocument();

    rerender(
      <SongCard
        {...cardProps({
          revealed: true,
          revealedSong: revealed,
          feedback: 'ok',
          lastPlacedPlayerName: 'Ben',
        })}
      />
    );
    expect(screen.getByText('✓ Richtig! +1 Punkt für Ben')).toBeInTheDocument();
    rerender(
      <SongCard {...cardProps({ revealed: true, revealedSong: revealed, feedback: 'no' })} />
    );
    expect(screen.getByText('✗ Falsch! Der Song war von 1985.')).toBeInTheDocument();
    rerender(
      <SongCard {...cardProps({ revealed: true, revealedSong: null, feedback: 'timeout' })} />
    );
    expect(screen.getByText('⏰ Zeit abgelaufen! Der Song war von ?.')).toBeInTheDocument();
  });

  it('controls the audio or explains that the host plays it', () => {
    const props = cardProps({ playing: true, volume: 0 });
    const { rerender } = render(<SongCard {...props} />);
    fireEvent.click(screen.getByText('⏸ Pause'));
    expect(props.onToggleAudio).toHaveBeenCalled();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.3' } });
    expect(props.onVolumeChange).toHaveBeenCalledWith(0.3);
    expect(screen.getByText('🔇')).toBeInTheDocument();

    rerender(<SongCard {...cardProps({ volume: 0.3 })} />);
    expect(screen.getByText('🔉')).toBeInTheDocument();
    rerender(<SongCard {...cardProps({ volume: 0.9 })} />);
    expect(screen.getByText('🔊')).toBeInTheDocument();

    rerender(<SongCard {...cardProps({ hasAudio: false, isMyTurn: false })} />);
    expect(screen.getByText('🔈 Die Musik läuft beim Host')).toBeInTheDocument();
    expect(screen.getByText('Warten auf Anna…')).toBeInTheDocument();
  });

  it('shows the countdown while a turn limit runs', () => {
    render(<SongCard {...cardProps({ turnEndsAt: Date.now() + 25_000 })} />);
    expect(screen.getByText('⏱ 25s')).toBeInTheDocument();
  });
});

describe('TurnTimer', () => {
  it('counts down and turns urgent in the last ten seconds', () => {
    vi.useFakeTimers();
    render(<TurnTimer endsAt={Date.now() + 12_000} />);
    expect(screen.getByText('⏱ 12s')).toHaveAttribute('data-urgent', 'false');
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.getByText('⏱ 9s')).toHaveAttribute('data-urgent', 'true');
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText('⏱ 0s')).toBeInTheDocument();
  });
});

describe('MyTimeline', () => {
  it('lets the active player pick a slot and highlights a correct placement', () => {
    const setSlot = vi.fn();
    const timeline = [song(1970), song(1990)];
    const { rerender } = render(
      <MyTimeline
        timeline={timeline}
        slot={null}
        setSlot={setSlot}
        revealed={false}
        isMyTurn
        feedback={null}
        revealedSong={null}
        centerKey={null}
      />
    );
    const zones = screen.getAllByLabelText('Song hier platzieren');
    expect(zones).toHaveLength(3);
    fireEvent.click(zones[0]);
    fireEvent.click(zones[2]);
    expect(setSlot).toHaveBeenNthCalledWith(1, 0);
    expect(setSlot).toHaveBeenNthCalledWith(2, 2);

    rerender(
      <MyTimeline
        timeline={timeline}
        slot={1}
        setSlot={setSlot}
        revealed
        isMyTurn
        feedback="ok"
        revealedSong={song(1990)}
        centerKey={null}
      />
    );
    fireEvent.click(zones[1]);
    expect(setSlot).toHaveBeenCalledTimes(2);
  });
});

describe('OtherPlayers', () => {
  it('shows timelines, empty ones and offline players', () => {
    const others = [
      player('Ben', { timeline: [song(1990), song(1970)] }),
      player('Cleo', { isConnected: false }),
    ];
    render(
      <OtherPlayers
        players={others}
        allPlayers={[player('me'), ...others]}
        currentPlayerId="Ben"
        turnKey={null}
      />
    );
    expect(screen.getByText('leer')).toBeInTheDocument();
    expect(screen.getByText('offline')).toBeInTheDocument();
    const years = screen.getAllByText(/^19\d\d$/).map((el) => el.textContent);
    expect(years).toEqual(['1970', '1990']);
  });
});

describe('GameHeader', () => {
  it('shows the round, room code and players', () => {
    render(
      <GameHeader
        roomCode="ROOM01"
        players={[player('host'), player('me', { isConnected: false })]}
        currentPlayerId="host"
        round={2}
        rounds={5}
        myPlayerId="me"
        turnKey={null}
      />
    );
    expect(screen.getByText('RUNDE 2/5')).toBeInTheDocument();
    expect(screen.getByText('ROOM01')).toBeInTheDocument();
    expect(screen.getByText('me (du) · offline')).toBeInTheDocument();
  });
});

describe('centring on a new turn', () => {
  const others = [player('Ben'), player('Cleo')];
  const timelineProps: Omit<ComponentProps<typeof MyTimeline>, 'centerKey'> = {
    timeline: [song(1970), song(1990)],
    slot: null,
    setSlot: () => {},
    revealed: false,
    isMyTurn: true,
    feedback: null,
    revealedSong: null,
  };

  it('scrolls my timeline once per turn key, never without one', () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
    const { rerender } = render(<MyTimeline {...timelineProps} centerKey={null} />);
    expect(scrollTo).not.toHaveBeenCalled();

    rerender(<MyTimeline {...timelineProps} centerKey="1:me" />);
    rerender(<MyTimeline {...timelineProps} centerKey="1:me" slot={1} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });

    rerender(<MyTimeline {...timelineProps} centerKey="2:me" />);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    scrollTo.mockRestore();
  });

  it('centres the panel of the player on turn, and nothing on my own turn', () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
    const panels = (currentPlayerId: string, turnKey: string) => (
      <OtherPlayers
        players={others}
        allPlayers={[player('me'), ...others]}
        currentPlayerId={currentPlayerId}
        turnKey={turnKey}
      />
    );
    const { rerender } = render(panels('me', '1:me'));
    expect(scrollTo).not.toHaveBeenCalled();
    rerender(panels('Cleo', '1:Cleo'));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockRestore();
  });

  it('jumps without animation when the system asks for reduced motion', () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    render(
      <GameHeader
        roomCode="ROOM01"
        players={[player('me'), ...others]}
        currentPlayerId="Ben"
        round={1}
        rounds={5}
        myPlayerId="me"
        turnKey="1:Ben"
      />
    );
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'auto' });
    matchMedia.mockRestore();
    scrollTo.mockRestore();
  });
});

describe('DisconnectOverlay', () => {
  it('lets the host skip a dropped player', () => {
    const onSkip = vi.fn();
    render(
      <DisconnectOverlay
        disconnectedPlayer={{ id: 'b', name: 'Ben', isHostDisconnected: false }}
        roomCode="ROOM01"
        isHost
        onSkipPlayer={onSkip}
      />
    );
    expect(screen.getByText('Ben hat die Verbindung verloren')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ohne Ben weiterspielen'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('tells guests to wait, also when the host is gone', () => {
    const { rerender } = render(
      <DisconnectOverlay
        disconnectedPlayer={{ id: 'b', name: 'Ben', isHostDisconnected: false }}
        roomCode="ROOM01"
        isHost={false}
        onSkipPlayer={() => {}}
      />
    );
    expect(screen.getByText(/Der Host entscheidet/)).toBeInTheDocument();
    rerender(
      <DisconnectOverlay
        disconnectedPlayer={{ id: 'h', name: 'Host', isHostDisconnected: true }}
        roomCode="ROOM01"
        isHost={false}
        onSkipPlayer={() => {}}
      />
    );
    expect(screen.getByText('Host hat die Verbindung verloren')).toBeInTheDocument();
    expect(screen.getByText(/innerhalb von 2 Minuten/)).toBeInTheDocument();
  });
});
