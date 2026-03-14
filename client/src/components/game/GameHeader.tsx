import styled from '@emotion/styled';
import type { RoomPlayer } from '@tuneline/shared';
import { PLAYER_COLORS } from '../../constants';
import { RoomCodeCopy } from '../RoomCodeCopy';

interface GameHeaderProps {
  roomCode: string;
  players: RoomPlayer[];
  currentPlayerId: string;
  round: number;
  rounds: number;
  myPlayerId: string;
}

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
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: #7a7a8e;
  letter-spacing: 1.5px;
  text-transform: uppercase;
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

export function GameHeader({ roomCode, players, currentPlayerId, round, rounds, myPlayerId }: GameHeaderProps) {
  return (
    <Header>
      <HeaderTitle>TUNELINE</HeaderTitle>
      <RoundBadge>RUNDE {round}/{rounds}</RoundBadge>
      <RoomCodeCopy roomCode={roomCode} variant="badge" />
      <PlayerBadges>
        {players.map((p, i) => {
          const isActive = p.id === currentPlayerId;
          return (
            <PlayerChip
              key={p.id}
              active={String(isActive)}
              borderColor={PLAYER_COLORS[i] ?? '#ff2d78'}
            >
              <PlayerDot bg={PLAYER_COLORS[i] ?? '#7a7a8e'} />
              <PlayerName active={String(isActive)}>
                {p.name}{p.id === myPlayerId ? ' (du)' : ''}
              </PlayerName>
              <PlayerScore>{p.score}</PlayerScore>
            </PlayerChip>
          );
        })}
      </PlayerBadges>
    </Header>
  );
}
