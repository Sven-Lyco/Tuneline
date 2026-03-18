import { type CSSProperties } from 'react';
import styled from '@emotion/styled';

const Tile = styled.div`
  background: #1a1a26;
  border: 2px solid #2a2a3a;
  border-radius: 14px;
  padding: 0.8rem 1rem;
  text-align: center;
  flex-shrink: 0;
  transition: all 0.3s;

  &[data-variant='timeline'] {
    min-width: 150px;
  }
  &[data-variant='result'] {
    min-width: 130px;
  }
  &[data-highlight='true'][data-variant='timeline'] {
    border-color: #06d6a0;
    box-shadow: 0 0 24px rgba(6, 214, 160, 0.25);
    animation: pop 0.4s ease-out;
  }
  &[data-highlight='true'][data-variant='result'] {
    border-color: #ff2d78;
    box-shadow: 0 0 18px rgba(255, 45, 120, 0.35);
    animation: pop 0.4s ease-out;
  }
`;

const Year = styled.div`
  color: #ff2d78;
  margin-bottom: 4px;

  &[data-variant='timeline'] {
    font-family: 'Outfit', sans-serif;
    font-size: 1.3rem;
    font-weight: 500;
  }
  &[data-variant='result'] {
    font-family: 'Space Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
  }
`;

const Title = styled.div`
  font-weight: 600;
  color: #e8e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &[data-variant='timeline'] {
    font-size: 0.88rem;
    max-width: 128px;
  }
  &[data-variant='result'] {
    font-size: 0.78rem;
    max-width: 118px;
  }
`;

const Artist = styled.div`
  color: #7a7a8e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;

  &[data-variant='timeline'] {
    font-size: 0.75rem;
    max-width: 128px;
  }
  &[data-variant='result'] {
    font-size: 0.65rem;
    max-width: 118px;
  }
`;

interface SongTileProps {
  year: number | string;
  title: string;
  artist: string;
  highlight?: boolean;
  variant?: 'timeline' | 'result';
  style?: CSSProperties;
}

export function SongTile({
  year,
  title,
  artist,
  highlight = false,
  variant = 'timeline',
  style,
}: SongTileProps) {
  return (
    <Tile data-variant={variant} data-highlight={String(highlight)} style={style}>
      <Year data-variant={variant}>{year}</Year>
      <Title data-variant={variant}>{title}</Title>
      <Artist data-variant={variant}>{artist}</Artist>
    </Tile>
  );
}
