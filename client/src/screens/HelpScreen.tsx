import { useState } from 'react';
import styled from '@emotion/styled';
import { Vinyl } from '../components/Vinyl';
import { DropZone } from '../components/DropZone';
import { PLAYER_COLORS } from '../constants';

interface HelpScreenProps {
  onBack: () => void;
}

// ── Layout ────────────────────────────────────────────────────────

const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem 4rem;
  position: relative;
  z-index: 1;
`;

const Header = styled.div`
  width: 100%;
  max-width: 560px;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const BackButton = styled.button`
  background: transparent;
  border: 1.5px solid #2a2a3a;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #7a7a8e;
  font-size: 1.1rem;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    border-color: #ff2d78;
    color: #ff2d78;
  }
`;

const HeaderTitle = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: #e8e8f0;
  letter-spacing: 1px;
`;

// ── Tabs ──────────────────────────────────────────────────────────

const TabBar = styled.div`
  width: 100%;
  max-width: 560px;
  display: flex;
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 14px;
  padding: 4px;
  gap: 4px;
  margin-bottom: 2rem;
`;

const Tab = styled.button<{ active: string }>`
  flex: 1;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  border: none;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${({ active }) => (active === 'true' ? '#ff2d78' : 'transparent')};
  color: ${({ active }) => (active === 'true' ? '#fff' : '#7a7a8e')};

  &:hover {
    color: ${({ active }) => (active === 'true' ? '#fff' : '#b8b8cc')};
  }
`;

// ── Step cards ────────────────────────────────────────────────────

const Steps = styled.div`
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const StepCard = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 18px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const StepNumber = styled.div<{ color: string }>`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: ${({ color }) => `${color}22`};
  border: 1.5px solid ${({ color }) => color};
  color: ${({ color }) => color};
  font-family: 'Space Mono', monospace;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const StepText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const StepTitle = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #e8e8f0;
`;

const StepDesc = styled.div`
  font-size: 0.85rem;
  color: #7a7a8e;
  line-height: 1.5;
`;

// ── Visual mockups ────────────────────────────────────────────────

const MockupBox = styled.div`
  background: #0d0d16;
  border: 1px solid #1e1e2e;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

// Code input mockup
const MockCode = styled.div`
  display: flex;
  gap: 6px;
