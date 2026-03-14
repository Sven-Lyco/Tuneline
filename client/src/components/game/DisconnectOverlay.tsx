import styled from '@emotion/styled';

interface DisconnectOverlayProps {
  disconnectedPlayer: { id: string; name: string; isHostDisconnected: boolean };
  roomCode: string;
  isHost: boolean;
  onSkipPlayer: () => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 13, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  animation: slideIn 0.3s ease-out;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  margin: 1.5rem;
  text-align: center;
`;

const Icon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
`;

const Title = styled.div`
  font-size: 1.15rem;
  font-weight: 700;
  color: #e8e8f0;
  margin-bottom: 0.5rem;
`;

const Sub = styled.div`
  font-size: 0.88rem;
  color: #7a7a8e;
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const RoomCode = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 6px;
  color: #a855f7;
  background: #08080d;
  border: 1px solid #2a2a3a;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  margin-bottom: 1.5rem;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const SkipButton = styled.button`
  padding: 0.75rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  color: #fff;
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
`;

const WaitButton = styled.button`
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid #2a2a3a;
  background: transparent;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  cursor: default;
`;

export function DisconnectOverlay({
  disconnectedPlayer,
  roomCode,
  isHost,
  onSkipPlayer,
}: DisconnectOverlayProps) {
  const { name, isHostDisconnected } = disconnectedPlayer;

  return (
    <Overlay role="dialog" aria-modal="true" aria-label="Verbindungsproblem">
      <Card>
        <Icon>📵</Icon>
        <Title>
          {isHostDisconnected
            ? 'Host hat die Verbindung verloren'
            : `${name} hat die Verbindung verloren`}
        </Title>
        <Sub>
          {isHostDisconnected
            ? 'Das Spiel wurde beendet. Ergebnis wird gleich angezeigt.'
            : isHost
              ? 'Teile den Raum-Code damit der Spieler wieder beitreten kann:'
              : 'Das Spiel ist pausiert. Der Host entscheidet wie es weitergeht.'}
        </Sub>

        {!isHostDisconnected && <RoomCode>{roomCode}</RoomCode>}

        {isHost && !isHostDisconnected && (
          <Actions>
            <SkipButton onClick={onSkipPlayer}>
              Ohne {name} weiterspielen
            </SkipButton>
            <WaitButton disabled>Warten auf Reconnect…</WaitButton>
          </Actions>
        )}
      </Card>
    </Overlay>
  );
}
