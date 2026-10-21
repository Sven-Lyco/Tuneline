import styled from '@emotion/styled';
import type { RoomPlayer } from '@tuneline/shared';
import { getPlayerColor } from '../../constants';
import { RoomCodeCopy } from '../RoomCodeCopy';
import { InviteQr } from '../InviteQr';
import { PlayerChip } from '../PlayerChip';

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

  @media (max-width: 480px) {
    padding: 0.75rem 1rem;
  }
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

  /* On phones wrapped chips push the timeline off screen: one swipeable row instead */
  @media (max-width: 480px) {
    flex-wrap: nowrap;
    overflow-x: auto;
    width: 100%;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    & > * {
      flex-shrink: 0;
    }
  }
`;

export function GameHeader({
  roomCode,
  players,
  currentPlayerId,
  round,
  rounds,
  myPlayerId,
}: GameHeaderProps) {
  return (
    <Header>
      <HeaderTitle>TUNELINE</HeaderTitle>
      <RoundBadge>
        RUNDE {round}/{rounds}
      </RoundBadge>
      <RoomCodeCopy roomCode={roomCode} variant="badge" />
      <InviteQr roomCode={roomCode} variant="badge" />
      <PlayerBadges>
        {players.map((p, i) => {
          const isActive = p.id === currentPlayerId;
          return (
            <PlayerChip
              key={p.id}
              name={p.name}
              color={getPlayerColor(i)}
              score={p.score}
              isActive={isActive}
              isMe={p.id === myPlayerId}
              offline={!p.isConnected}
            />
          );
        })}
      </PlayerBadges>
    </Header>
  );
}
