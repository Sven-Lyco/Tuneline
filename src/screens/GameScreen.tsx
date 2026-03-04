import styled from '@emotion/styled';
import type { Feedback, Player, Song } from '../types';
import { PLAYER_COLORS } from '../constants';
import { Vinyl } from '../components/Vinyl';
import { Wave } from '../components/Wave';
import { DropZone } from '../components/DropZone';

interface GameScreenProps {
  players: Player[];
  playerIndex: number;
  round: number;
  rounds: number;
  scores: Record<number, number>;
  song: Song;
  timeline: Song[];
  slot: number | null;
  setSlot: (slot: number | null) => void;
  feedback: Feedback;
  revealed: boolean;
  playing: boolean;
  onToggleAudio: () => void;
  onPlace: () => void;
}

// ── Layout ────────────────────────────────────────────────────

const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
`;

const GameBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 0 1.5rem;
  width: 100%;
`;

// ── Header ────────────────────────────────────────────────────

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 2rem;
  background: #12121a;
  border-bottom: 1px solid #1e1e2e;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const HeaderTitle = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const RoundBadge = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.75rem;
  color: #7a7a8e;
  letter-spacing: 3px;
`;

const PlayerBadges = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const PlayerChip = styled.div<{ active: string; borderColor: string }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  border-radius: 20px;
  border: 1px solid ${({ active, borderColor }) => (active === 'true' ? borderColor : '#2a2a3a')};
  background: ${({ active }) => (active === 'true' ? 'rgba(255,45,120,0.07)' : '#1a1a26')};
  box-shadow: ${({ active }) => (active === 'true' ? '0 0 12px rgba(255,45,120,0.15)' : 'none')};
  font-size: 0.8rem;
  transition: all 0.3s;
`;

const PlayerDot = styled.div<{ bg: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
`;

const PlayerName = styled.span<{ active: string }>`
  color: ${({ active }) => (active === 'true' ? '#e8e8f0' : '#7a7a8e')};
  font-weight: ${({ active }) => (active === 'true' ? '600' : '400')};
`;

const PlayerScore = styled.span`
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 0.85rem;
  color: #06d6a0;
`;

// ── Song Card ─────────────────────────────────────────────────

const SongArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 2rem;
  flex-shrink: 0;
`;

const CurrentPlayerLabel = styled.div<{ color: string }>`
  font-family: 'Space Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: ${({ color }) => color};
  margin-bottom: 0.9rem;
  animation: glow 2s infinite;
`;

const SongCard = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 1.75rem 2rem;
  width: 100%;
  max-width: 680px;
  position: relative;
  overflow: hidden;
  animation: slideIn 0.4s ease-out;
`;

const SongCardAccent = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #ff2d78, #a855f7, #06d6a0);
`;

const SongCardBody = styled.div`
  display: flex;
  align-items: center;
  gap: 1.75rem;
  margin-bottom: 1rem;
`;

const SongInfo = styled.div`
  text-align: left;
  min-width: 0;
  flex: 1;
`;

const SongTitle = styled.div`
  font-size: 1.6rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.2rem;
`;

const SongArtist = styled.div`
  font-size: 1rem;
  color: #7a7a8e;
  margin-bottom: 0.6rem;
`;

const RevealedYear = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 2.5rem;
  font-weight: 700;
  color: #06d6a0;
  animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
`;

const AudioButton = styled.button`
  padding: 0.45rem 1.2rem;
  border-radius: 10px;
  border: 1.5px solid #ff2d78;
  background: rgba(255, 45, 120, 0.08);
  color: #ff2d78;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 45, 120, 0.18);
  }
`;

const NoAudio = styled.div`
  font-size: 0.75rem;
  color: #ff6b6b;
`;

const PlacementHint = styled.div`
  font-size: 0.75rem;
  color: #7a7a8e;
  margin-top: 0.6rem;
  text-align: center;
`;

// ── Feedback bar ──────────────────────────────────────────────

const FeedbackBar = styled.div<{ ok: string }>`
  text-align: center;
  padding: 0.75rem 1rem;
  font-weight: 700;
  font-size: 1.05rem;
  flex-shrink: 0;
  background: ${({ ok }) => (ok === 'true' ? 'rgba(6,214,160,0.08)' : 'rgba(255,68,68,0.08)')};
  color: ${({ ok }) => (ok === 'true' ? '#06d6a0' : '#ff6b6b')};
  border-top: ${({ ok }) => `2px solid ${ok === 'true' ? '#06d6a0' : '#ff4444'}`};
  border-bottom: ${({ ok }) => `1px solid ${ok === 'true' ? '#06d6a044' : '#ff444433'}`};
  animation: slideIn 0.3s ease-out;
`;

// ── Timeline ──────────────────────────────────────────────────

const TimelineSection = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TimelineLabel = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #3a3a5a;
  text-align: center;
`;

const TimelineArea = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  align-items: center;
  min-height: 150px;
  padding: 0.5rem 0;

  &::-webkit-scrollbar {
    height: 5px;
  }
  &::-webkit-scrollbar-track {
    background: #12121a;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #2a2a3a;
    border-radius: 3px;
  }
`;

const TimelineInner = styled.div`
  display: flex;
  align-items: center;
  min-width: min-content;
  padding: 0.5rem 2rem;
