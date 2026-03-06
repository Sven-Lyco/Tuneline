import { type ReactNode } from 'react';
import styled from '@emotion/styled';

interface LabelProps {
  children: ReactNode;
}

const StyledLabel = styled.div`
  font-family: 'Outfit', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  font-weight: 600;
  color: #9a9aae;
  margin-bottom: 0.7rem;
`;

export function Label({ children }: LabelProps) {
  return <StyledLabel>{children}</StyledLabel>;
}
