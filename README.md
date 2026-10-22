# Backend API

Express API using PostgreSQL through Prisma, Redis/BullMQ for notifications, and JWT bearer tokens.

## Requirements

- Node.js `^20.19`, `^22.12`, or `>=24`
- PostgreSQL
- Redis

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set the values:
   - `DATABASE_URL`: PostgreSQL connection string for the application.
   - `DIRECT_URL`: direct PostgreSQL connection string used by Prisma migrations.
   - `REDIS_URL`: Redis connection URL (defaults to local Redis).
   - `JWT_Secret`: a long, random secret; do not commit it.
   - SMTP and Vonage variables are needed for the corresponding notifications.

3. Generate the Prisma client and apply migrations to an empty database:

   ```sh
   npm run db:generate
   npm run db:migrate:deploy
   ```

4. Start the API and notification worker:

   ```sh
   npm run dev
   ```

The initial migration creates the `users` table and unique email index. For an existing database that already has these tables, baseline its schema with Prisma Migrate before applying migrations; do not apply the initial migration to an already-populated schema.

## API overview

- `POST /api/users` registers a user (maximum 10 per request; 5 requests per IP per 15 minutes).
- `POST /api/users/login` returns a JWT for valid credentials.
- `GET /api/users` returns the authenticated user's profile.
- User-specific routes require a Bearer token belonging to the requested user.

The registration rate limit uses in-memory storage, so it is per server process. Configure a shared rate-limit store before running multiple API instances.
