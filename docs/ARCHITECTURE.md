# Common Ground — System Architecture & Design

## 1. Proposed Architecture

Common Ground uses a **monorepo** with two decoupled TypeScript applications:

- **Frontend (`frontend/`)**: React + Vite + TypeScript + Tailwind CSS + React Router + Lucide React + Socket.IO Client. Mobile-first UI for travellers, responsive desktop/tablet dashboards for hostel staff, hostel managers, and central admins.
- **Backend (`backend/`)**: Node.js + Express.js + TypeScript + Mongoose + Socket.IO + Zod + QRCode. REST API under `/api/*` with real-time Socket.IO events scoped to `hostel:<hostelId>` and `user:<userId>` rooms.
- **Database**: MongoDB (Mongoose ODM) with strict `hostelId` tenant isolation, compound indexes, TTL indexes for cleanup, and atomic conditional updates for seat-capacity concurrency.

### Security & Tenant Isolation
- **HTTP-only Cookies**: `cg_session` stores a high-entropy random token; the database stores only its SHA-256 `tokenHash`.
- **Session Validation**: Every protected request verifies `!revokedAt`, `expiresAt > now`, and `user.status === 'ACTIVE'`.
- **Role-Based Access Control (RBAC)**: `CENTRAL_ADMIN`, `HOSTEL_MANAGER`, `HOSTEL_STAFF`, `TRAVELLER` enforced by Express middleware.
- **Hostel Isolation**: Non-`CENTRAL_ADMIN` requests always derive `hostelId` from `req.auth.hostelId` (never from request body/query/params).

## 2. Database Relationships

- `Hostel` (1) ──< (N) `User` (staff, managers, travellers; `CENTRAL_ADMIN` has `hostelId: null`)
- `Hostel` (1) ──< (N) `HostelQR` (at most 1 `ACTIVE` per hostel)
- `Hostel` (1) ──< (N) `AccessCode` (hashed; revocable; never returned in public APIs)
- `User` (1) ──< (N) `Session` (72-hour lifetime, revocable)
- `User` (1) ──< (N) `SocialStatus` (2-hour default expiration, `hostelId` scoped)
- `Hostel` (1) ──< (N) `Activity` (`creatorId` -> `User`, `creatorType`: `TRAVELLER` | `HOSTEL_MANAGER`)
- `Activity` (1) ──< (N) `ActivityParticipant` (unique `(activityId, userId)` for confirmed/active participation)
- `Activity` (1) ──< (N) `JoinRequest` (for `APPROVAL` joinMode)
- `Hostel` (1) ──< (N) `Report` (`reporterId`, optional `reportedUserId`, optional `activityId`)
- `User` (1) ──< (N) `Notification` (`hostelId` scoped)
- `AuditLog` & `AnalyticsEvent` track administrative actions and genuine product adoption metrics (excluding `isDemo: true` records from real adoption counts).

## 3. Main User Journeys

1. **QR Scan -> Traveller Onboarding -> Dashboard**: Scan `/join/:token` -> backend validates `HostelQR` -> displays hostel name -> traveller enters nickname + hostel access code -> backend creates `TRAVELLER` user + 72h `Session` cookie -> redirects to `/app`.
2. **Social Status & Discovery**: Traveller selects vibe (e.g. *Open to meeting*, 2h expiry) -> appears in opted-in list for that hostel only -> can invite opted-in travellers to activities (rate-limited).
3. **Activity Creation & Hybrid Joining**: Traveller or Manager creates activity (`PUBLIC` or `APPROVAL`). `PUBLIC` uses atomic `$inc` with `$lt: maxParticipants` to prevent overbooking. `APPROVAL` creates `PENDING` `JoinRequest` for creator approval.
4. **Staff QR & Access Code Management**: Staff logs in -> generates/downloads/prints/regenerates/revokes QR -> views/regenerates/revokes hostel access code.
5. **Manager Moderation & Official Activities**: Manager creates "Official Hostel Activity" -> views participation -> reviews/dismisses reports or cancels/restricts offending activities/users.
6. **Central Admin**: Manages hostels, managers, staff, and views aggregated platform analytics.

## 4. Unresolved Assumptions & Defaults

- **Access Code Rotation**: Access codes are generated as 6-character uppercase alphanumeric strings (excluding ambiguous `0/O/1/I`). Because staff need to view the current active access code to share it verbally/on a whiteboard with arriving guests (Section 11: "View current hostel access code"), we store `codeHash` for verification and an encrypted/masked or staff-only displayable `codeEncrypted` (AES-256-GCM using `COOKIE_SECRET`-derived key) so raw codes are never stored in plaintext and never exposed in public APIs.
- **Inviting Opted-in Travellers**: Travellers can invite an opted-in traveller to one of their open activities via a `Notification` (capped at 5 invitations per hour per user and max 1 pending/recent invite per target+activity).
- **Host Leaving an Activity**: If the creator leaves, ownership transfers to the earliest confirmed participant; if no confirmed participants remain, the activity is marked `CANCELLED`.
- **Database**: MongoDB Atlas is used for development and production, while automated tests use `mongodb-memory-server` so tests run cleanly without external dependencies.
