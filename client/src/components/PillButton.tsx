import { type ButtonHTMLAttributes } from 'react';
import styled from '@emotion/styled';

const ButtonEl = styled.button`
  flex: 1;
  padding: 0.5rem;
  border-radius: 10px;
  border: 1.5px solid #2a2a3a;
  background: transparent;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  cursor: pointer;

  &[data-active='true'][data-color='purple'] {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.08);
    color: #a855f7;
  }
  &[data-active='true'][data-color='teal'] {
    border-color: #06d6a0;
    background: rgba(6, 214, 160, 0.07);
    color: #06d6a0;
  }
  &:hover {
    &[data-color='purple'] {
      border-color: #a855f7;
      color: #a855f7;
    }
    &[data-color='teal'] {
      border-color: #06d6a0;
      color: #06d6a0;
    }
  }
`;

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  color?: 'purple' | 'teal';
}

export function PillButton({ active, color = 'purple', ...rest }: PillButtonProps) {
  return <ButtonEl data-active={String(active)} data-color={color} {...rest} />;
}
