import styled from '@emotion/styled';
import { redirectToSpotify } from '../api/spotify';

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
  margin-bottom: 3rem;
`;

const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const Tagline = styled.p`
  font-size: 0.9rem;
  color: #7a7a8e;
  text-align: center;
  line-height: 1.6;
  margin: 0;
`;

const SpotifyButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 0.9rem 1.5rem;
  border-radius: 50px;
  border: none;
  background: #1db954;
  color: #000;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: background 0.2s, transform 0.15s;
  margin-top: 0.5rem;

  &:hover {
    background: #1ed760;
    transform: translateY(-1px);
  }
`;

const SpotifyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export function LoginScreen() {
  return (
    <Screen>
      <Title>TUNELINE</Title>
      <Subtitle>Musik · Timeline · Challenge</Subtitle>

      <Card>
        <Tagline>
          Verbinde dein Spotify-Konto und spiele mit deinen eigenen Playlisten.
        </Tagline>
        <SpotifyButton onClick={() => void redirectToSpotify()}>
          <SpotifyIcon />
          Mit Spotify anmelden
        </SpotifyButton>
      </Card>
    </Screen>
  );
}
