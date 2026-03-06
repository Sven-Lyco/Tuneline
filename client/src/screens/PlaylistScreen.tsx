import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import type { SpotifyPlaylist } from '../types';
import { getUserPlaylists } from '../api/spotify';

interface PlaylistScreenProps {
  selected: SpotifyPlaylist[];
  onToggle: (playlist: SpotifyPlaylist) => void;
  onConfirm: () => void;
  onLogout: () => void;
}

// ── Styles ─────────────────────────────────────────────────────

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 2rem 1.5rem;
  position: relative;
  z-index: 1;
`;

const Header = styled.div`
  width: 100%;
  max-width: 680px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const Title = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 1.4rem;
  font-weight: 700;
  background: linear-gradient(135deg, #ff2d78, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const LogoutButton = styled.button`
  background: transparent;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.78rem;
  padding: 0.4rem 0.8rem;
  cursor: pointer;

  &:hover {
    border-color: #4a4a6a;
    color: #9a9aae;
  }
`;

const Hint = styled.p`
  font-size: 0.95rem;
  color: #7a7a8e;
  margin: 0 0 1.5rem;
  width: 100%;
  max-width: 680px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  width: 100%;
  max-width: 680px;
  flex: 1;
`;

const PlaylistCard = styled.button<{ selected: string }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: ${({ selected }) => (selected === 'true' ? 'rgba(29,185,84,0.07)' : '#12121a')};
  border: 1.5px solid
    ${({ selected }) => (selected === 'true' ? '#1db954' : '#2a2a3a')};
  border-radius: 14px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background 0.2s;
  box-shadow: ${({ selected }) =>
    selected === 'true' ? '0 0 18px rgba(29,185,84,0.2)' : 'none'};

  &:hover {
    border-color: ${({ selected }) => (selected === 'true' ? '#1db954' : '#4a4a6a')};
  }
`;

const CoverWrapper = styled.div`
  width: 100%;
  aspect-ratio: 1;
  background: #1e1e2e;
  position: relative;
  overflow: hidden;
`;

const CoverImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const CoverPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
`;

const CheckBadge = styled.div`
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1db954;
  color: #000;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CardInfo = styled.div`
  padding: 0.6rem 0.7rem 0.65rem;
  width: 100%;
`;

const CardName = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #e8e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardMeta = styled.div`
  font-size: 0.78rem;
  color: #7a7a8e;
  margin-top: 2px;
`;

const Footer = styled.div`
  width: 100%;
  max-width: 680px;
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const SelectedCount = styled.div`
  font-size: 0.95rem;
  color: #7a7a8e;
  flex: 1;
`;

const ConfirmButton = styled.button<{ ready: string }>`
  padding: 0.8rem 2rem;
  border-radius: 14px;
  border: none;
  background: ${({ ready }) =>
    ready === 'true' ? '#1db954' : '#1e1e2e'};
  color: ${({ ready }) => (ready === 'true' ? '#000' : '#444')};
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: ${({ ready }) => (ready === 'true' ? 'pointer' : 'not-allowed')};
  transition: all 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const StatusText = styled.div`
  color: #7a7a8e;
  font-size: 0.85rem;
  text-align: center;
  padding: 2rem 0;
`;

// ── Component ──────────────────────────────────────────────────

export function PlaylistScreen({ selected, onToggle, onConfirm, onLogout }: PlaylistScreenProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserPlaylists()
      .then(setPlaylists)
      .finally(() => setLoading(false));
  }, []);

  const isSelected = (p: SpotifyPlaylist) => selected.some((s) => s.id === p.id);
  const canConfirm = selected.length > 0;

  return (
    <Screen>
      <Header>
        <Title>TUNELINE</Title>
        <LogoutButton onClick={onLogout}>Abmelden</LogoutButton>
      </Header>

      <Hint>Wähle eine oder mehrere Playlisten aus:</Hint>

      {loading && <StatusText>Playlisten werden geladen...</StatusText>}
      {!loading && playlists.length === 0 && (
        <StatusText>Keine Playlisten gefunden.</StatusText>
      )}

      <Grid>
        {playlists.map((p) => (
          <PlaylistCard
            key={p.id}
            selected={String(isSelected(p))}
            onClick={() => onToggle(p)}
          >
            <CoverWrapper>
              {p.coverUrl ? (
                <CoverImg
                  src={p.coverUrl}
                  alt={p.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <CoverPlaceholder>🎵</CoverPlaceholder>
              )}
              {isSelected(p) && <CheckBadge>✓</CheckBadge>}
            </CoverWrapper>
            <CardInfo>
              <CardName>{p.name}</CardName>
              <CardMeta>{p.trackCount} Songs</CardMeta>
            </CardInfo>
          </PlaylistCard>
        ))}
      </Grid>

      <Footer>
        <SelectedCount>
          {selected.length === 0
            ? 'Keine Playlist gewählt'
            : `${selected.length} Playlist${selected.length > 1 ? 'en' : ''} gewählt`}
        </SelectedCount>
        <ConfirmButton
          ready={String(canConfirm)}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          Weiter →
        </ConfirmButton>
      </Footer>
    </Screen>
  );
}
