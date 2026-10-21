import { useEffect, useState } from 'react';
import styled from '@emotion/styled';

const Timer = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.85rem;
  font-weight: 700;
  color: #7a7a8e;
  transition: color 0.3s;

  &[data-urgent='true'] {
    color: #ff4444;
    animation: glow 1s infinite;
  }
`;

/** Counts down to `endsAt` (local clock); the server decides when time is really up. */
export function TurnTimer({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return <Timer data-urgent={String(seconds <= 10)}>⏱ {seconds}s</Timer>;
}
