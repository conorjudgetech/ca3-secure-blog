# Blog Application (secure version)

This branch fixes the five deliberate flaws from the `insecure` branch. It also adds
four security controls that the insecure branch does not have (CSRF tokens, session
hardening, security headers, security logging), plus two extra login defences (account
lockout and protection against username enumeration). It starts from the `main` baseline.
Compare it against the `insecure` branch to see each vulnerability next to its fix.

| Branch     | Purpose                                                    |
|------------|------------------------------------------------------------|
| `main`     | The base application. A working blog with no flaws added.  |
| `insecure` | Starts from `main`. Adds the five deliberate flaws.        |
| `secure`   | Starts from `main`. Fixes the flaws and adds the controls. |

## What was fixed and added

Fixes for the five flaws:

- SQL injection: every query uses parameterised statements.
- Reflected and stored XSS: the EJS templates encode output.
- DOM based XSS: the client writes user input with `textContent`, not `innerHTML`.
- Sensitive data exposure: passwords are hashed with bcrypt, secrets are read from the
  environment, error pages are generic, and the `?debug=true` endpoint is removed.

Extra controls:

- CSRF tokens on every form that changes state.
- Session hardening: `HttpOnly` and `SameSite=Strict` cookies, idle and absolute timeouts,
  and a new session id on login.
- Security headers through helmet, including a Content-Security-Policy.
- Security logging: auth events and attack attempts are written to the `logs` table.
- Account lockout after repeated failed logins.
- Protection against username enumeration by timing.

## Features

- Register, log in, log out
- Create a post, list and view posts
- Comment on a post
- Search posts
- Admin role (the first registered user) with post deletion and an event-log viewer

## Requirements

- Node.js 18 or newer (developed on Node 23)
- npm (bundled with Node)

`better-sqlite3` ships as a prebuilt native binary for common platforms, so no database
server or separate SQLite install is required.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local configuration from the template
cp .env.example .env
#    then edit .env (see "Configuration" below)

# 3. Create the database file and tables
npm run init-db

# 4. Start the server
npm start
```

The server then listens on the configured port (3000 by default):

```
Server running at http://localhost:3000
```

Open <http://localhost:3000> in a browser. The first account you register becomes the
admin. Every account after that is a regular user.

## Configuration

All configuration is read from environment variables, loaded from a local `.env` file.
The `.env` file is gitignored and must never be committed. Copy `.env.example` to `.env`
and adjust:

| Variable         | Default        | Description                                              |
|------------------|----------------|----------------------------------------------------------|
| `PORT`           | `3000`         | Port the HTTP server listens on.                         |
| `SESSION_SECRET` | dev fallback   | Secret used to sign the session cookie. Set a long random value. |
| `DB_PATH`        | `data/blog.db` | Path to the SQLite database file, relative to the project root. |
| `BCRYPT_ROUNDS`  | `12`           | bcrypt cost factor used when hashing passwords.          |

Generate a strong session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## npm scripts

| Script            | Action                                                     |
|-------------------|------------------------------------------------------------|
| `npm start`       | Start the server.                                          |
| `npm run dev`     | Start with `node --watch` (restarts on file changes).      |
| `npm run init-db` | Create the database file and apply the schema (idempotent). |

## Verifying the controls

The `evidence/secure/` folder records each control being checked. Each file names the
control, shows the request or command used, and shows the result. `00-summary.txt` lists
the five exploits blocked and the normal features working.

To reproduce a check, start the app, then repeat the request shown in the file. The two
bypass demonstrations run on their own:

```bash
node tests/sqli-blacklist-bypass.js
node tests/xss-scriptstrip-bypass.js
```

The browser check `csp-check.js` needs Playwright, which is not a project dependency.
Install it first with `npm install playwright`, then run
`node evidence/secure/csp-check.js <url>`.

## Notes

- Session store: sessions use the express-session in-memory store. This is fine for a
  local demo. It is not shared across processes and it is cleared on restart. A real
  deployment would use a persistent store.
- Database files (`*.db` and the WAL/SHM sidecars) and `.env` are gitignored. Recreate the
  database locally with `npm run init-db`.
