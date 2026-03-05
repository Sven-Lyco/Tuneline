import { Global, css } from '@emotion/react';

export function GlobalStyles() {
  return (
    <Global
      styles={css`
        *,
        *::before,
        *::after {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        ::-webkit-scrollbar {
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: #12121a;
        }
        ::-webkit-scrollbar-thumb {
          background: #2a2a3a;
          border-radius: 3px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes wave {
          0% {
            height: 3px;
          }
          100% {
            height: 18px;
          }
        }
        @keyframes fall {
          0% {
            transform: translateY(-10vh) rotate(0);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(900deg);
            opacity: 0;
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }
        @keyframes pop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes slideIn {
          from {
            transform: translateY(15px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes glow {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes ldSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}
    />
  );
}
