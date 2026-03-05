import styled from '@emotion/styled';

interface LoadingScreenProps {
  message: string;
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

const Title = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #ff2d78, #a855f7, #06d6a0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1.5rem;
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
  font-size: 0.7rem;
  color: #555;
`;

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <Screen>
      <Title>TUNELINE</Title>
      <Spinner />
      <Message>{message}</Message>
      <Hint>Das kann ein paar Sekunden dauern...</Hint>
    </Screen>
  );
}
