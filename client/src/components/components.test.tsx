import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AppTitle, AppSubtitle } from './AppTitle';
import { AudioModePicker } from './AudioModePicker';
import { Confetti } from './Confetti';
import { DropZone } from './DropZone';
import { ErrorBoundary } from './ErrorBoundary';
import { GlobalStyles } from './GlobalStyles';
import { InviteQr } from './InviteQr';
import { Label } from './Label';
import { LinkButton } from './LinkButton';
import { PillButton } from './PillButton';
import { PlayerChip } from './PlayerChip';
import { PlaylistBadgeRow } from './PlaylistBadgeRow';
import { PrimaryButton } from './PrimaryButton';
import { Reactions } from './Reactions';
import { ResumeBanner } from './ResumeBanner';
import { RoomCodeCopy } from './RoomCodeCopy';
import { RoundsPicker } from './RoundsPicker';
import { SongTile } from './SongTile';
import { TurnLimitPicker } from './TurnLimitPicker';
import { Vinyl } from './Vinyl';
import { Wave } from './Wave';
import { emittedPayloads, serverEmit } from '../test/fakeSocket';
import { player, playlist } from '../test/data';

describe('basic building blocks', () => {
  it('render titles, labels and buttons', () => {
    const onClick = vi.fn();
    render(
      <>
        <GlobalStyles />
        <AppTitle />
        <AppTitle size="sm" animate={false} />
        <AppSubtitle>Sub</AppSubtitle>
        <Label>Runden</Label>
        <LinkButton onClick={onClick}>Link</LinkButton>
        <LinkButton variant="muted">Muted</LinkButton>
        <PrimaryButton ready={false}>Not ready</PrimaryButton>
        <PrimaryButton variant="purple-teal">Go</PrimaryButton>
        <PillButton active color="teal">
          Pill
        </PillButton>
        <Wave active />
        <Wave active={false} />
        <Vinyl spinning cover="https://cover.jpg" />
        <Vinyl spinning={false} cover={null} size={60} />
        <SongTile year={1980} title="T" artist="A" highlight variant="timeline" />
        <SongTile year="?" title="T" artist="A" variant="result" />
        <Confetti />
      </>
    );
    expect(screen.getAllByText('TUNELINE')).toHaveLength(2);
    expect(screen.getByText('Not ready')).toBeDisabled();
    fireEvent.click(screen.getByText('Link'));
    expect(onClick).toHaveBeenCalled();
    expect(document.querySelector('[style*="cover.jpg"]')).not.toBeNull();
  });

  it('show player chips for active, own and offline players', () => {
    render(
      <>
        <PlayerChip name="Anna" color="#f00" score={3} isActive isMe />
        <PlayerChip name="Ben" color="#0f0" offline />
      </>
    );
    expect(screen.getByText('Anna (du)')).toBeInTheDocument();
    expect(screen.getByText('Ben · offline')).toBeInTheDocument();
    expect(screen.getByTitle('Ben ist offline')).toHaveAttribute('data-offline', 'true');
  });
});

describe('pickers', () => {
  it('report the chosen value', () => {
    const onRounds = vi.fn();
    const onLimit = vi.fn();
    const onMode = vi.fn();
    render(
      <>
        <RoundsPicker value={5} onChange={onRounds} />
        <TurnLimitPicker value={0} onChange={onLimit} />
        <AudioModePicker value="all" onChange={onMode} />
      </>
    );
    fireEvent.click(screen.getByText('10'));
    fireEvent.click(screen.getByText('60s'));
    expect(screen.getByText('Aus')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Nur Host/));
    fireEvent.click(screen.getByText(/Alle hören/));
    expect(onRounds).toHaveBeenCalledWith(10);
    expect(onLimit).toHaveBeenCalledWith(60);
    expect(onMode).toHaveBeenCalledWith('host-only');
    expect(onMode).toHaveBeenCalledWith('all');
  });

  it('list playlists with a change link', () => {
    const onChange = vi.fn();
    render(
      <PlaylistBadgeRow
        playlists={[playlist('a'), playlist('b', { coverUrl: null })]}
        onChangePlaylists={onChange}
        changeLabel="ändern →"
        changeLinkVariant="purple"
      />
    );
    expect(screen.getByText('Playlist a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ändern →'));
    expect(onChange).toHaveBeenCalled();
  });

  it('shows a hint without playlists', () => {
    render(<PlaylistBadgeRow playlists={[]} onChangePlaylists={() => {}} />);
    expect(document.body.textContent).toMatch(/Playlist|gewählt|wählen/i);
  });
});