`;

const MockCodeChar = styled.div<{ filled: string }>`
  width: 38px;
  height: 48px;
  border-radius: 8px;
  border: 2px solid ${({ filled }) => (filled === 'true' ? '#ff2d78' : '#2a2a3a')};
  background: ${({ filled }) => (filled === 'true' ? '#ff2d7810' : '#12121a')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: ${({ filled }) => (filled === 'true' ? '#ff2d78' : '#2a2a3a')};
`;

// Player chips mockup
const MockChips = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
`;

const MockChip = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: ${({ color }) => `${color}15`};
  border: 1.5px solid ${({ color }) => `${color}60`};
`;

const MockChipDot = styled.div<{ color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ color }) => color};
`;

const MockChipName = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #e8e8f0;
`;

// Song card mockup (simplified)
const MockSongCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #16162000;
`;

const MockSongInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MockSongTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 700;
  color: #e8e8f0;
`;

const MockSongArtist = styled.div`
  font-size: 0.78rem;
  color: #7a7a8e;
`;

const MockSongYear = styled.div`
  font-size: 0.78rem;
  color: #4a4a6a;
  font-style: italic;
`;

const MockPlayBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ff2d7818;
  border: 1px solid #ff2d7840;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: #ff2d78;
  font-weight: 600;
`;

// Timeline mockup
const MockTimeline = styled.div`
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 0.5rem 0;
  gap: 0;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #12121a;
  }
  &::-webkit-scrollbar-thumb {
    background: #2a2a3a;
    border-radius: 2px;
  }
`;

const MockSongTile = styled.div<{ unknown?: string }>`
  background: ${({ unknown }) => (unknown === 'true' ? '#1a1014' : '#1a1a26')};
  border: 2px solid ${({ unknown }) => (unknown === 'true' ? '#ff2d7860' : '#2a2a3a')};
  border-radius: 12px;
  padding: 0.65rem 0.85rem;
  text-align: center;
  min-width: 110px;
  flex-shrink: 0;
`;

const MockTileYear = styled.div<{ unknown?: string }>`
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: ${({ unknown }) => (unknown === 'true' ? '#ff2d78' : '#ff2d78')};
  margin-bottom: 3px;
`;

const MockTileTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #e8e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
`;

const MockTileArtist = styled.div`
  font-size: 0.65rem;
  color: #7a7a8e;
`;

// Feedback mockup
const MockFeedbackRow = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
`;

const MockFeedback = styled.div<{ ok: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.65rem 1.25rem;
  border-radius: 12px;
  background: ${({ ok }) => (ok === 'true' ? '#06d6a018' : '#ff444418')};
  border: 1.5px solid ${({ ok }) => (ok === 'true' ? '#06d6a060' : '#ff444460')};
  font-size: 0.85rem;
  font-weight: 700;
  color: ${({ ok }) => (ok === 'true' ? '#06d6a0' : '#ff6b6b')};
`;

// Score mockup
const MockScoreRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
`;

const MockScore = styled.div<{ highlight: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  background: ${({ highlight }) => (highlight === 'true' ? '#fbbf2415' : '#12121a')};
  border: 1.5px solid ${({ highlight }) => (highlight === 'true' ? '#fbbf2470' : '#2a2a3a')};
`;

const MockScoreName = styled.div<{ color: string }>`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${({ color }) => color};
`;

const MockScorePoints = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: #e8e8f0;
`;

// Spotify button mockup
const MockSpotifyBtn = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.75rem 1.5rem;
  border-radius: 50px;
  background: #1db954;
  color: #000;
  font-weight: 700;
  font-size: 0.9rem;
`;

// Playlist card mockup
const MockPlaylist = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  border-radius: 12px;
  background: #1a1a26;
  border: 2px solid #ff2d7860;
  min-width: 180px;
`;

const MockPlaylistCover = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  flex-shrink: 0;
`;

const MockPlaylistInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MockPlaylistName = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #e8e8f0;
`;

const MockPlaylistCount = styled.div`
  font-size: 0.72rem;
  color: #7a7a8e;
`;

const MockCheckmark = styled.div`
  margin-left: auto;
  color: #ff2d78;
  font-size: 1rem;
`;

// Settings mockup
const MockSettings = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
`;

const MockSettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;

const MockSettingLabel = styled.div`
  font-size: 0.82rem;
  color: #7a7a8e;
`;

const MockPillGroup = styled.div`
  display: flex;
  gap: 4px;
`;

const MockPill = styled.div<{ active: string }>`
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${({ active }) => (active === 'true' ? '#ff2d7820' : 'transparent')};
  border: 1px solid ${({ active }) => (active === 'true' ? '#ff2d78' : '#2a2a3a')};
  color: ${({ active }) => (active === 'true' ? '#ff2d78' : '#4a4a6a')};
`;

// Room code display mockup
const MockRoomCode = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
`;

const MockRoomCodeLabel = styled.div`
  font-size: 0.72rem;
  color: #4a4a6a;
  letter-spacing: 3px;
  text-transform: uppercase;
`;

const MockRoomCodeValue = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 2rem;
  font-weight: 700;
  color: #ff2d78;
  letter-spacing: 6px;
  text-shadow: 0 0 20px rgba(255, 45, 120, 0.4);
`;

// Start button mockup
const MockStartBtn = styled.div`
  padding: 0.75rem 2rem;
  border-radius: 50px;
  background: linear-gradient(135deg, #06d6a0, #04b890);
  color: #08080d;
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: 0.5px;
`;

// ── Tab content ───────────────────────────────────────────────────

const DUMMY_CODE = ['6', 'E', 'R', '2', 'T', '5'];

const DUMMY_PLAYERS = [
  { name: 'Anna', color: PLAYER_COLORS[0] },
  { name: 'Lukas', color: PLAYER_COLORS[1] },
  { name: 'Mia', color: PLAYER_COLORS[2] },
  { name: 'Tim', color: PLAYER_COLORS[3] },
];

function PlayerTab() {
  return (
    <Steps>
      {/* Step 1 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#ff2d78">1</StepNumber>
          <StepText>
            <StepTitle>Raum beitreten</StepTitle>
            <StepDesc>
              Gib den 6-stelligen Raum-Code ein, den der Host mit dir teilt. Kein Spotify-Konto
              nötig.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockCode>
            {DUMMY_CODE.map((char, i) => (
              <MockCodeChar key={i} filled="true">
                {char}
              </MockCodeChar>
            ))}
          </MockCode>
        </MockupBox>
      </StepCard>

      {/* Step 2 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#a855f7">2</StepNumber>
          <StepText>
            <StepTitle>In der Lobby warten</StepTitle>
            <StepDesc>
              Wähle deinen Namen. Sobald alle da sind, startet der Host das Spiel.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockChips>
            {DUMMY_PLAYERS.map((p) => (
              <MockChip key={p.name} color={p.color}>
                <MockChipDot color={p.color} />
                <MockChipName>{p.name}</MockChipName>
              </MockChip>
            ))}
          </MockChips>
        </MockupBox>
      </StepCard>

      {/* Step 3 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#06d6a0">3</StepNumber>
          <StepText>
            <StepTitle>Song anhören</StepTitle>
            <StepDesc>
              Wenn du dran bist, wird ein 30-Sekunden-Preview gespielt. Titel und Jahr sind
              verborgen — rate, aus welchem Jahr der Song stammt.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockSongCard>
            <Vinyl spinning={true} cover={null} size={64} />
            <MockSongInfo>
              <MockSongTitle>???</MockSongTitle>
              <MockSongArtist>Unbekannter Interpret</MockSongArtist>
              <MockSongYear>Jahr: verborgen</MockSongYear>
            </MockSongInfo>
          </MockSongCard>
          <MockPlayBadge>▶ Preview läuft</MockPlayBadge>
        </MockupBox>
      </StepCard>

      {/* Step 4 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#fbbf24">4</StepNumber>
          <StepText>
            <StepTitle>Song in die Timeline einordnen</StepTitle>
            <StepDesc>
              Tippe auf einen der Slots (|) in deiner Timeline, um den Song dort zu platzieren.
              Du musst ihn chronologisch richtig einordnen.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#4a4a6a', letterSpacing: '2px', textAlign: 'center', textTransform: 'uppercase' }}>— Deine Timeline —</div>
          <MockTimeline>
            <DropZone active={false} onClick={() => {}} disabled={false} />
            <MockSongTile>
              <MockTileYear>1979</MockTileYear>
              <MockTileTitle>Highway to Hell</MockTileTitle>
              <MockTileArtist>AC/DC</MockTileArtist>
            </MockSongTile>
            <DropZone active={true} onClick={() => {}} disabled={false} />
            <MockSongTile unknown="true">
              <MockTileYear style={{ color: '#ff2d78' }}>???</MockTileYear>
              <MockTileTitle>Neuer Song</MockTileTitle>
              <MockTileArtist>Zum Platzieren</MockTileArtist>
            </MockSongTile>
            <DropZone active={false} onClick={() => {}} disabled={false} />
            <MockSongTile>
              <MockTileYear>1994</MockTileYear>
              <MockTileTitle>Creep</MockTileTitle>
              <MockTileArtist>Radiohead</MockTileArtist>
            </MockSongTile>
            <DropZone active={false} onClick={() => {}} disabled={false} />
          </MockTimeline>
        </MockupBox>
      </StepCard>

      {/* Step 5 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#38bdf8">5</StepNumber>
          <StepText>
            <StepTitle>Punkte sammeln & gewinnen</StepTitle>
            <StepDesc>
              Richtig platziert = 1 Punkt und der Song bleibt in deiner Timeline. Falsch = kein
              Punkt. Wer am Ende die meisten Songs hat, gewinnt!
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox style={{ flexDirection: 'column', gap: '0.75rem' }}>
          <MockFeedbackRow>
            <MockFeedback ok="true">✓ Richtig! +1 Punkt</MockFeedback>
            <MockFeedback ok="false">✗ Leider falsch</MockFeedback>
          </MockFeedbackRow>
          <MockScoreRow>
            {DUMMY_PLAYERS.map((p, i) => (
              <MockScore key={p.name} highlight={i === 0 ? 'true' : 'false'}>
                <MockScoreName color={p.color}>{p.name}</MockScoreName>
                <MockScorePoints>{[5, 3, 3, 2][i]}</MockScorePoints>
              </MockScore>
            ))}
          </MockScoreRow>
        </MockupBox>
      </StepCard>
    </Steps>
  );
}

function HostTab() {
  return (
    <Steps>
      {/* Step 1 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#1db954">1</StepNumber>
          <StepText>
            <StepTitle>Mit Spotify einloggen</StepTitle>
            <StepDesc>
              Als Host brauchst du ein Spotify-Konto (Free reicht). Der Login läuft sicher über
              Spotify — wir speichern keine Passwörter.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockSpotifyBtn>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Mit Spotify einloggen
          </MockSpotifyBtn>
        </MockupBox>
      </StepCard>

      {/* Step 2 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#ff2d78">2</StepNumber>
          <StepText>
            <StepTitle>Playlist auswählen</StepTitle>
            <StepDesc>
              Wähle eine oder mehrere deiner Spotify-Playlisten. Je mehr Songs, desto mehr Abwechslung. Playlists mit mindestens 20 Songs empfohlen.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockPlaylist>
            <MockPlaylistCover />
            <MockPlaylistInfo>
              <MockPlaylistName>80s & 90s Hits</MockPlaylistName>
              <MockPlaylistCount>142 Songs</MockPlaylistCount>
            </MockPlaylistInfo>
            <MockCheckmark>✓</MockCheckmark>
          </MockPlaylist>
        </MockupBox>
      </StepCard>

      {/* Step 3 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#a855f7">3</StepNumber>
          <StepText>
            <StepTitle>Spieleinstellungen wählen</StepTitle>
            <StepDesc>
              Lege die Rundenanzahl fest und wähle den Audio-Modus: Jeder hört auf seinem Gerät, oder nur der Host spielt den Sound ab.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockSettings>
            <MockSettingRow>
              <MockSettingLabel>Runden</MockSettingLabel>
              <MockPillGroup>
                {[3, 5, 7, 10].map((r) => (
                  <MockPill key={r} active={r === 5 ? 'true' : 'false'}>
                    {r}
                  </MockPill>
                ))}
              </MockPillGroup>
            </MockSettingRow>
            <MockSettingRow>
              <MockSettingLabel>Audio</MockSettingLabel>
              <MockPillGroup>
                <MockPill active="true">Alle</MockPill>
                <MockPill active="false">Nur Host</MockPill>
              </MockPillGroup>
            </MockSettingRow>
          </MockSettings>
        </MockupBox>
      </StepCard>

      {/* Step 4 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#fbbf24">4</StepNumber>
          <StepText>
            <StepTitle>Code mit Freunden teilen</StepTitle>
            <StepDesc>
              Nach dem Erstellen des Raums bekommst du einen 6-stelligen Code. Teile ihn mit deinen Mitspielern — sie brauchen kein Spotify.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox>
          <MockRoomCode>
            <MockRoomCodeLabel>Raum-Code</MockRoomCodeLabel>
            <MockRoomCodeValue>6ER2T5</MockRoomCodeValue>
          </MockRoomCode>
        </MockupBox>
      </StepCard>

      {/* Step 5 */}
      <StepCard>
        <StepHeader>
          <StepNumber color="#06d6a0">5</StepNumber>
          <StepText>
            <StepTitle>Spiel starten</StepTitle>
            <StepDesc>
              Sobald alle Spieler in der Lobby sind, kannst du das Spiel starten. Du kannst auch einzelne Spieler kicken oder Einstellungen noch anpassen.
            </StepDesc>
          </StepText>
        </StepHeader>
        <MockupBox style={{ flexDirection: 'column', gap: '0.75rem' }}>
          <MockChips>
            {DUMMY_PLAYERS.map((p) => (
              <MockChip key={p.name} color={p.color}>
                <MockChipDot color={p.color} />
                <MockChipName>{p.name}</MockChipName>
              </MockChip>
            ))}
          </MockChips>
          <MockStartBtn>Spiel starten →</MockStartBtn>
        </MockupBox>
      </StepCard>
    </Steps>
  );
}

// ── Main component ────────────────────────────────────────────────

export function HelpScreen({ onBack }: HelpScreenProps) {
  const [tab, setTab] = useState<'player' | 'host'>('player');

  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack}>←</BackButton>
        <HeaderTitle>Wie wird gespielt?</HeaderTitle>
      </Header>

      <TabBar>
        <Tab active={tab === 'player' ? 'true' : 'false'} onClick={() => setTab('player')}>
          Als Spieler
        </Tab>
        <Tab active={tab === 'host' ? 'true' : 'false'} onClick={() => setTab('host')}>
          Als Host
        </Tab>
      </TabBar>

      {tab === 'player' ? <PlayerTab /> : <HostTab />}
    </Screen>
  );
}
