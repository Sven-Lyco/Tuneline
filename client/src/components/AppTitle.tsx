import { type CSSProperties } from 'react';
import styled from '@emotion/styled';

const TitleEl = styled.div`
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  background: linear-gradient(135deg, #ff2d78, #a855f7, #06d6a0);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;

  &[data-size='lg'] {
    font-size: clamp(2.5rem, 8vw, 5rem);
    letter-spacing: -3px;
  }
  &[data-size='md'] {
    font-size: clamp(2rem, 8vw, 4rem);
    letter-spacing: -3px;
  }
  &[data-size='sm'] {
    font-size: clamp(1.8rem, 6vw, 3.5rem);
    letter-spacing: -2px;
  }
  &[data-animate='true'] {
    animation: float 4s ease-in-out infinite;
  }
`;

export const AppSubtitle = styled.div`
  font-size: 0.8rem;
  color: #7a7a8e;
  letter-spacing: 4px;
  text-transform: uppercase;
  font-weight: 300;
  margin-bottom: 2.5rem;
`;

interface AppTitleProps {
  size?: 'lg' | 'md' | 'sm';
  animate?: boolean;
  style?: CSSProperties;
}

export function AppTitle({ size = 'lg', animate = true, style }: AppTitleProps) {
  return (
    <TitleEl data-size={size} data-animate={String(animate)} style={style}>
      TUNELINE
    </TitleEl>
  );
}
