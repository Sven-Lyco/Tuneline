# Express App Setup Patterns

Reference for structuring your main `app.js` / `app.ts` entry point.

## Middleware Ordering (Order Matters)

```javascript
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';

const app = express();

// 1. CORS — must come first so preflight OPTIONS requests are handled before anything else
app.use(cors({
  origin: env.ALLOWED_ORIGINS,           // array from env: ['http://localhost:5173']
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 2. Body parser — parses JSON before routes read req.body
app.use(express.json());

// 3. Optional: request logger (morgan, custom, etc.)
app.use(requestLogger);

// 4. Health check / root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'My API', version: '1.0.0' });
});

// 5. All API routes
app.use('/api', apiRouter);

// 6. 404 handler — must come AFTER routes, BEFORE error handler
// Throws so the error handler formats the response consistently
app.use((req, _res, _next) => {
  throw new NotFoundError(`Route ${req.method} ${req.path} not found`);
});

// 7. Error handler — must be LAST, must have exactly 4 parameters
app.use(errorHandler);

// 8. Listen on 0.0.0.0 for Docker compatibility (not just localhost)
const PORT = env.PORT ?? 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
```

## Static File Serving

Mount static file serving per route namespace, before other middleware:

```javascript
app.use('/api/uploads', express.static('uploads'));
```

## Route Index Pattern

Avoid importing every router in `app.js`. Instead, create `routes/index.js`:

```javascript
import { Router } from 'express';
import authRouter from './auth.routes.js';
import usersRouter from './users.routes.js';
import recipesRouter from './recipes.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/recipes', recipesRouter);

export default apiRouter;
```

Then in `app.js`: `app.use('/api', apiRouter);`

## Why 0.0.0.0?

`app.listen(PORT)` defaults to `127.0.0.1` (loopback only). Inside a Docker container, this means the container cannot receive external traffic. Always bind to `0.0.0.0` in production/Docker environments.
