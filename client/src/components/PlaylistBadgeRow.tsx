import type { CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { SpotifyPlaylist } from '../types';
import { PlaylistBadge, PlaylistBadgeCover, PlaylistBadgeName } from './PlaylistBadge';

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;

const ChangeLink = styled.button`
  background: transparent;
  border: none;
  font-family: 'Outfit', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
  flex-shrink: 0;
  color: #7a7a8e;
  text-decoration: underline;

  &:hover {
    color: #9a9aae;
  }

  &[data-variant='purple'] {
    color: #a855f7;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
`;

interface PlaylistBadgeRowProps {
  playlists: SpotifyPlaylist[];
  onChangePlaylists: () => void;
  changeLabel?: string;
  changeLinkVariant?: 'default' | 'purple';
  style?: CSSProperties;
}

export function PlaylistBadgeRow({
  playlists,
  onChangePlaylists,
  changeLabel = 'ändern',
  changeLinkVariant = 'default',
  style,
}: PlaylistBadgeRowProps) {
  return (
    <Row style={style}>
      {playlists.length === 0 ? (
        <PlaylistBadge style={{ color: '#4a4a6a', background: 'none', border: '1px solid #2a2a3a' }}>
          Keine gewählt
        </PlaylistBadge>
      ) : (
        playlists.map((p) => (
          <PlaylistBadge key={p.id}>
            {p.coverUrl && <PlaylistBadgeCover src={p.coverUrl} alt={p.name} />}
            <PlaylistBadgeName>{p.name}</PlaylistBadgeName>
          </PlaylistBadge>
        ))
      )}
      <ChangeLink data-variant={changeLinkVariant} onClick={onChangePlaylists}>
        {changeLabel}
      </ChangeLink>
    </Row>
  );
}
