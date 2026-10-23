import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import type { LegalInfo } from '@tuneline/shared';

// ── Layout (like HelpScreen) ──────────────────────────────────────

const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem 4rem;
  position: relative;
  z-index: 1;
`;

const Header = styled.div`
  width: 100%;
  max-width: 560px;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const BackButton = styled.button`
  background: transparent;
  border: 1.5px solid #2a2a3a;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #7a7a8e;
  font-size: 1.1rem;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    border-color: #ff2d78;
    color: #ff2d78;
  }
`;

const Title = styled.h1`
  margin: 0;
  font-family: 'Space Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: #e8e8f0;
  letter-spacing: 1px;
`;

const Body = styled.div`
  width: 100%;
  max-width: 560px;
  color: #b8b8cc;
  font-size: 0.9rem;
  line-height: 1.6;

  h2 {
    margin: 1.75rem 0 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    color: #e8e8f0;
  }

  p,
  ul {
    margin: 0 0 0.75rem;
  }

  ul {
    padding-left: 1.25rem;
  }

  li {
    margin-bottom: 0.35rem;
  }

  a {
    color: #ff2d78;
    overflow-wrap: anywhere;
  }

  code {
    font-family: 'Space Mono', monospace;
    font-size: 0.8rem;
    color: #e8e8f0;
  }
`;

const Missing = styled.span`
  color: #ff8c42;
`;

interface LegalPageProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
}

export function LegalPage({ title, onBack, children }: LegalPageProps) {
  return (
    <Screen>
      <Header>
        <BackButton onClick={onBack} aria-label="Zurück">
          ←
        </BackButton>
        <Title>{title}</Title>
      </Header>
      <Body>{children}</Body>
    </Screen>
  );
}

/** The operator's name and contact, or a note that the instance hasn't set them. */
export function Operator({ info }: { info: LegalInfo | null }) {
  if (!info) return <>…</>;
  if (!info.operatorName || !info.operatorContact) {
    return <Missing>Betreiberangaben fehlen (OPERATOR_NAME/OPERATOR_CONTACT).</Missing>;
  }
  const contact = info.operatorContact;
  const isEmail = contact.includes('@') && !contact.includes('://');
  return (
    <>
      {info.operatorName}
      <br />
      Kontakt:{' '}
      {isEmail ? (
        <a href={`mailto:${contact}`}>{contact}</a>
      ) : (
        <a href={contact} target="_blank" rel="noopener noreferrer">
          {contact}
        </a>
      )}
    </>
  );
}
