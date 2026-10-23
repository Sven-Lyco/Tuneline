import styled from '@emotion/styled';

const Notice = styled.p`
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.5;
  color: #7a7a8e;
  text-align: center;
`;

const Link = styled.button`
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: #b8b8cc;
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: #e8e8f0;
  }
`;

interface LegalNoticeProps {
  /** What the user is doing, e.g. "Mit dem Login". */
  action: string;
  onTerms: () => void;
  onPrivacy: () => void;
}

/** Shown before the Spotify login and before joining, as Spotify's terms ask. */
export function LegalNotice({ action, onTerms, onPrivacy }: LegalNoticeProps) {
  return (
    <Notice>
      {action} akzeptierst du die <Link onClick={onTerms}>Nutzungsbedingungen</Link> und die{' '}
      <Link onClick={onPrivacy}>Datenschutzerklärung</Link>.
    </Notice>
  );
}
