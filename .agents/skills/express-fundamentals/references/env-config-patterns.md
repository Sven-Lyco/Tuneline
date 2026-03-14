# Environment Config Patterns

Reference for the `config/env.js` module pattern — centralizes all env var access with validation and defaults.

## The Pattern

```javascript
// src/config/env.js
import dotenv from 'dotenv';
dotenv.config();

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '5000'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '1h',
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || '7d',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // CORS — comma-separated list becomes array
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),

  // Mail
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: parseInt(process.env.MAIL_PORT || '1025'),
  MAIL_FROM: process.env.MAIL_FROM,

  // Feature flags
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
};

// Validate required variables on module load — fail fast before server starts
const required = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export default env;
```

## Usage

```javascript
// Anywhere in the app
import env from './config/env.js';

app.listen(env.PORT, '0.0.0.0');
cors({ origin: env.ALLOWED_ORIGINS });
jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRE });
```

## Key Rules

- **One import** in each file: `import env from './config/env.js'` — never `process.env.X` scattered around the codebase
- **Parse early**: `parseInt(process.env.PORT || '5000')` so consumers get a number, not a string
- **Arrays from strings**: `process.env.ALLOWED_ORIGINS.split(',')` — store comma-separated in .env, parse once here
- **Fail fast**: the required validation loop throws on startup, not mid-request
- **Group by feature**: Server / JWT / Database / CORS / Mail sections make the file scannable

## .env File Example

```bash
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-here
JWT_EXPIRE=1h
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=noreply@myapp.local
```
