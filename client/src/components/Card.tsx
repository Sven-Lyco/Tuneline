import styled from '@emotion/styled';

export const Card = styled.div`
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;

  &[data-roomy='true'] {
    padding: 2.5rem 2rem;
  }

  /* On phones the content needs the width more than the card needs the air */
  @media (max-width: 400px) {
    &,
    &[data-roomy='true'] {
      padding: 1.5rem 1.25rem;
    }
  }
`;
