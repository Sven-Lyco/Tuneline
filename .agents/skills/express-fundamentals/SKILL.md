---
name: express-fundamentals
description: Express.js setup, server initialization, middleware configuration, request/response handling, routing basics, TypeScript integration, middleware pipeline. Use when setting up new Express servers, configuring middleware, creating routes, or understanding Express architecture and request/response lifecycle.
---

# Express.js Fundamentals

Master Express.js basics, server setup, middleware configuration, and core request/response handling patterns.

## When to Use This Skill

- Setting up new Express servers with TypeScript
- Configuring middleware pipeline (helmet, cors, compression, body parsing)
- Understanding Express request/response lifecycle
- Creating basic routes and route handlers
- Configuring error handling middleware
- Setting up development vs production configurations
- Integrating logging and monitoring middleware

## Quick Start: Basic Express Setup

```typescript
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet()); // Security headers
app.use(cors({ 
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true 
}));
app.use(compression()); // Gzip compression

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handler (must be last)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Middleware Pipeline

Express processes requests through a middleware chain:

```
Request → Middleware 1 → Middleware 2 → Route Handler → Response
```

**Key Principles:**
- Middleware executes in order added with `app.use()`
- Call `next()` to pass control to next middleware
- Last middleware to send response wins
- Error handlers catch thrown errors

```typescript
// Global middleware
app.use(requestLogger);
app.use(authenticate);

// Route-specific middleware
app.post('/admin/users', authorize(['admin']), createUser);

// Error middleware (must be last, 4 params required)
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
```

## Core Middleware Configuration

**Security (helmet):**
```typescript
app.use(helmet()); // Sets security headers
// - Content Security Policy
// - X-Frame-Options
// - X-Content-Type-Options
// - Strict-Transport-Security
```

**CORS Configuration:**
```typescript
app.use(cors({
  origin: ['http://localhost:3000', 'https://example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Compression:**
```typescript
app.use(compression()); // Compress responses over 1KB
```

**Body Parsing:**
```typescript
app.use(express.json());      // Parse application/json
app.use(express.urlencoded()); // Parse form data
app.use(express.static('public')); // Serve static files
```

## Request/Response Lifecycle

```typescript
// Request object
req.method      // HTTP method (GET, POST, etc)
req.path        // URL path
req.query       // Query parameters (?key=value)
req.params      // Route parameters (:id)
req.body        // Request body (for POST/PUT)
req.headers     // HTTP headers
req.cookies     // Parsed cookies
req.user        // Attached by auth middleware

// Response object
res.status(200)         // Set status code
res.json({ data })      // Send JSON response
res.send('text')        // Send text response
res.redirect('/path')   // Redirect request
res.render('template')  // Render template
res.sendFile('./file')  // Send file
res.setHeader('key', 'value') // Set header
res.cookie('name', 'value')   // Set cookie
```

## Route Definition Patterns

```typescript
// Simple routes
app.get('/', (req, res) => res.json({ message: 'Hello' }));

// Routes with parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ userId });
});

// Query parameters
app.get('/search', (req, res) => {
  const { q, limit = 10 } = req.query;
  res.json({ query: q, limit });
});

// Multiple methods
app.route('/users')
  .get((req, res) => res.json([]))
  .post((req, res) => res.status(201).json({}));

// Router for grouping
const router = express.Router();
router.get('/:id', getUser);
router.post('/', createUser);
app.use('/users', router);
```

## TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "watch": "ts-node-dev --respawn src/index.ts"
  }
}
```

## Environment Configuration

```typescript
// config/env.ts
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  DB_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Validate required env vars
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

## Health Check Pattern

```typescript
// Add health check for load balancers
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness check (dependencies available)
app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1'); // Test DB connection
    res.json({ ready: true });
  } catch (err) {
    res.status(503).json({ ready: false, error: err.message });
  }
});
```

## Graceful Shutdown

```typescript
const server = app.listen(PORT);

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    // Close database connections
    await db.end();
    // Close other resources
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});
```

## Best Practices

1. **Always use TypeScript** - Type safety prevents runtime errors
2. **Validate all input** - Use validation middleware for all routes
3. **Use middleware for cross-cutting concerns** - Logging, auth, error handling
4. **Separate concerns** - Routes → Controllers → Services → Repositories
5. **Never hardcode secrets** - Use environment variables
6. **Handle errors gracefully** - Central error handler middleware
7. **Add request IDs** - For tracing requests through logs
8. **Use compression** - Reduce response size
9. **Add CORS carefully** - Don't use `*` in production
10. **Implement rate limiting** - Protect against abuse

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| CORS errors | Configure CORS middleware with correct origins |
| Middleware not executing | Middleware must be added before routes |
| 404 on all routes | Check route definitions and middleware order |
| Body not parsed | Add `express.json()` before routes |
| Async errors not caught | Wrap async handlers with `asyncHandler` |
| Memory leaks | Close DB connections, event listeners, timers |

## See Also

- middleware-patterns - Auth, validation, error handling, rate limiting
- api-design-patterns - REST API design, response formatting
- database-integration - Database connections and pooling
- authentication-patterns - JWT, OAuth, session management
