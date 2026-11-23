# Common Ground — A Social Connection Platform for goSTOPS

Common Ground is a mobile-first web application designed to help solo travellers staying at goSTOPS hostels connect with other travellers through voluntary social availability and shared activities.

> Built by Saurabh Kumar for the goSTOPS Build Sprint. Not an official goSTOPS product.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Lucide React, Socket.IO Client
- **Backend**: Node.js, Express.js, TypeScript, MongoDB, Mongoose, Socket.IO, Zod, QRCode, Helmet, Express Rate Limit
- **Database**: MongoDB Atlas (and `mongodb-memory-server` for automated tests)

## Project Structure

```
Common-Ground/
├── backend/          # Express + Mongoose + Socket.IO API
├── frontend/         # React + Vite + Tailwind mobile-first app
├── docs/             # Architecture & design documentation
└── package.json
```

## Environment Variables

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
- `PORT=4000`
- `NODE_ENV=development`
- `MONGODB_URI=mongodb://localhost:27017/common-ground`
- `FRONTEND_URL=http://localhost:5173`
- `COOKIE_SECRET=<long-random-secret-at-least-16-chars>`
- `SESSION_TTL_HOURS=72`
- `SOCIAL_STATUS_TTL_MINUTES=120`
- `QR_BASE_URL=http://localhost:5173/join`

### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
- `VITE_API_URL=http://localhost:4000` (optional in local dev since Vite proxies `/api` and `/socket.io`)

## Local Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

2. **Configure MongoDB Atlas**:
   - Create `backend/.env` from `backend/.env.example`.
   - Set `MONGODB_URI` to your MongoDB Atlas SRV connection string (ensure your IP or `0.0.0.0/0` is allowed in Atlas Network Access).

3. **Seed Demo Data (Development Only)**:
   ```bash
   npm run seed
   ```
   The seed script outputs demo QR URLs, hostel access codes (`JPR101`, `DEL202`), and local dev credentials.

4. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:4000/api/health`

## Running Tests

```bash
npm test
```
Automated integration tests use `mongodb-memory-server` and `supertest` to verify authentication, 72-hour sessions, RBAC, hostel isolation, QR generation/revocation, social discovery, concurrent seat-capacity locking, approval workflows, and report moderation.

## API Documentation (Summary)

- `GET /api/health` — Service health check
- `GET /api/qr/resolve/:token` — Validate hostel QR token and return hostel info
- `POST /api/auth/traveller/onboard` — Onboard traveller with `qrToken`, `nickname`, `accessCode`
- `POST /api/auth/staff/login` — Staff / Manager / Central Admin login
- `GET /api/auth/me` — Current authenticated user
- `POST /api/auth/logout` — Revoke session & clear cookie
- `GET|PUT|DELETE /api/traveller/status` — Manage 2-hour voluntary social status
- `GET /api/traveller/discover` — Discover opted-in travellers in the same hostel
- `POST /api/traveller/invite` — Invite an opted-in traveller to an open activity
- `GET|POST /api/activities` — List or create hostel activities
- `GET|PATCH /api/activities/:id` — View or edit activity
- `POST /api/activities/:id/join` — Instant join (`PUBLIC`) or request (`APPROVAL`)
- `POST /api/activities/:id/requests/:requestId/resolve` — Accept or decline join request
- `POST /api/activities/:id/leave|cancel|complete` — Lifecycle actions
- `GET|POST /api/staff/qr*` & `/api/staff/access-code*` — Hostel QR & access code management
- `GET|PATCH /api/manager/*` — Manager overview, activities, and report moderation
- `GET|POST|PATCH /api/admin/*` — Central Admin hostel & team management

## Deployment

### Database (MongoDB Atlas)
1. Create a free M0 cluster on MongoDB Atlas and copy the SRV connection string.
2. Add your backend host IP (or `0.0.0.0/0` for Render/Railway) to Network Access.

### Backend (Render or Railway)
1. Deploy `backend/` with build command `npm install && npm run build` and start command `npm start`.
2. Set `NODE_ENV=production`, `MONGODB_URI`, `FRONTEND_URL=https://your-app.vercel.app`, `QR_BASE_URL=https://your-app.vercel.app/join`, and a strong `COOKIE_SECRET`.

### Frontend (Vercel)
1. Deploy `frontend/` with framework preset **Vite**, build command `npm run build`, output directory `dist`.
2. Set `VITE_API_URL=https://your-backend-url.onrender.com`.

## Demo Credentials (Local Development Only)

- **Central Admin**: `admin@commonground.local` / `Admin@1234`
- **Jaipur Manager**: `manager.jaipur@commonground.local` / `Manager@1234`
- **Jaipur Staff**: `staff.jaipur@commonground.local` / `Staff@1234` (Access Code: `JPR101`)
- **Delhi Manager**: `manager.delhi@commonground.local` / `Manager@1234`
- **Delhi Staff**: `staff.delhi@commonground.local` / `Staff@1234` (Access Code: `DEL202`)
