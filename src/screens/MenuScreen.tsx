import styled from '@emotion/styled';
import type { Genre, Player } from '../types';
import { GENRE_META, PLAYER_COLORS } from '../constants';
import { Label } from '../components/Label';

interface MenuScreenProps {
  players: Player[];
  setPlayers: (players: Player[]) => void;
  genres: Genre[];
  onToggleGenre: (genre: Genre) => void;
  rounds: number;
  setRounds: (rounds: number) => void;
  onStart: () => void;
}

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
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 700;
  letter-spacing: -3px;
  background: linear-gradient(135deg, #ff2d78, #a855f7, #06d6a0);
  -webkit-background-clip: text;
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
  max-width: 450px;
`;

const GenreGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.45rem;
  margin-bottom: 1.4rem;
`;

const GenreButton = styled.button<{ color: string; active: string }>`
  padding: 0.55rem 0.4rem;
  border-radius: 10px;
  border: 1.5px solid ${({ active, color }) => (active === 'true' ? color : '#2a2a3a')};
  background: ${({ active, color }) => (active === 'true' ? `${color}12` : 'transparent')};
  color: ${({ active, color }) => (active === 'true' ? color : '#7a7a8e')};
  font-family: 'Outfit', sans-serif;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: ${({ active, color }) => (active === 'true' ? `0 0 18px ${color}18` : 'none')};
`;

const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.4rem;
`;

const PlayerRow = styled.div`
  display: flex;
  gap: 0.4rem;
  align-items: center;
`;

const PlayerBadge = styled.div<{ bg: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${({ bg }) => bg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  color: #08080d;
  flex-shrink: 0;
`;

const PlayerInput = styled.input`
  flex: 1;
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  border: 1.5px solid #2a2a3a;
  background: #08080d;
  color: #e8e8f0;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  outline: none;

  &:focus {
    border-color: #3a3a5a;
  }
`;

const RemoveButton = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 60, 60, 0.12);
  color: #ff6b6b;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 60, 60, 0.22);
  }
`;

const AddPlayerButton = styled.button`
  padding: 0.45rem;
  border-radius: 10px;
  border: 1.5px dashed #2a2a3a;
  background: transparent;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.78rem;
  cursor: pointer;

  &:hover {
    border-color: #4a4a6a;
    color: #9a9aae;
  }
`;

const RoundsRow = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.4rem;
`;

const RoundButton = styled.button<{ active: string }>`
  flex: 1;
  padding: 0.5rem;
  border-radius: 10px;
  border: 1.5px solid ${({ active }) => (active === 'true' ? '#06d6a0' : '#2a2a3a')};
  background: ${({ active }) => (active === 'true' ? 'rgba(6, 214, 160, 0.07)' : 'transparent')};
  color: ${({ active }) => (active === 'true' ? '#06d6a0' : '#7a7a8e')};
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    border-color: #06d6a0;
    color: #06d6a0;
  }
`;

const StartButton = styled.button`
  width: 100%;
  padding: 0.85rem;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  color: white;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 1px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
`;

const ApiNote = styled.div`
  margin-top: 0.75rem;
  text-align: center;
  font-size: 0.65rem;
  color: #555;
`;

export function MenuScreen({
  players,
  setPlayers,
  genres,
  onToggleGenre,
  rounds,
  setRounds,
  onStart,
}: MenuScreenProps) {
  return (
    <Screen>
      <Title>TUNELINE</Title>
      <Subtitle>Musik · Timeline · Challenge</Subtitle>

      <Card>
        <Label>Genres wählen</Label>
        <GenreGrid>
          {(Object.entries(GENRE_META) as [Genre, (typeof GENRE_META)[Genre]][]).map(([k, m]) => (
            <GenreButton
              key={k}
              color={m.color}
              active={String(genres.includes(k))}
              onClick={() => onToggleGenre(k)}
            >
              {m.icon} {m.label}
            </GenreButton>
          ))}
        </GenreGrid>

        <Label>Spieler</Label>
        <PlayerList>
          {players.map((p, i) => (
            <PlayerRow key={i}>
              <PlayerBadge bg={PLAYER_COLORS[i]}>{i + 1}</PlayerBadge>
              <PlayerInput
                value={p.name}
                onChange={(e) => {
                  const next = [...players];
                  next[i] = { name: e.target.value };
                  setPlayers(next);
                }}
              />
              {players.length > 2 && (
                <RemoveButton onClick={() => setPlayers(players.filter((_, j) => j !== i))}>
                  ×
                </RemoveButton>
              )}
            </PlayerRow>
          ))}
          {players.length < 6 && (
            <AddPlayerButton
              onClick={() => setPlayers([...players, { name: `Spieler ${players.length + 1}` }])}
            >
              + Spieler hinzufügen
            </AddPlayerButton>
          )}
        </PlayerList>

        <Label>Runden</Label>
        <RoundsRow>
          {[5, 10, 15, 20].map((n) => (
            <RoundButton key={n} active={String(rounds === n)} onClick={() => setRounds(n)}>
              {n}
            </RoundButton>
          ))}
        </RoundsRow>

        <StartButton onClick={onStart}>🎵 Spiel starten</StartButton>
        <ApiNote>Songs werden live von der Deezer API geladen</ApiNote>
      </Card>
    </Screen>
  );
}
