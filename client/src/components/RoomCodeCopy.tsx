import styled from '@emotion/styled';
import { useRoomCodeCopy } from '../hooks/useRoomCodeCopy';

interface RoomCodeCopyProps {
  roomCode: string;
  variant?: 'block' | 'badge';
}

// ── Block (Lobby) ───────────────────────────────────────────────

const Block = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #08080d;
  border: 1.5px solid #2a2a3a;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  cursor: pointer;
  position: relative;

  &:hover {
    border-color: #4a4a6a;
  }

  &:hover > [data-tooltip] {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

const BlockCode = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 6px;
  color: #a855f7;
  flex: 1;
`;

const BlockIcon = styled.div`
  font-size: 1.1rem;
  color: #4a4a6a;
  flex-shrink: 0;
  line-height: 1;
`;

const BlockCopied = styled.span`
  color: #06d6a0;
  font-size: 0.7rem;
`;

// ── Badge (GameHeader) ──────────────────────────────────────────

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
  transition: border-color 0.2s, color 0.2s;
  white-space: nowrap;
  position: relative;

  &:hover {
    border-color: #4a4a6a;
    color: #7a7a8e;
  }

  &:hover > [data-tooltip] {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

// ── Shared Tooltip ──────────────────────────────────────────────

const Tooltip = styled.span<{ below?: boolean }>`
  position: absolute;
  ${({ below }) => below
    ? 'top: calc(100% + 8px); transform: translateX(-50%) translateY(-4px);'
    : 'bottom: calc(100% + 8px); transform: translateX(-50%) translateY(4px);'}
  left: 50%;
  background: #1e1e2e;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 0.3rem 0.65rem;
  font-family: 'Outfit', sans-serif;
  font-size: 0.75rem;
  color: #a8a8c0;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
  z-index: 100;
`;

// ── Component ───────────────────────────────────────────────────

export function RoomCodeCopy({ roomCode, variant = 'block' }: RoomCodeCopyProps) {
  const { copied, copyCode } = useRoomCodeCopy(roomCode);
  const tooltipText = copied ? '✓ Link kopiert!' : 'Invite-Link kopieren';

  if (variant === 'badge') {
    return (
      <Badge onClick={copyCode}>
        {copied ? '✓ Kopiert' : roomCode}
        <Tooltip data-tooltip below>{tooltipText}</Tooltip>
      </Badge>
    );
  }

  return (
    <Block onClick={copyCode}>
      <BlockCode>{roomCode}</BlockCode>
      {copied ? <BlockCopied>✓</BlockCopied> : <BlockIcon>⎘</BlockIcon>}
      <Tooltip data-tooltip>{tooltipText}</Tooltip>
    </Block>
  );
}
