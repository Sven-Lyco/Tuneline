import { useState, useEffect, useCallback } from 'react';
import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import type { RoomPlayer } from '@tuneline/shared';
import { PLAYER_COLORS, REACTION_EMOJIS } from '../constants';
import { socket } from '../socket';

interface Toast {
  id: number;
  emoji: string;
  playerName: string;
  color: string;
}

interface ReactionsProps {
  players: RoomPlayer[];
}

// ── Animations ──────────────────────────────────────────────────

const floatUp = keyframes`
  0%   { opacity: 0; transform: translateY(0) scale(0.7); }
  12%  { opacity: 1; transform: translateY(-10px) scale(1.15); }
  80%  { opacity: 1; transform: translateY(-40px) scale(1); }
  100% { opacity: 0; transform: translateY(-60px) scale(0.9); }
`;

const popIn = keyframes`
  0%   { opacity: 0; transform: translateY(8px) scale(0.9); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

// ── Styles ──────────────────────────────────────────────────────

const Container = styled.div`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  pointer-events: none;
`;

const ToastItem = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #1a1a2e;
  border: 1px solid ${({ color }) => color}55;
  border-radius: 20px;
  padding: 0.35rem 0.75rem 0.35rem 0.5rem;
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  color: #e8e8f0;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  animation: ${floatUp} 3s ease forwards;
  pointer-events: none;
`;

const ToastEmoji = styled.span`
  font-size: 1.3rem;
  line-height: 1;
`;

const ToastName = styled.span<{ color: string }>`
  color: ${({ color }) => color};
  font-weight: 600;
  font-size: 0.8rem;
`;

const Controls = styled.div`
  pointer-events: all;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
`;

const Picker = styled.div`
  display: flex;
  gap: 0.4rem;
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 16px;
  padding: 0.5rem 0.65rem;
  animation: ${popIn} 0.15s ease;
`;

const EmojiBtn = styled.button`
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.15rem;
  border-radius: 8px;
  line-height: 1;
  transition: transform 0.1s;

  &:hover {
    transform: scale(1.3);
    background: rgba(255, 255, 255, 0.06);
  }
`;

const FAB = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid #2a2a3a;
  background: #12121a;
  font-size: 1.4rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, transform 0.15s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);

  &:hover {
    border-color: #4a4a6a;
    transform: scale(1.08);
  }
`;

// ── Component ────────────────────────────────────────────────────

let toastCounter = 0;

export function Reactions({ players }: ReactionsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const getColor = useCallback(
    (playerId: string) => {
      const idx = players.findIndex((p) => p.id === playerId);
      return PLAYER_COLORS[idx] ?? '#a855f7';
    },
    [players]
  );

  useEffect(() => {
    const handler = ({ playerId, playerName, emoji }: { playerId: string; playerName: string; emoji: string }) => {
      const color = getColor(playerId);
      const id = toastCounter++;
      setToasts((prev) => [...prev.slice(-4), { id, emoji, playerName, color }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    socket.on('reaction_received', handler);
    return () => { socket.off('reaction_received', handler); };
  }, [getColor]);

  const sendReaction = (emoji: string) => {
    socket.emit('send_reaction', { emoji });
    setPickerOpen(false);
  };

  return (
    <Container>
      {toasts.map((t) => (
        <ToastItem key={t.id} color={t.color}>
          <ToastEmoji>{t.emoji}</ToastEmoji>
          <ToastName color={t.color}>{t.playerName}</ToastName>
        </ToastItem>
      ))}

      <Controls>
        {pickerOpen && (
          <Picker>
            {REACTION_EMOJIS.map((emoji) => (
              <EmojiBtn key={emoji} onClick={() => sendReaction(emoji)}>
                {emoji}
              </EmojiBtn>
            ))}
          </Picker>
        )}
        <FAB onClick={() => setPickerOpen((v) => !v)} title="Reaction senden">
          {pickerOpen ? '✕' : '😄'}
        </FAB>
      </Controls>
    </Container>
  );
}
