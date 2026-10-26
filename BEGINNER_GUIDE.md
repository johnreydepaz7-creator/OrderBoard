# OrderBoard Phase 1 — Beginner Guide

This guide explains the files in a practical order. **You do not need to edit all of them.**

## 1. How OrderBoard works

1. Your browser displays `client/src/main.jsx` (React).
2. When you click **Sign in**, the browser calls `POST /api/auth/login`.
3. `server/src/index.js` forwards that request to `server/src/routes/auth.js`.
4. The server checks the account in MongoDB using `server/src/models/User.js`.
5. If credentials are correct, the server sends a signed, HTTP-only cookie.
6. Future protected requests go through `server/src/middleware/auth.js`.

**Words to know:** `frontend` = the website people see; `backend` = Node/Express server; `route` = endpoint that handles one request; `middleware` = a check that runs before a route; `schema` = data structure or input validation.

## 2. Start with these files

| File | What it does |
|---|---|
| `client/src/main.jsx` | Login screen, navigation, dashboard, staff screen |
| `client/src/styles.css` | Colors, spacing, fonts, phone/tablet layout |
| `server/src/index.js` | Starts Express, connects to MongoDB, installs routes |
| `server/src/models/User.js` | Defines user fields saved in MongoDB |
| `server/src/routes/auth.js` | Login, logout, and current-user endpoints |
| `server/src/routes/staff.js` | Owner-only staff account actions |
| `server/src/middleware/auth.js` | Rejects invalid sessions and non-Owners |
| `server/src/scripts/createOwner.js` | Creates the first Owner account only |

## 3. Understanding common code lines

- `const name = ...`: creates a variable that you don't plan to reassign.
- `async function`: this function may wait for the database or network.
- `await`: wait for the result before continuing.
- `if (...) return response.status(401)...`: stop and tell the browser authentication is required.
- `router.get(...)`: read data. `router.post(...)`: create/send data. `router.patch(...)`: change existing data.
- `useState(...)`: React remembers a value, such as the current user or email.
- `useEffect(...)`: React runs a task after rendering (for example loading account data).
- `onClick={() => ...}`: what happens when the user clicks.
- `.map(...)`: transform every item in a list (for example show each Staff account).

## 4. How the session policy works

**Owner:** Logging in creates a signed token for that browser. Other Owner logins remain valid until their own cookie expires or is cleared.

**Staff:** Every successful login increments `sessionVersion` in MongoDB. Only the token with the current version is accepted. Signing in elsewhere or changing account status invalidates earlier tokens. The server checks this on every protected request.

## 5. Safe habits

- Never paste real passwords or MongoDB connection strings into source files.
- Keep `server/.env` and `client/.env` out of shared ZIPs and version control.
- Do not remove server-side authorization just because buttons are hidden for Staff.
- Don't change the stored password hash by hand: passwords must be hashed by the app.
- Before changing a function, read the comment above it and test the related feature afterward.

## 6. Run locally on Windows

1. Restore your existing `.env` files.
2. Open the project root in VS Code.
3. Run `npm.cmd install` and `npm.cmd run install:all` if dependencies are not installed.
4. Run `npm.cmd run dev`.
5. Visit `http://localhost:5173`.
6. Test Owner login, Staff login, Owner-only Staff Accounts, Staff second-browser login, and Staff deactivation.

**Note:** The React screen has several long JSX layout expressions; the beginner comments show their responsibility. These can be split into smaller visual components in a future refactor without altering behavior.


## New account security files

- `server/src/models/Session.js`: one database record for each successful login.
- `server/src/models/LoginEvent.js`: history of successful/failed login attempts.
- `server/src/security/sessionHelpers.js`: helper functions for device labels and cookies.
- `server/src/routes/security.js`: URLs for viewing history and signing out sessions.
- `server/src/routes/auth.js`: logging in, logging out and changing passwords.
- `server/src/middleware/auth.js`: checks that an individual session has not been revoked.
- `client/src/main.jsx`: the `SecurityCenter` React component displays these controls.

A signed JWT by itself is not sufficient: every protected request looks up its
session record in MongoDB. Revoking that record blocks future requests.