`;

const SongTile = styled.div<{ highlight: string }>`
  background: #1a1a26;
  border: 2px solid ${({ highlight }) => (highlight === 'true' ? '#06d6a0' : '#2a2a3a')};
  border-radius: 14px;
  padding: 0.8rem 1rem;
  text-align: center;
  min-width: 150px;
  box-shadow: ${({ highlight }) =>
    highlight === 'true' ? '0 0 24px rgba(6,214,160,0.25)' : 'none'};
  animation: ${({ highlight }) => (highlight === 'true' ? 'pop 0.4s ease-out' : 'none')};
  transition: all 0.3s;
  flex-shrink: 0;
`;

const TileYear = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: #ff2d78;
  margin-bottom: 4px;
`;

const TileTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: #e8e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
`;

const TileArtist = styled.div`
  font-size: 0.65rem;
  color: #7a7a8e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
  margin-top: 2px;
`;

// ── Place Button ──────────────────────────────────────────────

const PlaceButtonRow = styled.div`
  display: flex;
  justify-content: center;
  padding: 0 2rem;
  flex-shrink: 0;
`;

const PlaceButton = styled.button<{ ready: string }>`
  padding: 1rem 4rem;
  border-radius: 16px;
  border: none;
  background: ${({ ready }) =>
    ready === 'true' ? 'linear-gradient(135deg, #06d6a0, #04b890)' : '#1e1e2e'};
  color: ${({ ready }) => (ready === 'true' ? '#08080d' : '#444')};
  font-family: 'Outfit', sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: ${({ ready }) => (ready === 'true' ? 'pointer' : 'not-allowed')};
  transition: all 0.25s;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(6, 214, 160, 0.25);
  }
`;

// ── Component ─────────────────────────────────────────────────

export function GameScreen({
  players,
  playerIndex,
  round,
  rounds,
  scores,
  song,
  timeline,
  slot,
  setSlot,
  feedback,
  revealed,
  playing,
  onToggleAudio,
  onPlace,
}: GameScreenProps) {
  const isReady = slot !== null && !revealed;
  const centered = timeline.length <= 4;

  return (
    <Screen>
      {/* Header — full width */}
      <Header>
        <HeaderTitle>TUNELINE</HeaderTitle>
        <RoundBadge>RUNDE {round}/{rounds}</RoundBadge>
        <PlayerBadges>
          {players.map((p, i) => (
            <PlayerChip key={i} active={String(i === playerIndex)} borderColor="#ff2d78">
              <PlayerDot bg={PLAYER_COLORS[i]} />
              <PlayerName active={String(i === playerIndex)}>{p.name}</PlayerName>
              <PlayerScore>{scores[i]}</PlayerScore>
            </PlayerChip>
          ))}
        </PlayerBadges>
      </Header>

      {/* Vertically centered game body */}
      <GameBody>
        {/* Song Card */}
        <SongArea>
          <CurrentPlayerLabel color={PLAYER_COLORS[playerIndex]}>
            ● {players[playerIndex]?.name} ist dran
          </CurrentPlayerLabel>
          <SongCard>
            <SongCardAccent />
            <SongCardBody>
              <Vinyl spinning={playing} cover={song.cover} size={120} />
              <SongInfo>
                <SongTitle>{song.title}</SongTitle>
                <SongArtist>{song.artist}</SongArtist>
                {revealed && <RevealedYear>{song.year}</RevealedYear>}
                {!revealed && song.preview && (
                  <AudioButton onClick={onToggleAudio}>
                    {playing ? '⏸ Pause' : '▶ Play'}
                  </AudioButton>
                )}
                {!revealed && !song.preview && <NoAudio>Kein Audio</NoAudio>}
              </SongInfo>
            </SongCardBody>
            <Wave active={playing} />
            {!revealed && (
              <PlacementHint>Wähle die richtige Position in der Timeline ↓</PlacementHint>
            )}
          </SongCard>
        </SongArea>

        {/* Feedback */}
        {feedback && (
          <FeedbackBar ok={String(feedback === 'ok')}>
            {feedback === 'ok'
              ? '✓ Richtig platziert! +1 Punkt'
              : `✗ Falsch! Der Song war von ${song.year}.`}
          </FeedbackBar>
        )}

        {/* Timeline */}
        <TimelineSection>
          <TimelineLabel>— Deine Timeline —</TimelineLabel>
          <TimelineArea style={{ justifyContent: centered ? 'center' : 'flex-start' }}>
            <TimelineInner>
              <DropZone active={slot === 0} onClick={() => setSlot(0)} disabled={revealed} />
              {timeline.map((s, i) => {
                const isNewSong = revealed && feedback === 'ok' && s === song;
                return (
                  <div
                    key={`${s.id || s.title}-${i}`}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <SongTile highlight={String(isNewSong)}>
                      <TileYear>{s.year}</TileYear>
                      <TileTitle>{s.title}</TileTitle>
                      <TileArtist>{s.artist}</TileArtist>
                    </SongTile>
                    <DropZone
                      active={slot === i + 1}
                      onClick={() => setSlot(i + 1)}
                      disabled={revealed}
                    />
                  </div>
                );
              })}
            </TimelineInner>
          </TimelineArea>
        </TimelineSection>

        {/* Place Button */}
        <PlaceButtonRow>
          <PlaceButton ready={String(isReady)} disabled={!isReady} onClick={onPlace}>
            {slot !== null ? 'Hier platzieren ▶' : 'Position wählen...'}
          </PlaceButton>
        </PlaceButtonRow>
      </GameBody>
    </Screen>
  );
}
