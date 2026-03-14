import styled from '@emotion/styled';
import type { SpotifyPlaylist } from '../types';
import type { AudioMode } from '@tuneline/shared';
import { Label } from '../components/Label';
import { PlaylistBadge, PlaylistBadgeCover, PlaylistBadgeName } from '../components/PlaylistBadge';

interface MenuScreenProps {
  playlists: SpotifyPlaylist[];
  hostName: string;
  setHostName: (name: string) => void;
  rounds: number;
  setRounds: (rounds: number) => void;
  audioMode: AudioMode;
  setAudioMode: (mode: AudioMode) => void;
  onCreateRoom: () => void;
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

const Title = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 700;
  letter-spacing: -3px;
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
  margin-bottom: 2.5rem;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 450px;
`;

const PlaylistRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.4rem;
  flex-wrap: wrap;
`;


const ChangeLink = styled.button`
  background: transparent;
  border: none;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.2rem 0;
  text-decoration: underline;

  &:hover {
    color: #9a9aae;
  }
`;

const NameInput = styled.input`
  width: 100%;
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  border: 1.5px solid #2a2a3a;
  background: #08080d;
  color: #e8e8f0;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  outline: none;
  margin-bottom: 1.4rem;
  box-sizing: border-box;

  &:focus {
    border-color: #3a3a5a;
  }
`;

const AudioRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.4rem;
`;

const ModeButton = styled.button<{ active: string }>`
  flex: 1;
  padding: 0.45rem;
  border-radius: 10px;
  border: 1.5px solid ${({ active }) => (active === 'true' ? '#a855f7' : '#2a2a3a')};
  background: ${({ active }) =>
    active === 'true' ? 'rgba(168,85,247,0.08)' : 'transparent'};
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
  margin-bottom: 1.4rem;
`;

const RoundButton = styled.button<{ active: string }>`
  flex: 1;
  padding: 0.5rem;
  border-radius: 10px;
  border: 1.5px solid ${({ active }) => (active === 'true' ? '#06d6a0' : '#2a2a3a')};
  background: ${({ active }) =>
    active === 'true' ? 'rgba(6, 214, 160, 0.07)' : 'transparent'};
  color: ${({ active }) => (active === 'true' ? '#06d6a0' : '#7a7a8e')};
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    border-color: #06d6a0;
    color: #06d6a0;
  }
`;

const CreateButton = styled.button`
  width: 100%;
  padding: 0.85rem;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  color: white;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 1px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
`;

// ── Component ──────────────────────────────────────────────────

export function MenuScreen({
  playlists,
  hostName,
  setHostName,
  rounds,
  setRounds,
  audioMode,
  setAudioMode,
  onCreateRoom,
  onChangePlaylists,
}: MenuScreenProps) {
  return (
    <Screen>
      <Title>TUNELINE</Title>
      <Subtitle>Musik · Timeline · Challenge</Subtitle>

      <Card>
        <Label>Playlisten</Label>
        <PlaylistRow>
          {playlists.map((p) => (
            <PlaylistBadge key={p.id}>
              {p.coverUrl && <PlaylistBadgeCover src={p.coverUrl} alt={p.name} />}
              <PlaylistBadgeName>{p.name}</PlaylistBadgeName>
            </PlaylistBadge>
          ))}
          <ChangeLink onClick={onChangePlaylists}>ändern</ChangeLink>
        </PlaylistRow>

        <Label>Dein Name</Label>
        <NameInput
          placeholder="z.B. Alex"
          value={hostName}
          maxLength={30}
          onChange={(e) => setHostName(e.target.value)}
        />

        <Label>Audio</Label>
        <AudioRow>
          <ModeButton
            active={String(audioMode === 'all')}
            onClick={() => setAudioMode('all')}
          >
            🔊 Alle hören
          </ModeButton>
          <ModeButton
            active={String(audioMode === 'host-only')}
            onClick={() => setAudioMode('host-only')}
          >
            📺 Nur Host
          </ModeButton>
        </AudioRow>

        <Label>Runden</Label>
        <RoundsRow>
          {[5, 10, 15, 20].map((n) => (
            <RoundButton key={n} active={String(rounds === n)} onClick={() => setRounds(n)}>
              {n}
            </RoundButton>
          ))}
        </RoundsRow>

        <CreateButton onClick={onCreateRoom}>Raum erstellen →</CreateButton>
      </Card>
    </Screen>
  );
}
