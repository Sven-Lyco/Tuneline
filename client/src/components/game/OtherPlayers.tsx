import styled from '@emotion/styled';
import type { RoomPlayer } from '@tuneline/shared';
import { PLAYER_COLORS } from '../../constants';

interface OtherPlayersProps {
  players: RoomPlayer[];
  allPlayers: RoomPlayer[];
  currentPlayerId: string;
}

const OthersSection = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 0 2rem 0.5rem;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #2a2a3a;
    border-radius: 3px;
  }
`;

const PlayerPanel = styled.div<{ isActive: string; borderColor: string }>`
  background: #12121a;
  border: 1px solid
    ${({ isActive, borderColor }) => (isActive === 'true' ? borderColor : '#1e1e2e')};
  border-radius: 14px;
  padding: 0.75rem 1rem;
  min-width: 200px;
  flex-shrink: 0;
`;

const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
`;

const Dot = styled.div<{ bg: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
`;

const PlayerName = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  color: #e8e8f0;
  flex: 1;
`;

const PlayerScore = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.85rem;
  color: #06d6a0;
  font-weight: 700;
`;

const Timeline = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
`;

const MiniTile = styled.div`
  background: #1a1a26;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 0.2rem 0.4rem;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: #ff2d78;
`;

export function OtherPlayers({ players, allPlayers, currentPlayerId }: OtherPlayersProps) {
  return (
    <OthersSection>
      {players.map((p) => {
        const globalIdx = allPlayers.findIndex((gp) => gp.id === p.id);
        const color = PLAYER_COLORS[globalIdx] ?? '#7a7a8e';
        const sortedTl = [...p.timeline].sort((a, b) => a.year - b.year);
        return (
          <PlayerPanel
            key={p.id}
            isActive={String(p.id === currentPlayerId)}
            borderColor={color}
          >
            <PlayerHeader>
              <Dot bg={color} />
              <PlayerName>{p.name}</PlayerName>
              <PlayerScore>{p.score} Pkt</PlayerScore>
            </PlayerHeader>
            <Timeline>
              {sortedTl.length === 0 ? (
                <span style={{ fontSize: '0.65rem', color: '#3a3a5a' }}>leer</span>
              ) : (
                sortedTl.map((s, si) => (
                  <MiniTile key={`${s.id}-${si}`} title={`${s.title} — ${s.artist}`}>
                    {s.year}
                  </MiniTile>
                ))
              )}
            </Timeline>
          </PlayerPanel>
        );
      })}
    </OthersSection>
  );
}
