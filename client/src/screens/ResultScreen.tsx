import { useMemo } from 'react';
import styled from '@emotion/styled';
import type { RoomPlayer, SongFull } from '@tuneline/shared';
import { getPlayerColor, RANK_MEDALS } from '../constants';
import { Confetti } from '../components/Confetti';
import { CenteredScreen } from '../components/CenteredScreen';
import { Card } from '../components/Card';
import { SongTile } from '../components/SongTile';

interface ResultScreenProps {
  players: RoomPlayer[];
  isHost: boolean;
  lastSong: SongFull | null;
  lastCorrect: boolean;
  lastPlayerId: string;
  winnerLastSong: SongFull | null;
  onRestart: () => void;
}

const GameOverLabel = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #7a7a8e;
  margin-bottom: 0.7rem;
`;

const Crown = styled.div`
  font-size: 3rem;
  margin-bottom: 0.4rem;
`;

const WinnerName = styled.div`
  font-size: 1.8rem;
  font-weight: 800;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.2rem;
`;

const WinnerScore = styled.div`
  color: #7a7a8e;
  font-size: 0.85rem;
  margin-bottom: 1.3rem;
`;

const Rankings = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1.3rem;
`;

const RankRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  background: #1a1a26;
`;

const RankPosition = styled.span`
  font-family: 'Space Mono', monospace;
  font-size: 0.75rem;
  color: #7a7a8e;
  width: 20px;
`;

const RankDot = styled.div<{ bg: string }>`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
`;

const RankName = styled.span`
  flex: 1;
  text-align: left;
  font-weight: 500;
  font-size: 0.9rem;
`;

const RankScore = styled.span`
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  color: #06d6a0;
`;

const TimelinesSection = styled.div`
  margin-bottom: 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const TimelinePlayer = styled.div`
  text-align: left;
`;

const TimelineLabel = styled.div<{ color: string }>`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${({ color }) => color};
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 0.35rem;
`;

const TimelineScroll = styled.div`
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const MissedCard = styled.div`
  flex-shrink: 0;
  width: 64px;
  border-radius: 8px;
  border: 1.5px dashed #ff4444;
  background: rgba(255, 68, 68, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.4rem 0;
`;

const MissedX = styled.div`
  font-size: 1.1rem;
  color: #ff4444;
`;

const MissedYear = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  color: #ff4444;
`;

const RestartButton = styled.button`
  padding: 0.7rem 1.8rem;
  border-radius: 12px;
  border: 1.5px solid #ff2d78;
  background: transparent;
  color: #ff2d78;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 45, 120, 0.08);
  }
`;

export function ResultScreen({
  players,
  isHost,
  lastSong,
  lastCorrect,
  lastPlayerId,
  winnerLastSong,
  onRestart,
}: ResultScreenProps) {
  const ranked = useMemo(
    () =>
      [...players]
        .map((p, i) => ({ ...p, color: getPlayerColor(i) }))
        .sort((a, b) => b.score - a.score),
    [players]
  );

  const topScore = ranked[0]?.score ?? 0;
  const isTie = ranked.filter((p) => p.score === topScore).length > 1;

  const winner = isTie ? null : ranked[0];
  const winnerOriginalIndex = winner ? players.findIndex((p) => p.id === winner.id) : -1;
  const winnerColor = getPlayerColor(winnerOriginalIndex);
  const winnerIsLastPlayer = winner?.id === lastPlayerId;
  const highlightSong = winner
    ? (winnerLastSong ?? (winnerIsLastPlayer && lastCorrect ? lastSong : null))
    : null;

  return (
    <CenteredScreen style={{ padding: '2rem' }}>
      {!isTie && <Confetti />}
      <Card
        style={{
          maxWidth: '420px',
          padding: '2.5rem',
          textAlign: 'center',
          animation: 'slideIn 0.5s ease-out',
        }}
      >
        <GameOverLabel>Spiel beendet</GameOverLabel>
        <Crown>{isTie ? '🤝' : '👑'}</Crown>
        {isTie ? (
          <>
            <WinnerName>Unentschieden!</WinnerName>
            <WinnerScore>{topScore} Punkte — kein Sieger</WinnerScore>
          </>
        ) : (
          <>
            <WinnerName>{winner?.name}</WinnerName>
            <WinnerScore>gewinnt mit {winner?.score} Punkten!</WinnerScore>
          </>
        )}

        <Rankings>
          {ranked.map((r, i) => (
            <RankRow key={r.id}>
              <RankPosition>{RANK_MEDALS[i] ?? `#${i + 1}`}</RankPosition>
              <RankDot bg={r.color} />
              <RankName>{r.name}</RankName>
              <RankScore>{r.score}</RankScore>
            </RankRow>
          ))}
        </Rankings>

        {!isTie && winner && (
          <TimelinesSection>
            <TimelinePlayer>
              <TimelineLabel color={winnerColor}>{winner.name}</TimelineLabel>
              <TimelineScroll>
                {winner.timeline.map((song) => (
                  <SongTile
                    key={song.id}
                    year={song.year}
                    title={song.title}
                    artist={song.artist}
                    highlight={song.id === highlightSong?.id}
                    variant="result"
                  />
                ))}
                {winnerIsLastPlayer && !lastCorrect && lastSong && !winnerLastSong && (
                  <MissedCard>
                    <MissedX>✕</MissedX>
                    <MissedYear>{lastSong.year}</MissedYear>
                  </MissedCard>
                )}
              </TimelineScroll>
            </TimelinePlayer>
          </TimelinesSection>
        )}

        {isHost && <RestartButton onClick={onRestart}>↻ Nochmal spielen</RestartButton>}
      </Card>
    </CenteredScreen>
  );
}
