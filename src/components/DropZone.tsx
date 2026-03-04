import { useState } from 'react';
import styled from '@emotion/styled';

interface DropZoneProps {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}

const Container = styled.div`
  width: 52px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;

  &[data-disabled='false'] {
    cursor: pointer;
  }
  &[data-disabled='true'] {
    cursor: default;
  }
`;

const Bar = styled.div`
  width: 3px;
  height: 50px;
  background: #2a2a3a;
  border-radius: 2px;
  transition: all 0.25s;

  &[data-active='true'] {
    width: 5px;
    height: 75px;
    background: #ff2d78;
    box-shadow: 0 0 12px rgba(255, 45, 120, 0.4);
  }
`;

const Arrow = styled.div`
  position: absolute;
  top: 6px;
  font-size: 0.55rem;
  color: #ff2d78;
  animation: bob 0.8s ease-in-out infinite;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;

  &[data-active='true'] {
    opacity: 1;
  }
`;

export function DropZone({ active, onClick, disabled }: DropZoneProps) {
  const [hovered, setHovered] = useState(false);
  const isActive = active || (!disabled && hovered);

  return (
    <Container
      data-disabled={String(disabled)}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Bar data-active={String(isActive)} />
      <Arrow data-active={String(isActive)}>▼</Arrow>
    </Container>
  );
}
