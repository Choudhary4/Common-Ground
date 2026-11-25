# Common Ground — User & Operations Guide

> Built by Saurabh Kumar for the goSTOPS Build Sprint. Not an official goSTOPS product.

## Live Links

- **Live App:** https://frontend-tau-inky-69.vercel.app
- **Demo Video (Part 1 — Guest Flow):** https://www.loom.com/share/462ce3baba124b5d8f50e89ab7683f12
- **Demo Video (Part 2 — Hostel Command Center):** https://www.loom.com/share/e85614a897944a6e9bb458287d00f381
- **GitHub Repository:** https://github.com/Choudhary4/Common-Ground

---

## Staff, Manager & Central Admin Login

All operations roles sign in at **`/staff/login`** (`https://frontend-tau-inky-69.vercel.app/staff/login`).

### Seeded Credentials (from `backend/src/scripts/seed.ts`)

| Role | Email | Password | Portal Route |
| :--- | :--- | :--- | :--- |
| **Central Admin** | `admin@commonground.local` | `Admin@1234` | `/admin` |
| **Jaipur Manager** | `manager.jaipur@commonground.local` | `Manager@1234` | `/manager` |
| **Delhi Manager** | `manager.delhi@commonground.local` | `Manager@1234` | `/manager` |
| **Jaipur Staff** | `staff.jaipur@commonground.local` | `Staff@1234` | `/staff` |
| **Delhi Staff** | `staff.delhi@commonground.local` | `Staff@1234` | `/staff` |

---

## How to Use Common Ground (By Role)

### 1. Central Admin (`/admin`)

1. Open **`/staff/login`** and sign in with `admin@commonground.local` / `Admin@1234`.
2. **Create & Manage Hostels:** Add new hostel properties (name, city, address) or activate/deactivate existing properties.
3. **Provision Staff & Managers:** Create `HOSTEL_MANAGER` and `HOSTEL_STAFF` accounts and assign them to specific hostels.
4. **Platform Analytics & Moderation:** Monitor cross-property metrics (active travellers, activities, QR scans, and moderation reports) and review flagged content.

---

### 2. Hostel Manager (`/manager`)

1. Sign in at **`/staff/login`** with a manager account.
2. **QR & Access Code Management:** View, download/print, or rotate the property's **Common Room Check-In QR code** and **Backup Access Code** for reception or table tents.
3. **Official Hostel Activities (Solving the Cold-Start Problem):** Create official events (e.g., *Rooftop UNO*, *Chai & Conversations*) so guests never land on an empty feed.
4. **Broadcasts & Moderation:** Send property-wide announcements, cancel/complete activities if needed, and review guest reports.

---

### 3. Hostel Staff (`/staff`)

1. Sign in at **`/staff/login`** with a staff account.
2. **Front-Desk Check-In Support:** Display or print the property's active QR code and current backup access code so arriving guests can join immediately.
3. **Live Property Overview:** Monitor active in-house guests and ongoing plans at the property.

---

### 4. Travellers / Guests (`/`, `/join/:token`, `/app`)

No app download, email, or phone number is required.

1. **Instant Check-In:**
   - Scan the hostel's common-room QR code (opens `/join/:token`), **or**
   - Visit the landing page (`/`) and enter the hostel's **Access Code** along with a **Display Name**.
2. **Browse & Join Plans (`/app`):**
   - View **Official Hostel Activities** and **Guest-Hosted Plans** happening at that property.
   - Tap any plan (`/app/activities/:id`) to view details and join instantly (public plans) or send a join request (approval-required plans).
3. **Create a Plan (`/app/activities/new`):**
   - Post a spontaneous plan with title, category, location, time, seat limit, and join mode (instant or approval-required).
4. **Discover Travellers (`/app/discover`):**
   - Set your current social availability status and browse other checked-in guests at the same hostel.
5. **Privacy-First Chat (`/app/chat`):**
   - Message other guests 1:1 or coordinate inside activity group chats using only your chosen display name—personal details stay hidden.
6. **Notifications & Safety (`/app/notifications`, `/app/settings`):**
   - Manage notifications, update your display preferences, or **block / report** any user for inappropriate behaviour.
