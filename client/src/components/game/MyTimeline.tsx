import styled from '@emotion/styled';
import type { SongFull } from '@tuneline/shared';
import type { Feedback } from '../../types';
import { DropZone } from '../DropZone';

interface MyTimelineProps {
  timeline: SongFull[];
  slot: number | null;
  setSlot: (n: number | null) => void;
  revealed: boolean;
  isMyTurn: boolean;
  feedback: Feedback;
  revealedSong: SongFull | null;
}

const TimelineSection = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TimelineLabel = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.75rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #4a4a6a;
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
  font-family: 'Outfit', sans-serif;
  font-size: 1.3rem;
  font-weight: 500;
  color: #ff2d78;
  margin-bottom: 4px;
`;

const TileTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  color: #e8e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
`;

const TileArtist = styled.div`
  font-size: 0.75rem;
  color: #7a7a8e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
  margin-top: 2px;
`;

export function MyTimeline({
  timeline,
  slot,
  setSlot,
  revealed,
  isMyTurn,
  feedback,
  revealedSong,
}: MyTimelineProps) {
  const canSelect = isMyTurn && !revealed;

  return (
    <TimelineSection>
      <TimelineLabel>— Deine Timeline —</TimelineLabel>
      <TimelineArea>
        <TimelineInner>
          <DropZone
            active={slot === 0}
            onClick={() => canSelect && setSlot(0)}
            disabled={!canSelect}
          />
          {timeline.map((s, i) => {
            const isNewSong = revealed && feedback === 'ok' && revealedSong?.id === s.id;
            return (
              <div key={`${s.id}-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                <SongTile highlight={String(isNewSong)}>
                  <TileYear>{s.year}</TileYear>
                  <TileTitle>{s.title}</TileTitle>
                  <TileArtist>{s.artist}</TileArtist>
                </SongTile>
                <DropZone
                  active={slot === i + 1}
                  onClick={() => canSelect && setSlot(i + 1)}
                  disabled={!canSelect}
                />
              </div>
            );
          })}
        </TimelineInner>
      </TimelineArea>
    </TimelineSection>
  );
}
