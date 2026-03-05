import styled from '@emotion/styled';

interface VinylProps {
  spinning: boolean;
  cover: string | null;
  size?: number;
}

const Outer = styled.div`
  border-radius: 50%;
  flex-shrink: 0;
  background: radial-gradient(
    circle,
    #111 18%,
    #1a1a1a 19%,
    #222 38%,
    #111 39%,
    #111 42%,
    #2a2a2a 43%,
    #2a2a2a 44%,
    #111 45%
  );
  box-shadow: 0 4px 25px rgba(0, 0, 0, 0.5);
  position: relative;
`;

const CoverArt = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 2px solid #333;
`;

const Pin = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #555;
  border: 1px solid #777;
`;

export function Vinyl({ spinning, cover, size = 85 }: VinylProps) {
  const coverSize = size * 0.36;
  return (
    <Outer
      style={{
        width: size,
        height: size,
        animation: spinning ? 'spin 2.5s linear infinite' : 'none',
      }}
    >
      {cover && (
        <CoverArt
          style={{
            width: coverSize,
            height: coverSize,
            backgroundImage: `url(${cover})`,
          }}
        />
      )}
      <Pin />
    </Outer>
  );
}
