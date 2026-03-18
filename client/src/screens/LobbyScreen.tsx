import styled from '@emotion/styled';
import type { LobbyState, AudioMode } from '@tuneline/shared';
import type { SpotifyPlaylist } from '../types';
import { getPlayerColor } from '../constants';
import { Label } from '../components/Label';
import { RoomCodeCopy } from '../components/RoomCodeCopy';
import { PlaylistBadgeRow } from '../components/PlaylistBadgeRow';
import { AppTitle, AppSubtitle } from '../components/AppTitle';
import { CenteredScreen } from '../components/CenteredScreen';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { LinkButton } from '../components/LinkButton';
import { AudioModePicker } from '../components/AudioModePicker';
import { RoundsPicker } from '../components/RoundsPicker';

interface LobbyScreenProps {
  roomCode: string;
  lobbyState: LobbyState;
  myPlayerId: string;
  isHost: boolean;
  selectedPlaylists: SpotifyPlaylist[];
  onStart: () => void;
  onKick: (playerId: string) => void;
  onLeave: () => void;
  onAudioModeChange: (mode: AudioMode) => void;
  onRoundsChange: (rounds: number) => void;
  onChangePlaylists: () => void;
}

// ── Styles ─────────────────────────────────────────────────────

const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
`;

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  background: #1a1a26;
`;

const PlayerDot = styled.div<{ bg: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
  flex-shrink: 0;
`;

const PlayerName = styled.div<{ faded: string }>`
  flex: 1;
  font-size: 1rem;
  font-weight: 500;
  color: ${({ faded }) => (faded === 'true' ? '#4a4a6a' : '#e8e8f0')};
`;

const PlayerBadge = styled.div`
  font-size: 0.75rem;
  color: #7a7a8e;
  padding: 0.15rem 0.5rem;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
`;

const KickButton = styled.button`
  background: transparent;
  border: none;
  color: #ff4444;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
    background: rgba(255, 68, 68, 0.1);
  }
`;

const WaitingDots = styled.span`
  color: #7a7a8e;
  font-size: 0.9rem;
  animation: pulse 1.5s ease-in-out infinite;
`;

const WaitingMsg = styled.div`
  text-align: center;
  color: #7a7a8e;
  font-size: 0.95rem;
  padding: 1rem 0;
`;

// ── Component ──────────────────────────────────────────────────

export function LobbyScreen({
  roomCode,
  lobbyState,
  myPlayerId,
  isHost,
  selectedPlaylists,
  onStart,
  onKick,
  onLeave,
  onAudioModeChange,
  onRoundsChange,
  onChangePlaylists,
}: LobbyScreenProps) {
  const canStart = isHost && lobbyState.players.length >= 2;

  return (
    <CenteredScreen>
      <AppTitle size="sm" />
      <AppSubtitle style={{ marginBottom: '2rem' }}>Musik · Timeline · Challenge</AppSubtitle>

      <Card style={{ maxWidth: '480px' }}>
        <Label>Raum-Code</Label>
        <RoomCodeCopy roomCode={roomCode} />

        <Label>Spieler ({lobbyState.players.length})</Label>
        <PlayerList>
          {lobbyState.players.map((p, i) => (
            <PlayerRow key={p.id}>
              <PlayerDot bg={getPlayerColor(i)} />
              <PlayerName faded={String(!p.isConnected)}>{p.name}</PlayerName>
              {p.isHost && <PlayerBadge>Host</PlayerBadge>}
              {!p.isConnected && <PlayerBadge>offline</PlayerBadge>}
              {p.id === myPlayerId && !p.isHost && <PlayerBadge>du</PlayerBadge>}
              {isHost && !p.isHost && (
                <KickButton onClick={() => onKick(p.id)} title="Spieler entfernen">
                  ×
                </KickButton>
              )}
            </PlayerRow>
          ))}
          {lobbyState.players.length < 2 && <WaitingDots>Warten auf weitere Spieler…</WaitingDots>}
        </PlayerList>

        {isHost && (
          <>
            <Label>Audio</Label>
            <AudioModePicker value={lobbyState.audioMode} onChange={onAudioModeChange} />

            <Label>Runden</Label>
            <RoundsPicker value={lobbyState.rounds} onChange={onRoundsChange} />

            <Label>Playlisten</Label>
            <PlaylistBadgeRow
              playlists={selectedPlaylists}
              onChangePlaylists={onChangePlaylists}
              changeLabel="ändern →"
              changeLinkVariant="purple"
            />

            <PrimaryButton ready={canStart} onClick={onStart}>
              Spiel starten →
            </PrimaryButton>
          </>
        )}

        {!isHost && <WaitingMsg>Warten darauf, dass der Host das Spiel startet…</WaitingMsg>}
      </Card>

      <LinkButton variant="muted" style={{ marginTop: '1.25rem' }} onClick={onLeave}>
        ← Raum verlassen
      </LinkButton>
    </CenteredScreen>
  );
}
