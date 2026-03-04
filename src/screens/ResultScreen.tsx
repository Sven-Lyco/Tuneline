import styled from '@emotion/styled';
import type { Player } from '../types';
import { PLAYER_COLORS } from '../constants';
import { Confetti } from '../components/Confetti';

interface ResultScreenProps {
  players: Player[];
  scores: Record<number, number>;
  onRestart: () => void;
}

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  position: relative;
  z-index: 1;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2.5rem;
  text-align: center;
  max-width: 420px;
  width: 100%;
  animation: slideIn 0.5s ease-out;
`;

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

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export function ResultScreen({ players, scores, onRestart }: ResultScreenProps) {
  const ranked = players
    .map((p, i) => ({ name: p.name, score: scores[i], color: PLAYER_COLORS[i] }))
    .sort((a, b) => b.score - a.score);

  return (
    <Screen>
      <Confetti />
      <Card>
        <GameOverLabel>Spiel beendet</GameOverLabel>
        <Crown>👑</Crown>
        <WinnerName>{ranked[0]?.name}</WinnerName>
        <WinnerScore>gewinnt mit {ranked[0]?.score} Punkten!</WinnerScore>

        <Rankings>
          {ranked.map((r, i) => (
            <RankRow key={i}>
              <RankPosition>{RANK_MEDALS[i] ?? `#${i + 1}`}</RankPosition>
              <RankDot bg={r.color} />
              <RankName>{r.name}</RankName>
              <RankScore>{r.score}</RankScore>
            </RankRow>
          ))}
        </Rankings>

        <RestartButton onClick={onRestart}>↻ Nochmal spielen</RestartButton>
      </Card>
    </Screen>
  );
}
