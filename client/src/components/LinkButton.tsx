import { type ButtonHTMLAttributes } from 'react';
import styled from '@emotion/styled';

const ButtonEl = styled.button`
  background: transparent;
  border: none;
  color: #7a7a8e;
  font-family: 'Outfit', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    color: #9a9aae;
  }

  &[data-variant='muted'] {
    color: #4a4a6a;
    &:hover {
      color: #7a7a8e;
    }
  }
`;

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'muted';
}

export function LinkButton({ variant = 'default', ...rest }: LinkButtonProps) {
  return <ButtonEl data-variant={variant} {...rest} />;
}
