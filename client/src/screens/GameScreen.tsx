import React from 'react';
import styled from '@emotion/styled';
import type { Feedback } from '../types';
import type { GameStateForClient, SongFull, SongMeta } from '@tuneline/shared';
import { PLAYER_COLORS } from '../constants';
import { Vinyl } from '../components/Vinyl';
import { Wave } from '../components/Wave';
import { DropZone } from '../components/DropZone';

interface GameScreenProps {
  myPlayerId: string;
  roomCode: string;
  isHost: boolean;
  gameState: GameStateForClient;
  currentSong: SongMeta;
  revealedSong: SongFull | null;
  feedback: Feedback;
  revealed: boolean;
  playing: boolean;
  volume: number;
  slot: number | null;
  setSlot: (slot: number | null) => void;
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

// ── Header ─────────────────────────────────────────────────────

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 2rem;
  background: #12121a;
  border-bottom: 1px solid #1e1e2e;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const HeaderTitle = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const RoundBadge = styled.div`
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: #7a7a8e;
  letter-spacing: 1.5px;
  text-transform: uppercase;
`;

const PlayerBadges = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const PlayerChip = styled.div<{ active: string; borderColor: string }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  border-radius: 20px;
  border: 1px solid ${({ active, borderColor }) => (active === 'true' ? borderColor : '#2a2a3a')};
  background: ${({ active }) => (active === 'true' ? 'rgba(255,45,120,0.07)' : '#1a1a26')};
  box-shadow: ${({ active }) => (active === 'true' ? '0 0 12px rgba(255,45,120,0.15)' : 'none')};
  font-size: 0.8rem;
  transition: all 0.3s;
`;

const PlayerDot = styled.div<{ bg: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
`;

const PlayerName = styled.span<{ active: string }>`
  color: ${({ active }) => (active === 'true' ? '#e8e8f0' : '#7a7a8e')};
  font-weight: ${({ active }) => (active === 'true' ? '600' : '400')};
`;

const PlayerScore = styled.span`
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 0.85rem;
  color: #06d6a0;
`;

// ── Song Card ──────────────────────────────────────────────────

const SongArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 2rem;
  flex-shrink: 0;
`;

const CurrentPlayerLabel = styled.div<{ color: string }>`
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: ${({ color }) => color};
  margin-bottom: 0.9rem;
  animation: glow 2s infinite;
`;

const SongCard = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 1.75rem 2rem;
  width: 100%;
  max-width: 680px;
  position: relative;
  overflow: hidden;
  animation: slideIn 0.4s ease-out;
`;

const SongCardAccent = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #ff2d78, #a855f7, #06d6a0);
`;

const SongCardBody = styled.div`
  display: flex;
  align-items: center;
  gap: 1.75rem;
  margin-bottom: 1rem;
`;

const SongInfo = styled.div`
  text-align: left;
  min-width: 0;
  flex: 1;
`;

const SongTitle = styled.div`
  font-size: 1.6rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.2rem;
`;

const SongArtist = styled.div`
  font-size: 1.05rem;
  color: #7a7a8e;
  margin-bottom: 0.6rem;
`;

const RevealedYear = styled.div`
  font-family: 'Outfit', sans-serif;
  font-size: 2.5rem;
  font-weight: 800;
  color: #06d6a0;
  animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
`;

const AudioButton = styled.button`
  padding: 0.45rem 1.2rem;
  border-radius: 10px;
  border: 1.5px solid #ff2d78;
  background: rgba(255, 45, 120, 0.08);
  color: #ff2d78;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 45, 120, 0.18);
  }
`;

const AudioControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.5rem;
`;

const VolumeIcon = styled.span`
  font-size: 0.85rem;
  color: #7a7a8e;
  flex-shrink: 0;
`;

const VolumeSlider = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 90px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    #ff2d78 0%,
    #ff2d78 var(--val),
    #2a2a3a var(--val),
    #2a2a3a 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ff2d78;
    cursor: pointer;
  }
  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ff2d78;
    border: none;
    cursor: pointer;
  }
`;

const PlacementHint = styled.div`
  font-size: 0.88rem;
  color: #7a7a8e;
  margin-top: 0.6rem;
  text-align: center;
`;

const WaitingLabel = styled.div`
  font-size: 0.88rem;
  color: #7a7a8e;
  margin-top: 0.6rem;
  text-align: center;
  animation: pulse 1.5s ease-in-out infinite;
`;

// ── Feedback bar ───────────────────────────────────────────────

const FeedbackBar = styled.div<{ ok: string }>`
  text-align: center;
  padding: 0.75rem 1rem;
  font-weight: 700;
  font-size: 1.05rem;
  flex-shrink: 0;
  background: ${({ ok }) => (ok === 'true' ? 'rgba(6,214,160,0.08)' : 'rgba(255,68,68,0.08)')};
  color: ${({ ok }) => (ok === 'true' ? '#06d6a0' : '#ff6b6b')};
  border-top: ${({ ok }) => `2px solid ${ok === 'true' ? '#06d6a0' : '#ff4444'}`};
  border-bottom: ${({ ok }) => `1px solid ${ok === 'true' ? '#06d6a044' : '#ff444433'}`};
  animation: slideIn 0.3s ease-out;
`;

// ── My Timeline ────────────────────────────────────────────────

const TimelineSection = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TimelineLabel = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.75rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #4a4a6a;
  text-align: center;
`;

const TimelineArea = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  align-items: center;
  min-height: 150px;
  padding: 0.5rem 0;

  &::-webkit-scrollbar {
    height: 5px;
  }
  &::-webkit-scrollbar-track {
    background: #12121a;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #2a2a3a;
    border-radius: 3px;
  }
`;

const TimelineInner = styled.div`
  display: flex;
  align-items: center;
  min-width: min-content;
  padding: 0.5rem 2rem;
`;

const SongTile = styled.div<{ highlight: string }>`
  background: #1a1a26;
  border: 2px solid ${({ highlight }) => (highlight === 'true' ? '#06d6a0' : '#2a2a3a')};
  border-radius: 14px;
  padding: 0.8rem 1rem;
  text-align: center;
  min-width: 150px;
  box-shadow: ${({ highlight }) =>
    highlight === 'true' ? '0 0 24px rgba(6,214,160,0.25)' : 'none'};
  animation: ${({ highlight }) => (highlight === 'true' ? 'pop 0.4s ease-out' : 'none')};
  transition: all 0.3s;
  flex-shrink: 0;
`;

const TileYear = styled.div`
  font-family: 'Outfit', sans-serif;
  font-size: 1.3rem;
  font-weight: 500;
  color: #ff2d78;
  margin-bottom: 4px;
`;

const TileTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  color: #e8e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
`;

const TileArtist = styled.div`
  font-size: 0.75rem;
  color: #7a7a8e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 128px;
  margin-top: 2px;
`;

// ── Other players ──────────────────────────────────────────────

const OthersSection = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 0 2rem 0.5rem;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #2a2a3a;
    border-radius: 3px;
  }
`;

const OtherPlayerPanel = styled.div<{ isActive: string; borderColor: string }>`
  background: #12121a;
  border: 1px solid
    ${({ isActive, borderColor }) => (isActive === 'true' ? borderColor : '#1e1e2e')};
  border-radius: 14px;
  padding: 0.75rem 1rem;
  min-width: 200px;
  flex-shrink: 0;
`;

const OtherPlayerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
`;

const OtherDot = styled.div<{ bg: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
`;

const OtherName = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  color: #e8e8f0;
  flex: 1;
`;

const OtherScore = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.85rem;
  color: #06d6a0;
  font-weight: 700;
`;

const OtherTimeline = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
`;

const MiniTile = styled.div`
  background: #1a1a26;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 0.2rem 0.4rem;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: #ff2d78;
`;

// ── Room Code (Header) ─────────────────────────────────────────

const RoomCodeBadge = styled.button`
  background: transparent;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 0.25rem 0.6rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: #4a4a6a;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: #4a4a6a;
    color: #7a7a8e;
  }
`;

// ── Disconnect Overlay ─────────────────────────────────────────

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

const DisconnectCard = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  margin: 1.5rem;
  text-align: center;
`;

const DisconnectIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
`;

const DisconnectTitle = styled.div`
  font-size: 1.15rem;
  font-weight: 700;
  color: #e8e8f0;
  margin-bottom: 0.5rem;
`;

const DisconnectSub = styled.div`
  font-size: 0.88rem;
  color: #7a7a8e;
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const DisconnectRoomCode = styled.div`
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

const DisconnectActions = styled.div`
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

// ── Place Button ───────────────────────────────────────────────

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
`;

// ── Component ──────────────────────────────────────────────────

export function GameScreen({
  myPlayerId,
  roomCode,
  isHost,
  gameState,
  currentSong,
  revealedSong,
  feedback,
  revealed,
  playing,
  volume,
  slot,
  setSlot,
  onToggleAudio,
  onVolumeChange,
  onPlace,
  disconnectedPlayer,
  onSkipPlayer,
}: GameScreenProps) {
  const isMyTurn = gameState.currentPlayerId === myPlayerId;
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId);
  const activePlayer = gameState.players.find((p) => p.id === gameState.currentPlayerId);
  const otherPlayers = gameState.players.filter((p) => p.id !== myPlayerId);

  const myTimeline = [...(myPlayer?.timeline ?? [])].sort((a, b) => a.year - b.year);
  const isReady = isMyTurn && slot !== null && !revealed;
  const centered = myTimeline.length <= 4;

  // For the song card: show year from revealedSong after placement
  const displayYear = revealed && revealedSong ? revealedSong.year : null;

  return (
    <Screen>
      {/* Header */}
      <Header>
        <HeaderTitle>TUNELINE</HeaderTitle>
        <RoundBadge>
          RUNDE {gameState.round}/{gameState.rounds}
        </RoundBadge>
        <RoomCodeBadge
          onClick={() => { void navigator.clipboard.writeText(roomCode); }}
          title="Raum-Code kopieren"
        >
          {roomCode}
        </RoomCodeBadge>
        <PlayerBadges>
          {gameState.players.map((p, i) => (
            <PlayerChip
              key={p.id}
              active={String(p.id === gameState.currentPlayerId)}
              borderColor={PLAYER_COLORS[i] ?? '#ff2d78'}
            >
              <PlayerDot bg={PLAYER_COLORS[i] ?? '#7a7a8e'} />
              <PlayerName active={String(p.id === gameState.currentPlayerId)}>
                {p.name}
                {p.id === myPlayerId ? ' (du)' : ''}
              </PlayerName>
              <PlayerScore>{p.score}</PlayerScore>
            </PlayerChip>
          ))}
        </PlayerBadges>
      </Header>

      <GameBody>
        {/* Song Card */}
        <SongArea>
          <CurrentPlayerLabel
            color={
              PLAYER_COLORS[
                gameState.players.findIndex((p) => p.id === gameState.currentPlayerId)
              ] ?? '#ff2d78'
            }
          >
            ● {activePlayer?.name ?? '?'} ist dran
          </CurrentPlayerLabel>
          <SongCard>
            <SongCardAccent />
            <SongCardBody>
              <Vinyl spinning={playing} cover={currentSong.cover} size={120} />
              <SongInfo>
                <SongTitle>{currentSong.title}</SongTitle>
                <SongArtist>{currentSong.artist}</SongArtist>
                {displayYear !== null && <RevealedYear>{displayYear}</RevealedYear>}
                {!revealed && (
                  <AudioControls>
                    <AudioButton onClick={onToggleAudio}>
                      {playing ? '⏸ Pause' : '▶ Play'}
                    </AudioButton>
                    <VolumeIcon>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</VolumeIcon>
                    <VolumeSlider
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      style={{ '--val': `${volume * 100}%` } as React.CSSProperties}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    />
                  </AudioControls>
                )}
              </SongInfo>
            </SongCardBody>
            <Wave active={playing} />
            {!revealed && isMyTurn && (
              <PlacementHint>Wähle die richtige Position in deiner Timeline ↓</PlacementHint>
            )}
            {!revealed && !isMyTurn && (
              <WaitingLabel>Warten auf {activePlayer?.name ?? '?'}…</WaitingLabel>
            )}
          </SongCard>
        </SongArea>

        {/* Feedback */}
        {feedback && (
          <FeedbackBar ok={String(feedback === 'ok')}>
            {feedback === 'ok'
              ? '✓ Richtig platziert! +1 Punkt'
              : `✗ Falsch! Der Song war von ${revealedSong?.year ?? '?'}.`}
          </FeedbackBar>
        )}

        {/* My Timeline */}
        <TimelineSection>
          <TimelineLabel>— Deine Timeline —</TimelineLabel>
          <TimelineArea style={{ justifyContent: centered ? 'center' : 'flex-start' }}>
            <TimelineInner>
              <DropZone
                active={slot === 0}
                onClick={() => isMyTurn && !revealed && setSlot(0)}
                disabled={!isMyTurn || revealed}
              />
              {myTimeline.map((s, i) => {
                const isNewSong = revealed && feedback === 'ok' && revealedSong?.id === s.id;
                return (
                  <div key={`${s.id}-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                    <SongTile highlight={String(isNewSong)}>
                      <TileYear>{s.year}</TileYear>
                      <TileTitle>{s.title}</TileTitle>
                      <TileArtist>{s.artist}</TileArtist>
                    </SongTile>
                    <DropZone
                      active={slot === i + 1}
                      onClick={() => isMyTurn && !revealed && setSlot(i + 1)}
                      disabled={!isMyTurn || revealed}
                    />
                  </div>
                );
              })}
            </TimelineInner>
          </TimelineArea>
        </TimelineSection>

        {/* Other players' timelines */}
        {otherPlayers.length > 0 && (
          <OthersSection>
            {otherPlayers.map((p, _idx) => {
              const globalIdx = gameState.players.findIndex((gp) => gp.id === p.id);
              const sortedTl = [...p.timeline].sort((a, b) => a.year - b.year);
              return (
                <OtherPlayerPanel
                  key={p.id}
                  isActive={String(p.id === gameState.currentPlayerId)}
                  borderColor={PLAYER_COLORS[globalIdx] ?? '#7a7a8e'}
                >
                  <OtherPlayerHeader>
                    <OtherDot bg={PLAYER_COLORS[globalIdx] ?? '#7a7a8e'} />
                    <OtherName>{p.name}</OtherName>
                    <OtherScore>{p.score} Pkt</OtherScore>
                  </OtherPlayerHeader>
                  <OtherTimeline>
                    {sortedTl.length === 0 ? (
                      <span style={{ fontSize: '0.65rem', color: '#3a3a5a' }}>leer</span>
                    ) : (
                      sortedTl.map((s, si) => (
                        <MiniTile key={`${s.id}-${si}`} title={`${s.title} — ${s.artist}`}>
                          {s.year}
                        </MiniTile>
                      ))
                    )}
                  </OtherTimeline>
                </OtherPlayerPanel>
              );
            })}
          </OthersSection>
        )}

        {/* Place Button */}
        <PlaceButtonRow>
          <PlaceButton ready={String(isReady)} disabled={!isReady} onClick={onPlace}>
            {!isMyTurn
              ? `Warten auf ${activePlayer?.name ?? '?'}…`
              : slot !== null
                ? 'Hier platzieren ▶'
                : 'Position wählen...'}
          </PlaceButton>
        </PlaceButtonRow>
      </GameBody>

      {/* Disconnect Overlay */}
      {disconnectedPlayer && (
        <Overlay>
          <DisconnectCard>
            <DisconnectIcon>📵</DisconnectIcon>
            <DisconnectTitle>
              {disconnectedPlayer.isHostDisconnected
                ? 'Host hat die Verbindung verloren'
                : `${disconnectedPlayer.name} hat die Verbindung verloren`}
            </DisconnectTitle>
            <DisconnectSub>
              {disconnectedPlayer.isHostDisconnected
                ? 'Das Spiel wurde beendet. Ergebnis wird gleich angezeigt.'
                : isHost
                ? 'Teile den Raum-Code damit der Spieler wieder beitreten kann:'
                : 'Das Spiel ist pausiert. Der Host entscheidet wie es weitergeht.'}
            </DisconnectSub>

            {!disconnectedPlayer.isHostDisconnected && (
              <DisconnectRoomCode>{roomCode}</DisconnectRoomCode>
            )}

            {isHost && !disconnectedPlayer.isHostDisconnected && (
              <DisconnectActions>
                <SkipButton onClick={onSkipPlayer}>
                  Ohne {disconnectedPlayer.name} weiterspielen
                </SkipButton>
                <WaitButton disabled>
                  Warten auf Reconnect…
                </WaitButton>
              </DisconnectActions>
            )}
          </DisconnectCard>
        </Overlay>
      )}
    </Screen>
  );
}
