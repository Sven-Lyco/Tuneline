import { useState } from 'react';
import styled from '@emotion/styled';
import { AppTitle, AppSubtitle } from '../components/AppTitle';
import { CenteredScreen } from '../components/CenteredScreen';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { LinkButton } from '../components/LinkButton';

interface JoinScreenProps {
  initialCode?: string;
  onJoin: (roomCode: string, name: string) => void;
  onBack: () => void;
}

// ── Styles ─────────────────────────────────────────────────────

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
    <CenteredScreen>
      <AppTitle size="md" />
      <AppSubtitle>Musik · Timeline · Challenge</AppSubtitle>

      <Card style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        <PrimaryButton ready={isReady} variant="purple-teal" onClick={handleSubmit} style={{ marginTop: '0.5rem' }}>
          Beitreten →
        </PrimaryButton>
      </Card>

      <LinkButton style={{ marginTop: '1rem' }} onClick={onBack}>← Zurück</LinkButton>
    </CenteredScreen>
  );
}
