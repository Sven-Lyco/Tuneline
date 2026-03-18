import type { CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { AudioMode } from '@tuneline/shared';
import { PillButton } from './PillButton';

const Row = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

interface AudioModePickerProps {
  value: AudioMode;
  onChange: (mode: AudioMode) => void;
  style?: CSSProperties;
}

export function AudioModePicker({ value, onChange, style }: AudioModePickerProps) {
  return (
    <Row style={style}>
      <PillButton active={value === 'all'} color="purple" onClick={() => onChange('all')}>
        🔊 Alle hören
      </PillButton>
      <PillButton
        active={value === 'host-only'}
        color="purple"
        onClick={() => onChange('host-only')}
      >
        📺 Nur Host
      </PillButton>
    </Row>
  );
}
