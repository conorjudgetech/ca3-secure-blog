# Secure Blog

A minimal multi-user blog built with Node.js, Express, SQLite and EJS. It is the
coursework vehicle for CA3 (Secure Application Programming): a small, readable
application that a set of common web vulnerabilities and their fixes can be
demonstrated against.

This `main` branch is the clean, working baseline — no deliberate vulnerabilities
and no security demonstrations. Two further branches build on it:

| Branch     | Purpose                                                        |
|------------|----------------------------------------------------------------|
| `main`     | The base application. A functional, non-vulnerable blog.       |
| `insecure` | Branches off `main`; introduces the vulnerabilities to study.  |
| `secure`   | Branches off `main`; applies the fixes and hardening controls. |

## Features

- Register, log in, log out
- Create a post; list and view posts
- Comment on a post
- Search posts
- Admin role (the first registered user) with post deletion and an event-log viewer

## Requirements

- **Node.js 18 or newer** (developed on Node 23)
- npm (bundled with Node)

`better-sqlite3` ships as a prebuilt native binary for common platforms, so no
database server or separate SQLite install is required.

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

Open <http://localhost:3000> in a browser. **The first account you register
becomes the admin**; every account after that is a regular user.

## Configuration

All configuration is read from environment variables, loaded from a local `.env`
file (which is gitignored and must never be committed). Copy `.env.example` to
`.env` and adjust:

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

| Script            | Action                                                    |
|-------------------|-----------------------------------------------------------|
| `npm start`       | Start the server.                                         |
| `npm run dev`     | Start with `node --watch` (restarts on file changes).    |
| `npm run init-db` | Create the database file and apply the schema (idempotent). |

## Project structure

```
.
├── server.js              # App entry point: middleware and route mounting
├── scripts/
│   └── init-db.js         # Applies src/db/schema.sql to the database
├── src/
│   ├── config.js          # Environment-driven configuration
│   ├── logger.js          # Writes application events to the logs table
│   ├── db/
│   │   ├── database.js     # Single shared SQLite connection (Singleton)
│   │   └── schema.sql      # Table definitions
│   ├── middleware/
│   │   └── auth.js         # currentUser / requireAuth / requireAdmin
│   ├── models/            # Data access: user, post, comment, log
│   └── routes/            # auth, posts, admin
├── views/                 # EJS templates
└── public/                # Static CSS
```

All database access goes through the single connection in `src/db/database.js`,
and every query is parameterised in the model layer.

## Notes

- **Session store:** sessions use the express-session in-memory store, which is
  fine for a local, non-hosted demo but is not shared across processes and is
  cleared on restart. A persistent store would be used for a real deployment.
- **Database files** (`*.db`, WAL/SHM sidecars) and `.env` are gitignored; the
  database is recreated locally with `npm run init-db`.
