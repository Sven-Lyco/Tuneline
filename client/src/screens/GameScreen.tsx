import { useMemo } from 'react';
import styled from '@emotion/styled';
import type { Feedback } from '../types';
import type { GameStateForClient, SongFull, SongMeta } from '@tuneline/shared';
import { getPlayerColor } from '../constants';
import { sortByYear } from '../utils/shuffle';
import { GameHeader } from '../components/game/GameHeader';
import { SongCard } from '../components/game/SongCard';
import { MyTimeline } from '../components/game/MyTimeline';
import { OtherPlayers } from '../components/game/OtherPlayers';
import { DisconnectOverlay } from '../components/game/DisconnectOverlay';
import { Reactions } from '../components/Reactions';

interface GameScreenProps {
  myPlayerId: string;
  roomCode: string;
  isHost: boolean;
  gameState: GameStateForClient;
  turnEndsAt: number | null;
  currentSong: SongMeta;
  revealedSong: SongFull | null;
  feedback: Feedback;
  revealed: boolean;
  lastPlacedPlayerId: string | null;
  playing: boolean;
  volume: number;
  slot: number | null;
  setSlot: (slot: number | null) => void;
  placing: boolean;
  onToggleAudio: () => void;
  onVolumeChange: (v: number) => void;
  onPlace: () => void;
  disconnectedPlayer: { id: string; name: string; isHostDisconnected: boolean } | null;
  onSkipPlayer: () => void;
}

// ── Layout ─────────────────────────────────────────────────────

const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
`;

const GameBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 0 1.5rem;
  width: 100%;
`;

const PlaceButtonRow = styled.div`
  display: flex;
  justify-content: center;
  padding: 0 2rem;
  flex-shrink: 0;
`;

const PlaceButton = styled.button<{ ready: string }>`
  padding: 1rem 4rem;
  border-radius: 16px;
  border: none;
  background: ${({ ready }) =>
    ready === 'true' ? 'linear-gradient(135deg, #06d6a0, #04b890)' : '#1e1e2e'};
  color: ${({ ready }) => (ready === 'true' ? '#08080d' : '#444')};
  font-family: 'Outfit', sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: ${({ ready }) => (ready === 'true' ? 'pointer' : 'not-allowed')};
  transition: all 0.25s;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(6, 214, 160, 0.25);
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 1rem 2rem;
  }
`;

const SpectatorBanner = styled.div`
  margin: 1rem auto 0;
  padding: 0.6rem 1.1rem;
  border-radius: 12px;
  border: 1px solid #2a2a3a;
  background: #12121a;
  color: #7a7a8e;
  font-size: 0.85rem;
  text-align: center;
  max-width: 90vw;
`;

// ── Component ──────────────────────────────────────────────────

export function GameScreen({
  myPlayerId,
  roomCode,
  isHost,
  gameState,
  turnEndsAt,
  currentSong,
  revealedSong,
  feedback,
  revealed,
  lastPlacedPlayerId,
  playing,
  volume,
  slot,
  setSlot,
  placing,
  onToggleAudio,
  onVolumeChange,
  onPlace,
  disconnectedPlayer,
  onSkipPlayer,
}: GameScreenProps) {
  const isMyTurn = gameState.currentPlayerId === myPlayerId;
  // Not in the turn order: joined too late for the deck, or offline when the game started.
  const isSpectator = !gameState.players.some((p) => p.id === myPlayerId);
  const hasAudio = gameState.audioMode === 'all' || isHost;
  const { activePlayer, lastPlacedPlayer, otherPlayers, myTimeline, activePlayerColor } =
    useMemo(() => {
      const myPlayer = gameState.players.find((p) => p.id === myPlayerId);
      const activePlayerIndex = gameState.players.findIndex(
        (p) => p.id === gameState.currentPlayerId
      );
      return {
        myPlayer,
        activePlayer: gameState.players.find((p) => p.id === gameState.currentPlayerId),
        lastPlacedPlayer: gameState.players.find((p) => p.id === lastPlacedPlayerId),
        otherPlayers: gameState.players.filter((p) => p.id !== myPlayerId),
        myTimeline: sortByYear(myPlayer?.timeline ?? []),
        activePlayerColor: getPlayerColor(activePlayerIndex),
      };
    }, [gameState.players, gameState.currentPlayerId, myPlayerId, lastPlacedPlayerId]);
  const isReady = isMyTurn && slot !== null && !revealed && !placing;

  let placeLabel = 'Position wählen...';
  if (!isMyTurn) placeLabel = `Warten auf ${activePlayer?.name ?? '?'}…`;
  else if (placing) placeLabel = 'Wird platziert…';
  else if (slot !== null) placeLabel = 'Hier platzieren ▶';

  return (
    <Screen>
      <GameHeader
        roomCode={roomCode}
        players={gameState.players}
        currentPlayerId={gameState.currentPlayerId}
        round={gameState.round}
        rounds={gameState.rounds}
        myPlayerId={myPlayerId}
      />

      {isSpectator && (
        <SpectatorBanner>
          👀 Du schaust gerade zu – in der nächsten Partie bist du wieder dabei.
        </SpectatorBanner>
      )}

      <GameBody>
        <SongCard
          hasAudio={hasAudio}
          turnEndsAt={turnEndsAt}
          currentSong={currentSong}
          revealedSong={revealedSong}
          revealed={revealed}
          feedback={feedback}
          lastPlacedPlayerName={lastPlacedPlayer?.name ?? null}
          lastPlacedIsMe={lastPlacedPlayerId === myPlayerId}
          playing={playing}
          volume={volume}
          isMyTurn={isMyTurn}
          activePlayerName={activePlayer?.name ?? '?'}
          activePlayerColor={activePlayerColor}
          onToggleAudio={onToggleAudio}
          onVolumeChange={onVolumeChange}
        />

        <MyTimeline
          timeline={myTimeline}
          slot={slot}
          setSlot={setSlot}
          revealed={revealed}
          isMyTurn={isMyTurn}
          feedback={feedback}
          revealedSong={revealedSong}
        />

        {otherPlayers.length > 0 && (
          <OtherPlayers
            players={otherPlayers}
            allPlayers={gameState.players}
            currentPlayerId={gameState.currentPlayerId}
          />
        )}

        <PlaceButtonRow>
          <PlaceButton ready={String(isReady)} disabled={!isReady} onClick={onPlace}>
            {placeLabel}
          </PlaceButton>
        </PlaceButtonRow>
      </GameBody>

      <Reactions players={gameState.players} />

      {disconnectedPlayer && (
        <DisconnectOverlay
          disconnectedPlayer={disconnectedPlayer}
          roomCode={roomCode}
          isHost={isHost}
          onSkipPlayer={onSkipPlayer}
        />
      )}
    </Screen>
  );
}
