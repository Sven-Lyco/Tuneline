import React, { useMemo } from 'react';
import styled from '@emotion/styled';
import type { SongFull, SongMeta } from '@tuneline/shared';
import type { Feedback } from '../../types';
import { Vinyl } from '../Vinyl';
import { Wave } from '../Wave';

interface SongCardProps {
  currentSong: SongMeta;
  revealedSong: SongFull | null;
  revealed: boolean;
  feedback: Feedback;
  lastPlacedPlayerName: string | null;
  lastPlacedIsMe: boolean;
  playing: boolean;
  volume: number;
  isMyTurn: boolean;
  activePlayerName: string;
  activePlayerColor: string;
  onToggleAudio: () => void;
  onVolumeChange: (v: number) => void;
}

const SongArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 2rem;
  flex-shrink: 0;

  @media (max-width: 480px) {
    padding: 0 1rem;
  }
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

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 1.75rem 2rem;
  width: 100%;
  max-width: 680px;
  position: relative;
  overflow: hidden;
  animation: slideIn 0.4s ease-out;

  @media (max-width: 480px) {
    padding: 1.25rem 1rem;
    border-radius: 16px;
  }
`;

const CardAccent = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #ff2d78, #a855f7, #06d6a0);
`;

const CardBody = styled.div`
  display: flex;
  align-items: center;
  gap: 1.75rem;
  margin-bottom: 1rem;

  @media (max-width: 480px) {
    gap: 1rem;
  }
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
  transition: filter 0.3s;

  &[data-blurred='true'] {
    filter: blur(10px);
    user-select: none;
  }

  @media (max-width: 480px) {
    font-size: 1.2rem;
  }
`;

const SongArtist = styled.div`
  font-size: 1.05rem;
  color: #7a7a8e;
  margin-bottom: 0.6rem;
  transition: filter 0.3s;

  &[data-blurred='true'] {
    filter: blur(8px);
    user-select: none;
  }

  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

const RevealedYear = styled.div`
  font-family: 'Outfit', sans-serif;
  font-size: 2.5rem;
  font-weight: 800;
  color: #06d6a0;
  animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
`;

const AudioControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.5rem;
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

const FeedbackOverlay = styled.div<{ ok: string }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.65rem 1rem;
  text-align: center;
  font-weight: 700;
  font-size: 1rem;
  background: ${({ ok }) => (ok === 'true' ? 'rgba(6,214,160,0.12)' : 'rgba(255,68,68,0.12)')};
  color: ${({ ok }) => (ok === 'true' ? '#06d6a0' : '#ff6b6b')};
  border-top: 1px solid ${({ ok }) => (ok === 'true' ? '#06d6a044' : '#ff444433')};
  animation: slideIn 0.3s ease-out;
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

export function SongCard({
  currentSong,
  revealedSong,
  revealed,
  feedback,
  lastPlacedPlayerName,
  lastPlacedIsMe,
  playing,
  volume,
  isMyTurn,
  activePlayerName,
  activePlayerColor,
  onToggleAudio,
  onVolumeChange,
}: SongCardProps) {
  const vinylSize = useMemo(() => window.matchMedia('(max-width: 480px)').matches ? 80 : 120, []);
  const displayYear = revealed && revealedSong ? revealedSong.year : null;

  return (
    <SongArea>
      <CurrentPlayerLabel color={activePlayerColor}>
        ● {activePlayerName} ist dran
      </CurrentPlayerLabel>
      <Card>
        <CardAccent />
        <CardBody>
          <Vinyl spinning={playing} cover={currentSong.cover} size={vinylSize} />
          <SongInfo>
            <SongTitle data-blurred={String(isMyTurn && !revealed)}>{currentSong.title}</SongTitle>
            <SongArtist data-blurred={String(isMyTurn && !revealed)}>{currentSong.artist}</SongArtist>
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
        </CardBody>
        <Wave active={playing} />
        {isMyTurn ? (
          <PlacementHint style={{ visibility: revealed ? 'hidden' : 'visible' }}>
            Wähle die richtige Position in deiner Timeline ↓
          </PlacementHint>
        ) : (
          <WaitingLabel style={{ visibility: revealed ? 'hidden' : 'visible' }}>
            Warten auf {activePlayerName}…
          </WaitingLabel>
        )}
        {feedback && (
          <FeedbackOverlay ok={String(feedback === 'ok')}>
            {feedback === 'ok'
              ? `✓ Richtig! +1 Punkt für ${lastPlacedIsMe ? 'dich' : (lastPlacedPlayerName ?? activePlayerName)}`
              : `✗ Falsch! Der Song war von ${revealedSong?.year ?? '?'}.`}
          </FeedbackOverlay>
        )}
      </Card>
    </SongArea>
  );
}
