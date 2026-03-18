import { type ButtonHTMLAttributes } from 'react';
import styled from '@emotion/styled';

const ButtonEl = styled.button`
  width: 100%;
  padding: 0.85rem;
  border-radius: 14px;
  border: none;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  transition: opacity 0.2s;

  &[data-ready='false'] {
    background: #1e1e2e;
    color: #444;
    cursor: not-allowed;
  }

  &[data-ready='true'][data-variant='pink'] {
    background: linear-gradient(135deg, #ff2d78, #a855f7);
    color: #fff;
    cursor: pointer;
  }

  &[data-ready='true'][data-variant='purple-teal'] {
    background: linear-gradient(135deg, #a855f7, #06d6a0);
    color: #fff;
    cursor: pointer;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ready?: boolean;
  variant?: 'pink' | 'purple-teal';
}

export function PrimaryButton({
  ready = true,
  variant = 'pink',
  ...rest
}: PrimaryButtonProps) {
  return (
    <ButtonEl
      data-ready={String(ready)}
      data-variant={variant}
      disabled={!ready}
      {...rest}
    />
  );
}
