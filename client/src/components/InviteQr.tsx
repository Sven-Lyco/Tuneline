import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { QRCodeSVG } from 'qrcode.react';
import { inviteUrl } from '../utils/invite';
import { LinkButton } from './LinkButton';

interface InviteQrProps {
  roomCode: string;
  /** 'link' next to the lobby's room code, 'badge' in the game header. */
  variant?: 'link' | 'badge';
}

// Matches RoomCodeCopy's badge in the game header.
const Badge = styled.button`
  background: transparent;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 0.25rem 0.6rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: #4a4a6a;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
  position: relative;

  /* Finger-sized hit area (vertical only, so it doesn't reach into the room code badge) */
  &::after {
    content: '';
    position: absolute;
    inset: -0.45rem 0;
  }

  &:hover {
    border-color: #4a4a6a;
    color: #7a7a8e;
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(8, 8, 13, 0.88);
`;

const Dialog = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  width: min(100%, 380px);
  padding: 2rem 1.5rem 1.5rem;
  border-radius: 20px;
  border: 1px solid #2a2a3a;
  background: #12121a;
  text-align: center;
  animation: slideIn 0.25s ease-out;
  /* Rendered into <body>, outside the app root that sets the font */
  font-family: 'Outfit', sans-serif;
`;

/* Dark modules on white with a margin scan most reliably, also from across the room. */
const QrFrame = styled.div`
  width: min(72vw, 300px);
  padding: 12px;
  border-radius: 14px;
  background: #fff;
  line-height: 0;

  & > svg {
    width: 100%;
    height: auto;
  }
`;

const Code = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 6px;
  color: #a855f7;
`;

const Hint = styled.div`
  font-size: 0.85rem;
  color: #9a9aae;
  line-height: 1.5;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #7a7a8e;
  font-size: 1.1rem;
  cursor: pointer;

  &:hover {
    background: #1e1e2e;
    color: #e8e8f0;
  }

  &:focus-visible {
    outline: 2px solid #a855f7;
    outline-offset: 2px;
  }
`;

/** Shows the invite link as a QR code, so friends in the same room join with their phone camera. */
export function InviteQr({ roomCode, variant = 'link' }: InviteQrProps) {
  const [open, setOpen] = useState(false);
  const url = inviteUrl(roomCode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const trigger =
    variant === 'badge' ? (
      <Badge onClick={() => setOpen(true)} title="QR-Code zum Beitreten">
        QR
      </Badge>
    ) : (
      <LinkButton onClick={() => setOpen(true)}>QR-Code zeigen</LinkButton>
    );

  return (
    <>
      {trigger}
      {open &&
        // A portal: an animated (transformed) ancestor would otherwise trap the fixed overlay.
        createPortal(
          <Backdrop onClick={() => setOpen(false)}>
            <Dialog
              role="dialog"
              aria-modal="true"
              aria-label="QR-Code zum Beitreten"
              onClick={(e) => e.stopPropagation()}
            >
              <CloseButton onClick={() => setOpen(false)} aria-label="Schließen" autoFocus>
                ✕
              </CloseButton>
              <QrFrame>
                <QRCodeSVG value={url} size={256} level="M" marginSize={2} title={url} />
              </QrFrame>
              <Code>{roomCode}</Code>
              <Hint>Mit der Handykamera scannen – der Raum-Code ist dann schon eingetragen.</Hint>
            </Dialog>
          </Backdrop>,
          document.body
        )}
    </>
  );
}
