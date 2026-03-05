import styled from '@emotion/styled';
import { PLAYER_COLORS } from '../constants';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
`;

export function Confetti() {
  return (
    <Overlay>
      {Array.from({ length: 55 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: -10,
            width: 5 + Math.random() * 7,
            height: 5 + Math.random() * 7,
            background: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `fall ${2 + Math.random() * 3}s ${Math.random() * 3}s linear infinite`,
          }}
        />
      ))}
    </Overlay>
  );
}
