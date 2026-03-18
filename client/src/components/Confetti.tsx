import styled from '@emotion/styled';
import { PLAYER_COLORS } from '../constants';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
`;

interface Particle {
  left: string;
  width: number;
  height: number;
  background: string;
  borderRadius: string;
  animation: string;
}

function randomParticle(): Particle {
  return {
    left: `${Math.random() * 100}%`,
    width: 5 + Math.random() * 7,
    height: 5 + Math.random() * 7,
    background: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)] ?? '#fff',
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    animation: `fall ${2 + Math.random() * 3}s ${Math.random() * 3}s linear infinite`,
  };
}

const PARTICLES: Particle[] = Array.from({ length: 55 }, randomParticle);

export function Confetti() {
  return (
    <Overlay>
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -10,
            ...p,
          }}
        />
      ))}
    </Overlay>
  );
}
