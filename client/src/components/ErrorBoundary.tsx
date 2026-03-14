import { Component, type ReactNode } from 'react';
import styled from '@emotion/styled';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

const Screen = styled.div`
  min-height: 100vh;
  background: #08080d;
  color: #e8e8f0;
  font-family: 'Outfit', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 420px;
  width: 100%;
  text-align: center;
`;

const Icon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
`;

const Title = styled.div`
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
`;

const Sub = styled.div`
  font-size: 0.88rem;
  color: #7a7a8e;
  margin-bottom: 1.5rem;
`;

const ReloadButton = styled.button`
  padding: 0.75rem 1.8rem;
  border-radius: 12px;
  border: 1.5px solid #ff2d78;
  background: transparent;
  color: #ff2d78;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 45, 120, 0.08);
  }
`;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Screen>
        <Card>
          <Icon>💥</Icon>
          <Title>Unerwarteter Fehler</Title>
          <Sub>Etwas ist schiefgelaufen. Bitte die Seite neu laden.</Sub>
          <ReloadButton onClick={() => window.location.reload()}>Neu laden</ReloadButton>
        </Card>
      </Screen>
    );
  }
}