describe('DropZone', () => {
  it('reacts to clicks and hover only when enabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<DropZone active={false} onClick={onClick} disabled={false} />);
    const zone = screen.getByLabelText('Song hier platzieren');
    fireEvent.mouseEnter(zone);
    fireEvent.mouseLeave(zone);
    fireEvent.click(zone);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<DropZone active onClick={onClick} disabled />);
    fireEvent.mouseEnter(zone);
    fireEvent.click(zone);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorBoundary', () => {
  it('shows a reload screen when a child crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
    function Boom(): never {
      throw new Error('kaputt');
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Unerwarteter Fehler')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Neu laden'));
    expect(reload).toHaveBeenCalled();
  });

  it('renders children otherwise and handles non-Error throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <ErrorBoundary>
        <span>ok</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
    unmount();
    function Throws(): never {
      throw 'plain string';
    }
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>
    );
    expect(screen.getByText('Unerwarteter Fehler')).toBeInTheDocument();
  });
});

describe('RoomCodeCopy', () => {
  it('copies the invite link in both variants', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    render(
      <>
        <RoomCodeCopy roomCode="ROOM01" />
        <RoomCodeCopy roomCode="ROOM02" variant="badge" />
      </>
    );
    fireEvent.click(screen.getByText('ROOM01'));
    expect(screen.getByText('✓')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ROOM02'));
    expect(screen.getByText('✓ Kopiert')).toBeInTheDocument();
  });
});

describe('InviteQr', () => {
  const dialog = () => screen.queryByRole('dialog', { name: 'QR-Code zum Beitreten' });

  it('shows the invite link as a QR code', () => {
    render(<InviteQr roomCode="ROOM01" />);
    expect(dialog()).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('QR-Code zeigen'));
    expect(within(dialog()!).getByText('ROOM01')).toBeInTheDocument();
    // The SVG's title is the encoded link, the same one the copy button copies.
    expect(
      within(dialog()!).getByTitle(`${window.location.origin}/?room=ROOM01`)
    ).toBeInTheDocument();
  });

  it('closes via ✕, Escape or a tap next to it, but not on the code itself', () => {
    render(<InviteQr roomCode="ROOM01" variant="badge" />);
    const open = () => fireEvent.click(screen.getByTitle('QR-Code zum Beitreten'));

    open();
    fireEvent.click(screen.getByLabelText('Schließen'));
    expect(dialog()).not.toBeInTheDocument();

    open();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).not.toBeInTheDocument();

    open();
    fireEvent.click(dialog()!);
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(dialog()!.parentElement!);
    expect(dialog()).not.toBeInTheDocument();
  });
});

describe('Reactions', () => {
  it('sends a picked emoji and shows incoming reactions for a while', () => {
    vi.useFakeTimers();
    render(<Reactions players={[player('host'), player('me')]} />);
    fireEvent.click(screen.getByTitle('Reaction senden'));
    fireEvent.click(screen.getByText('🔥'));
    expect(emittedPayloads('send_reaction')).toEqual([{ emoji: '🔥' }]);

    serverEmit('reaction_received', { playerId: 'me', playerName: 'me', emoji: '🥳' });
    serverEmit('reaction_received', { playerId: 'ghost', playerName: 'ghost', emoji: '😂' });
    expect(screen.getByText('🥳')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText('🥳')).not.toBeInTheDocument();
  });
});

describe('ResumeBanner', () => {
  it('offers to go back or dismiss', () => {
    const onResume = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ResumeBanner
        room={{ roomCode: 'ROOM01', playerToken: 't', playerName: 'Anna', savedAt: 0 }}
        onResume={onResume}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Du warst in Raum ROOM01 als Anna.');
    fireEvent.click(screen.getByText('Zurück ins Spiel'));
    fireEvent.click(screen.getByLabelText('Hinweis schließen'));
    expect(onResume).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});
