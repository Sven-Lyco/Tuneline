export default {
  'client/src/**/*.{ts,tsx}': [
    'prettier --check',
    'eslint --config ./client/eslint.config.js --max-warnings 0',
  ],
};
