import type { CSSProperties } from 'react';
import styled from '@emotion/styled';
import { TURN_LIMITS } from '@tuneline/shared';
import { PillButton } from './PillButton';

const Row = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
`;

interface TurnLimitPickerProps {
  value: number;
  onChange: (seconds: number) => void;
  style?: CSSProperties;
}

export function TurnLimitPicker({ value, onChange, style }: TurnLimitPickerProps) {
  return (
    <Row style={style}>
      {TURN_LIMITS.map((s) => (
        <PillButton key={s} active={value === s} color="teal" onClick={() => onChange(s)}>
          {s === 0 ? 'Aus' : `${s}s`}
        </PillButton>
      ))}
    </Row>
  );
}
