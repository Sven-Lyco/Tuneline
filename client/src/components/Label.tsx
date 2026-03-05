import { type ReactNode } from 'react';
import styled from '@emotion/styled';

interface LabelProps {
  children: ReactNode;
}

const StyledLabel = styled.div`
  font-family: 'Space Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #7a7a8e;
  margin-bottom: 0.7rem;
`;

export function Label({ children }: LabelProps) {
  return <StyledLabel>{children}</StyledLabel>;
}
