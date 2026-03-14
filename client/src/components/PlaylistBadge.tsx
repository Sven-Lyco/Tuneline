import styled from '@emotion/styled';

export const PlaylistBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.7rem;
  background: rgba(29, 185, 84, 0.08);
  border: 1px solid rgba(29, 185, 84, 0.3);
  border-radius: 20px;
  font-size: 0.75rem;
  color: #1db954;
  max-width: 160px;
`;

export const PlaylistBadgeCover = styled.img`
  width: 18px;
  height: 18px;
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
`;

export const PlaylistBadgeName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
