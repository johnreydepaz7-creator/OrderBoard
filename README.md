# OrderBoard — Phase 1 starter

For **Bakes and Bites**. A responsive React + Express + MongoDB web application starter supporting owner/staff sign-in and a navigable dashboard.

## Requirements
- Node.js 20.19+ or 22.12+
- MongoDB Community Server running locally **or** a MongoDB Atlas connection string
- VS Code (optional)

## Setup
1. In the project folder, open a terminal and run `npm install`.
2. Run `npm run install:all`.
3. Copy `server/.env.example` to `server/.env`, set `MONGODB_URI`, and replace `JWT_SECRET` with a private random value (at least 32 characters). Keep `CLIENT_ORIGIN=http://localhost:5173` for local development.
4. Copy `client/.env.example` to `client/.env`. Leave `VITE_API_URL=http://localhost:4000` for local development.
5. Create the first owner account:
   `cd server`
   `npm run create-owner -- "Bakery Owner" owner@example.com "YOUR_LONG_PRIVATE_PASSWORD"`
   `cd ..`
6. Run `npm run dev` from the top-level folder.
7. Open `http://localhost:5173` and sign in using your owner credentials.

**Important:** `localhost` works on the development computer only. To use an iPhone/iPad or Mac across the network, use a reachable backend URL, configure allowed origins, and serve the application through HTTPS. Deploy the backend and frontend behind HTTPS for real use; cookies use `Secure` when `NODE_ENV=production`. For separately hosted frontends/backends, cookie and cross-site configuration must be reviewed before deployment.

## Phase 1 implemented
- Responsive desktop/mobile login
- Account session stored in an HTTP-only cookie, signed expiring JWT
- Password hashes using bcrypt (12 rounds)
- API authorization on `/api/auth/me` and `/api/auth/owner-check`
- Login rate limiting, security headers, restricted CORS
- Dashboard shell with placeholder modules (no fake statistics)
- Owner account bootstrap script that refuses a second owner

## Not yet implemented
- Staff account management UI and staff creation endpoint
- Password resets, MFA, server-side session revocation/audit trail, CSRF defenses for a production deployment, comprehensive tests
- Orders, cake progress, scheduling, inventory, sales/expenses, reports, analytics
- Offline PWA/IndexedDB and sync

## Intended architecture
React (Vite) → REST API (Express) → MongoDB. Role checks occur on the backend and must be applied to every future protected feature. This is a **development starter**, not a production-ready deployment.

## Phase 1 update — staff accounts (v1.1)
Keep your existing `server/.env`, `client/.env`, and **existing MongoDB Atlas database** when upgrading. The new code preserves the `User` collection and the existing `owner` role; no database migration or new owner account is required. Never copy `.env` into public repositories.

To update: back up your original project, replace source files with this ZIP's files, restore your own `.env` files, run `npm.cmd install` then `npm.cmd run install:all`, and `npm.cmd run dev` from the top-level folder. Sign in using your existing owner credentials.

Open **Staff Accounts** in the left navigation. Create a staff user with a unique email and a password of at least 12 characters; then test sign-in in a private browser window. Staff cannot see Staff Accounts, Sales & Expenses, or Reports & Analytics navigation. Those last two remain **placeholders**, not secured implementations. The backend rejects all staff-account API requests from a staff account with HTTP 403. Deactivating a staff member blocks their subsequent protected API requests and sign-in.

**Staff test plan:** (1) Owner can create/list/deactivate/reactivate staff. (2) Staff can log in and log out. (3) Staff does not see owner-only navigation. (4) Staff GET `/api/staff` is rejected with 403; unauthenticated GET `/api/staff` with 401. (5) Deactivated staff gets 401 on `/api/auth/me` and cannot sign in. (6) Email duplicates and passwords shorter than 12 characters are rejected. (7) Check layouts at 375px, 768px, and desktop and test in Safari on a real Apple device.

**Security considerations before production:** JWT bearer cookie authentication alone needs a deliberate CSRF strategy for all state-changing endpoints, stronger session management, account recovery/password changes, MFA consideration, audit logs and automated integration tests. Do not expose this development server to the public internet. Mobile access needs the backend API to be reachable from the phone; `localhost` in `VITE_API_URL` on a phone points to the phone itself.


## Session policy (Phase 1 security update)

- **Owner**: may use separate, concurrent browser/device sessions. Logging out clears only the current browser's cookie.
- **Staff**: may have only one current login session. A successful new Staff login increments the account's `sessionVersion` in MongoDB; older session cookies fail authorization on their next API request (HTTP 401).
- Staff logout revokes the current session version; deactivation or reactivation also increments `sessionVersion` to revoke prior sessions. Existing Staff documents automatically use `sessionVersion: 0` until their next login.
- Session checks are server-side on each protected API request. Existing authenticated browsers do not instantly change their visible UI until an API request is made or the page is refreshed.
- To test: sign in as Staff in Browser A, then as the same Staff account in Browser B. Refresh A; A must return to login. Owner logins in two browsers should both remain valid.
- For production deployment, configure HTTPS, secure cookies, CSRF mitigation and access controls; develop automated integration tests.


## Phase 1.5: Account security

The **Account Security** menu lets Owner and Staff view recent login history, see
active devices, revoke other sessions, and change their own password.
Changing a password signs out all devices. Owner can still log in from multiple
browsers; Staff remain limited to one active session.

**Important migration:** Existing login cookies from the previous project must
log in again because older tokens don't contain a session identifier. Your
existing MongoDB users and password hashes are preserved. Do not delete your
users collection. New collections (`sessions`, `loginevents`) are created by
Mongoose. Successful and failed login history starts accumulating only after
installing this update. Older logins cannot be reconstructed.

**Local setup:** Set `CLIENT_ORIGIN` to exactly the browser origin (for example
`http://localhost:5173` without trailing slash) in `server/.env`. For LAN
access from an iPhone you must configure the reachable API URL and allowed
origin deliberately; the frontend localhost API default refers to the phone
itself, not your development PC.

Login history retains up to 90 days (MongoDB TTL cleanup is asynchronous).
Device and browser labels are approximate, and network addresses can be shared
or change. Full production hardening and automated browser tests remain pending.
