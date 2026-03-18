import type { CSSProperties } from 'react';
import styled from '@emotion/styled';
import { PillButton } from './PillButton';

const Row = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
`;

interface RoundsPickerProps {
  value: number;
  onChange: (rounds: number) => void;
  style?: CSSProperties;
}

export function RoundsPicker({ value, onChange, style }: RoundsPickerProps) {
  return (
    <Row style={style}>
      {[5, 10, 15, 20].map((n) => (
        <PillButton key={n} active={value === n} color="teal" onClick={() => onChange(n)}>
          {n}
        </PillButton>
      ))}
    </Row>
  );
}
