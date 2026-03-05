import styled from '@emotion/styled';

interface WaveProps {
  active: boolean;
}

const Container = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;
  transition: opacity 0.3s;
  justify-content: center;
`;

const Bar = styled.div`
  width: 2.5px;
  border-radius: 2px;
  min-height: 3px;
  background: linear-gradient(to top, #ff2d78, #a855f7);
`;

export function Wave({ active }: WaveProps) {
  return (
    <Container style={{ opacity: active ? 1 : 0.25 }}>
      {Array.from({ length: 24 }, (_, i) => (
        <Bar
          key={i}
          style={{
            animation: active ? `wave 0.7s ${i * 0.04}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </Container>
  );
}
