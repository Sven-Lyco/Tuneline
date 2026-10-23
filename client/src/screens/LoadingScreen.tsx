import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { AppTitle } from '../components/AppTitle';
import { LinkButton } from '../components/LinkButton';

interface LoadingScreenProps {
  message: string;
  /** Shown to the host while songs load; guests just wait. */
  onCancel?: () => void;
}

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  position: relative;
  z-index: 1;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid #2a2a3a;
  border-top: 3px solid #ff2d78;
  border-radius: 50%;
  animation: ldSpin 0.8s linear infinite;
  margin-bottom: 1.5rem;
`;

const Message = styled.div`
  font-size: 0.9rem;
  color: #7a7a8e;
  animation: glow 1.5s infinite;
`;

const Hint = styled.div`
  margin-top: 0.5rem;
  max-width: 22rem;
  padding: 0 1rem;
  text-align: center;
  font-size: 0.7rem;
  color: #555;
`;

// From here on a song load is most likely waiting for iTunes (about 20 searches a minute).
const SLOW_AFTER_MS = 8000;

export function LoadingScreen({ message, onCancel }: LoadingScreenProps) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen>
      <AppTitle size="sm" animate={false} style={{ marginBottom: '1.5rem' }} />
      <Spinner />
      <Message>{message}</Message>
      <Hint>
        {slow
          ? 'iTunes erlaubt nur wenige Suchen pro Minute – bei vielen Runden dauert das Laden ein paar Minuten.'
          : 'Das kann ein paar Sekunden dauern...'}
      </Hint>
      {onCancel && (
        <LinkButton style={{ marginTop: '1.5rem' }} onClick={onCancel}>
          Abbrechen
        </LinkButton>
      )}
    </Screen>
  );
}
