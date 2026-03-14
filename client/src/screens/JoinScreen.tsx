import { useState } from 'react';
import styled from '@emotion/styled';

interface JoinScreenProps {
  initialCode?: string;
  onJoin: (roomCode: string, name: string) => void;
  onBack: () => void;
}

// ── Styles ─────────────────────────────────────────────────────

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
  position: relative;
  z-index: 1;
`;

const Title = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: clamp(2rem, 8vw, 4rem);
  font-weight: 700;
  letter-spacing: -3px;
  background: linear-gradient(135deg, #ff2d78, #a855f7, #06d6a0);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: float 4s ease-in-out infinite;
  margin-bottom: 4px;
`;

const Subtitle = styled.div`
  font-size: 0.8rem;
  color: #7a7a8e;
  letter-spacing: 4px;
  text-transform: uppercase;
  font-weight: 300;
  margin-bottom: 2.5rem;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CardTitle = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #7a7a8e;
  margin-bottom: 0.25rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1.5px solid #2a2a3a;
  background: #08080d;
  color: #e8e8f0;
  font-family: 'Space Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 3px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #a855f7;
  }

  &::placeholder {
    color: #3a3a5a;
    letter-spacing: 1px;
    font-size: 0.85rem;
    font-weight: 400;
    font-family: 'Outfit', sans-serif;
  }
`;

const NameInput = styled(Input)`
  letter-spacing: 0;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
`;

const JoinButton = styled.button<{ ready: string }>`
  width: 100%;
  padding: 0.85rem;
  border-radius: 14px;
  border: none;
  background: ${({ ready }) =>
    ready === 'true' ? 'linear-gradient(135deg, #a855f7, #06d6a0)' : '#1e1e2e'};
  color: ${({ ready }) => (ready === 'true' ? '#fff' : '#444')};
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  cursor: ${({ ready }) => (ready === 'true' ? 'pointer' : 'not-allowed')};
  transition: opacity 0.2s;
  margin-top: 0.5rem;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const BackLink = styled.button`
  background: transparent;
  border: none;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
  margin-top: 1rem;
  text-decoration: underline;

  &:hover {
    color: #9a9aae;
  }
`;

// ── Component ──────────────────────────────────────────────────

export function JoinScreen({ initialCode = '', onJoin, onBack }: JoinScreenProps) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');

  const isReady = code.trim().length === 6 && name.trim().length > 0;

  const handleSubmit = () => {
    if (!isReady) return;
    onJoin(code.trim().toUpperCase(), name.trim());
  };

  return (
    <Screen>
      <Title>TUNELINE</Title>
      <Subtitle>Musik · Timeline · Challenge</Subtitle>

      <Card>
        <div>
          <CardTitle>Raum-Code</CardTitle>
          <Input
            placeholder="z.B. 6ER2T5"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <div>
          <CardTitle>Dein Name</CardTitle>
          <NameInput
            placeholder="Spielername eingeben"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <JoinButton ready={String(isReady)} disabled={!isReady} onClick={handleSubmit}>
          Beitreten →
        </JoinButton>
      </Card>

      <BackLink onClick={onBack}>← Zurück</BackLink>
    </Screen>
  );
}
