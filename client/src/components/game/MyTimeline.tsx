import styled from '@emotion/styled';
import type { SongFull } from '@tuneline/shared';
import type { Feedback } from '../../types';
import { DropZone } from '../DropZone';
import { SongTile } from '../SongTile';

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
  min-height: 150px;
  padding: 0.5rem 0;
`;

const TimelineInner = styled.div`
  display: flex;
  align-items: center;
  width: fit-content;
  margin: 0 auto;
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
                <SongTile
                  year={s.year}
                  title={s.title}
                  artist={s.artist}
                  highlight={isNewSong}
                  variant="timeline"
                />
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
