import styled from '@emotion/styled';
import type { LobbyState, AudioMode } from '@tuneline/shared';
import type { SpotifyPlaylist } from '../types';
import { PLAYER_COLORS } from '../constants';
import { Label } from '../components/Label';
import { RoomCodeCopy } from '../components/RoomCodeCopy';
import { PlaylistBadge, PlaylistBadgeCover, PlaylistBadgeName } from '../components/PlaylistBadge';

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

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
  position: relative;
  z-index: 1;
`;

const Header = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: clamp(1.8rem, 6vw, 3.5rem);
  font-weight: 700;
  letter-spacing: -2px;
  background: linear-gradient(135deg, #ff2d78, #a855f7, #06d6a0);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: float 4s ease-in-out infinite;
  margin-bottom: 4px;
`;

const Subtitle = styled.div`
  font-size: 0.8rem;
  color: #7a7a8e;
  letter-spacing: 4px;
  text-transform: uppercase;
  font-weight: 300;
  margin-bottom: 2rem;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 480px;
`;


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

const AudioModeRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const ModeButton = styled.button<{ active: string }>`
  flex: 1;
  padding: 0.45rem;
  border-radius: 10px;
  border: 1.5px solid ${({ active }) => (active === 'true' ? '#a855f7' : '#2a2a3a')};
  background: ${({ active }) => (active === 'true' ? 'rgba(168,85,247,0.08)' : 'transparent')};
  color: ${({ active }) => (active === 'true' ? '#a855f7' : '#7a7a8e')};
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  cursor: pointer;

  &:hover {
    border-color: #a855f7;
    color: #a855f7;
  }
`;

const RoundsRow = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
`;

const RoundButton = styled.button<{ active: string }>`
  flex: 1;
  padding: 0.5rem;
  border-radius: 10px;
  border: 1.5px solid ${({ active }) => (active === 'true' ? '#06d6a0' : '#2a2a3a')};
  background: ${({ active }) => (active === 'true' ? 'rgba(6, 214, 160, 0.07)' : 'transparent')};
  color: ${({ active }) => (active === 'true' ? '#06d6a0' : '#7a7a8e')};
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  cursor: pointer;

  &:hover {
    border-color: #06d6a0;
    color: #06d6a0;
  }
`;

const StartButton = styled.button<{ ready: string }>`
  width: 100%;
  padding: 0.85rem;
  border-radius: 14px;
  border: none;
  background: ${({ ready }) =>
    ready === 'true' ? 'linear-gradient(135deg, #ff2d78, #a855f7)' : '#1e1e2e'};
  color: ${({ ready }) => (ready === 'true' ? '#fff' : '#444')};
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  cursor: ${({ ready }) => (ready === 'true' ? 'pointer' : 'not-allowed')};
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const WaitingMsg = styled.div`
  text-align: center;
  color: #7a7a8e;
  font-size: 0.95rem;
  padding: 1rem 0;
`;

const LeaveLink = styled.button`
  background: transparent;
  border: none;
  color: #4a4a6a;
  font-family: 'Outfit', sans-serif;
  font-size: 0.78rem;
  cursor: pointer;
  margin-top: 1.25rem;
  text-decoration: underline;

  &:hover {
    color: #7a7a8e;
  }
`;

const PlaylistRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;


const ChangePlaylistLink = styled.button`
  background: transparent;
  border: none;
  color: #a855f7;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    text-decoration: underline;
  }
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
    <Screen>
      <Header>TUNELINE</Header>
      <Subtitle>Musik · Timeline · Challenge</Subtitle>

      <Card>
        <Label>Raum-Code</Label>
        <RoomCodeCopy roomCode={roomCode} />

        <Label>Spieler ({lobbyState.players.length})</Label>
        <PlayerList>
          {lobbyState.players.map((p, i) => (
            <PlayerRow key={p.id}>
              <PlayerDot bg={PLAYER_COLORS[i] ?? '#7a7a8e'} />
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
          {lobbyState.players.length < 2 && (
            <WaitingDots>Warten auf weitere Spieler…</WaitingDots>
          )}
        </PlayerList>

        {isHost && (
          <>
            <Label>Audio</Label>
            <AudioModeRow>
              <ModeButton
                active={String(lobbyState.audioMode === 'all')}
                onClick={() => onAudioModeChange('all')}
              >
                🔊 Alle hören
              </ModeButton>
              <ModeButton
                active={String(lobbyState.audioMode === 'host-only')}
                onClick={() => onAudioModeChange('host-only')}
              >
                📺 Nur Host
              </ModeButton>
            </AudioModeRow>

            <Label>Runden</Label>
            <RoundsRow>
              {[5, 10, 15, 20].map((n) => (
                <RoundButton
                  key={n}
                  active={String(lobbyState.rounds === n)}
                  onClick={() => onRoundsChange(n)}
                >
                  {n}
                </RoundButton>
              ))}
            </RoundsRow>

            <Label>Playlisten</Label>
            <PlaylistRow>
              {selectedPlaylists.length === 0 ? (
                <PlaylistBadge style={{ color: '#4a4a6a', background: 'none', border: '1px solid #2a2a3a' }}>Keine gewählt</PlaylistBadge>
              ) : (
                selectedPlaylists.map((p) => (
                  <PlaylistBadge key={p.id}>
                    {p.coverUrl && <PlaylistBadgeCover src={p.coverUrl} alt={p.name} />}
                    <PlaylistBadgeName>{p.name}</PlaylistBadgeName>
                  </PlaylistBadge>
                ))
              )}
              <ChangePlaylistLink onClick={onChangePlaylists}>ändern →</ChangePlaylistLink>
            </PlaylistRow>

            <StartButton ready={String(canStart)} disabled={!canStart} onClick={onStart}>
              Spiel starten →
            </StartButton>
          </>
        )}

        {!isHost && (
          <WaitingMsg>Warten darauf, dass der Host das Spiel startet…</WaitingMsg>
        )}
      </Card>

      <LeaveLink onClick={onLeave}>← Raum verlassen</LeaveLink>
    </Screen>
  );
}
