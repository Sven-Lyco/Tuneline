import styled from '@emotion/styled';

const Chip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  border-radius: 20px;
  font-size: 0.8rem;
  transition: all 0.3s;

  &[data-active='false'] {
    border: 1px solid #2a2a3a;
    background: #1a1a26;
  }
  &[data-active='true'] {
    background: rgba(255, 45, 120, 0.07);
    box-shadow: 0 0 12px rgba(255, 45, 120, 0.15);
  }
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const Name = styled.span`
  &[data-active='true'] {
    color: #e8e8f0;
    font-weight: 600;
  }
  &[data-active='false'] {
    color: #7a7a8e;
    font-weight: 400;
  }
`;

const Score = styled.span`
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 0.85rem;
  color: #06d6a0;
`;

interface PlayerChipProps {
  name: string;
  color: string;
  score?: number;
  isActive?: boolean;
  isMe?: boolean;
}

export function PlayerChip({
  name,
  color,
  score,
  isActive = false,
  isMe = false,
}: PlayerChipProps) {
  return (
    <Chip
      data-active={String(isActive)}
      style={isActive ? { border: `1px solid ${color}` } : undefined}
    >
      <Dot style={{ background: color }} />
      <Name data-active={String(isActive)}>
        {name}
        {isMe ? ' (du)' : ''}
      </Name>
      {score !== undefined && <Score>{score}</Score>}
    </Chip>
  );
}
