# OrbitTrack – Task Execution & Accountability Platform

OrbitTrack is a modern, production-ready, full-stack execution management platform designed to help users plan, track, execute, and complete their daily work. It fosters user accountability through countdown timers, browser push alerts (even when minimized), background pending reminders, task aging tracking, Kanban workflows, weekly/monthly productivity score meters, and end-of-day work carry-forward routines.

---

## Technical Stack & Architecture

- **Frontend**: React, TypeScript, Next.js (App Router, Zustand, Recharts, Framer Motion, Tailwind CSS).
- **Backend**: Node.js, Express.js (TypeScript, Web Push API, custom interval/BullMQ hybrid job scheduler).
- **Database & ORM**: PostgreSQL in production, SQLite in development, integrated with Prisma ORM.
- **Background Jobs**: BullMQ and Redis (with a robust local in-memory fallback if Redis is offline).
- **Service Worker**: Dedicated notification routing and off-tab button click handlers (`sw.js`).

---

## Folder Structure

```text
orbit-track/
├── client/                 # Next.js App
│   ├── public/             # Static assets
│   │   └── sw.js           # Push Notification Service Worker
│   ├── src/
│   │   ├── components/     # Reusable UI (Sidebar, TimerFloat, NotificationCenter)
│   │   ├── store/          # Zustand State Management (auth, tasks, notifications)
│   │   └── app/            # Next.js Pages (Dashboard, Planner, Archive, Reports)
├── server/                 # Express API
│   ├── prisma/
│   │   └── schema.prisma   # Prisma schema (SQLite dev, Postgres ready)
│   ├── src/
│   │   ├── controllers/    # API Request handlers
│   │   ├── middleware/     # Auth checks
│   │   ├── services/       # Web Push, Queue Engine, Analytics
│   │   └── index.ts        # Server entry point
├── docker-compose.yml       # Orchestrates full PostgreSQL + Redis stack
├── Dockerfile.client        # Client container definition
├── Dockerfile.server        # Server container definition
└── README.md               # Setup documentation
```

---

## Quick Start (Local Development)

The application is configured to run out-of-the-box using **SQLite** as the database and a **local fallback scheduler** for queues so you do not need PostgreSQL, Redis, or Docker installed to test it.

### 1. Prerequisites
- Node.js (v20+ recommended)
- npm (v10+ recommended)

### 2. Setup Server
1. Navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Set up the environment variables:
   A default `.env` is already configured to run SQLite. If you need to make changes:
   ```env
   PORT=5000
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="orbit-track-super-secret-key-987654321"
   CLIENT_URL="http://localhost:3000"
   ```
3. Run database migrations to create tables:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Seed the database with mock tasks, logs, and alert feeds:
   ```bash
   npm run db:seed
   ```
5. Start the backend in development mode:
   ```bash
   npm run dev
   ```
   *Note: On boot, the server will auto-generate VAPID keys if none are provided and attempt to save them to your `server/.env`.*

### 3. Setup Client
1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser.

---

## Testing & Authentication Modes

To simplify local review, OrbitTrack supports two ways to explore the system:

### A. Guest Sandbox Mode (Recommended for Instant Review)
1. On the Login screen, click **Explore in Guest Mode**.
2. This activates a complete client-side simulation. Tasks, focus sessions, timer countdowns, notifications, and productivity scores are calculated dynamically using memory arrays.
3. No backend connection is required.

### B. Standard Seed Account Login
1. Log in with the pre-seeded account:
   - **Email**: `demo@orbit-track.com`
   - **Password**: `password123`
2. This connects directly to your local Express server, saving tasks and logs into `server/prisma/dev.db`.

---

## Timer & Push Notification Engine

### 1. Web Push Registration
- When you log in, if your browser has not authorized notifications, a glowing blue card will appear: **"Enable Browser Alerts"**.
- Clicking **Authorize Alerts** prompts browser permission and registers the Service Worker endpoint `/sw.js` with the backend.

### 2. Off-tab Background Support
- Start a task countdown. Minimize the browser tab.
- When the estimated duration expires, the operating system will show a notification banner:
  *"Time allocated for [Task Name] has ended."*
- Click interactive buttons directly on the banner:
  - **Mark Complete**: Automatically marks task complete and spawns the next occurrence if recurring.
  - **Extend 15 Min / 30 Min**: Extends focus countdown instantly.
  - **Mark Pending**: Sets status to Pending and registers active focus logs.

---

## Production Deployment (Docker Setup)

For production, OrbitTrack is fully configured to run with **PostgreSQL** (Prisma ORM), **Redis**, and **BullMQ**.

### 1. Configure production Prisma
1. In `server/prisma/schema.prisma`, change the database provider to `postgresql`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

### 2. Boot with Docker Compose
1. Ensure Docker and Docker Compose are running.
2. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
This starts:
- PostgreSQL on port `5432`.
- Redis on port `6379`.
- Express Backend on port `5000`.
- Next.js Client on port `3000`.
- Prisma migrations are executed automatically during the server container build.
