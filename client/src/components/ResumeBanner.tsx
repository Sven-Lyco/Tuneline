import styled from '@emotion/styled';
import type { LastRoom } from '../utils/roomStorage';

const Banner = styled.div`
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  max-width: calc(100vw - 2rem);
  padding: 0.65rem 0.9rem 0.65rem 1.1rem;
  border-radius: 14px;
  border: 1px solid #a855f7;
  background: #12121a;
  box-shadow: 0 8px 24px rgba(168, 85, 247, 0.15);
  font-size: 0.9rem;
  color: #e8e8f0;
  animation: slideIn 0.3s ease-out;
`;

const Code = styled.span`
  font-family: 'Space Mono', monospace;
  color: #a855f7;
  letter-spacing: 2px;
`;

const ResumeButton = styled.button`
  flex-shrink: 0;
  padding: 0.45rem 0.9rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #a855f7, #06d6a0);
  color: #08080d;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  cursor: pointer;
`;

const DismissButton = styled.button`
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: #7a7a8e;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
`;

interface ResumeBannerProps {
  room: LastRoom;
  onResume: () => void;
  onDismiss: () => void;
}

/** Offers to rejoin the room this browser played in before the tab was closed. */
export function ResumeBanner({ room, onResume, onDismiss }: ResumeBannerProps) {
  return (
    <Banner role="status">
      <span>
        Du warst in Raum <Code>{room.roomCode}</Code> als <strong>{room.playerName}</strong>.
      </span>
      <ResumeButton onClick={onResume}>Zurück ins Spiel</ResumeButton>
      <DismissButton onClick={onDismiss} aria-label="Hinweis schließen">
        ✕
      </DismissButton>
    </Banner>
  );
}
