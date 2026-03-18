import styled from '@emotion/styled';
import type { SpotifyPlaylist } from '../types';
import type { AudioMode } from '@tuneline/shared';
import { Label } from '../components/Label';
import { PlaylistBadgeRow } from '../components/PlaylistBadgeRow';
import { AppTitle, AppSubtitle } from '../components/AppTitle';
import { CenteredScreen } from '../components/CenteredScreen';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { AudioModePicker } from '../components/AudioModePicker';
import { RoundsPicker } from '../components/RoundsPicker';

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
    <CenteredScreen>
      <AppTitle />
      <AppSubtitle>Musik · Timeline · Challenge</AppSubtitle>

      <Card style={{ maxWidth: '450px' }}>
        <Label>Playlisten</Label>
        <PlaylistBadgeRow playlists={playlists} onChangePlaylists={onChangePlaylists} />

        <Label>Dein Name</Label>
        <NameInput
          placeholder="z.B. Alex"
          value={hostName}
          maxLength={30}
          onChange={(e) => setHostName(e.target.value)}
        />

        <Label>Audio</Label>
        <AudioModePicker value={audioMode} onChange={setAudioMode} />

        <Label>Runden</Label>
        <RoundsPicker value={rounds} onChange={setRounds} />

        <PrimaryButton onClick={onCreateRoom}>Raum erstellen →</PrimaryButton>
      </Card>
    </CenteredScreen>
  );
}
