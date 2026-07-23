# Blog Application (insecure version)

> WARNING
>
> This branch contains deliberate security flaws. It exists only to demonstrate them for
> coursework. Do not deploy it. Do not expose it to a network. Run it on your own machine only.

This branch starts from the `main` baseline and adds five deliberate flaws. Each flaw is tagged
in the code with a `[VULN-*]` comment. The `secure` branch fixes all of them.

| Branch     | Purpose                                                    |
|------------|------------------------------------------------------------|
| `main`     | The base application. A working blog with no flaws added.  |
| `insecure` | Starts from `main`. Adds the five deliberate flaws.        |
| `secure`   | Starts from `main`. Fixes the flaws and adds controls.     |

## The five flaws

| Flaw | OWASP and CWE | Where |
|------|---------------|-------|
| SQL injection | A03:2021, CWE-89 | `src/routes/auth.js:60` (login), `src/models/post.js:28` (search) |
| Reflected XSS | A03:2021, CWE-79 | `views/search.ejs:14` |
| Stored XSS | A03:2021, CWE-79 | `views/post.ejs:20` |
| DOM based XSS | A03:2021, CWE-79 | `public/js/search.js:1` (the innerHTML sink is on line 8) |
| Sensitive data exposure | A02:2021 | plaintext passwords `src/routes/auth.js:43`, hard-coded secret `src/secrets.js:6`, session secret use `server.js:24`, debug dump `server.js:36`, verbose errors `server.js:60` |

## How to reproduce the vulnerabilities

Start the app first (see Setup below). Register at least one account. The first account you
register becomes the admin.

Note: the search page carries the SQL injection and both the reflected and DOM based XSS at the
same time. An XSS payload typed into the search box must not contain a single quote, or the SQL
breaks first and you get an error page instead. The payloads below avoid single quotes.

### 1. SQL injection, login bypass

- Go to `/login`.
- Username: `admin' OR '1'='1`
- Password: anything.
- Result: you are logged in as the first user without knowing the password.
- The username `admin'--` works the same way.

### 2. SQL injection, read the users table through search

- In the search box, enter this term:
  `zzz' UNION SELECT id, username, password, email, created_at, username FROM users -- `
- Result: the results list shows the usernames and passwords from the `users` table.

### 3. Reflected XSS

- In the search box, enter: `<script>alert(document.domain)</script>`
- Result: the term is written back to the page as raw HTML and the script runs. An alert box
  appears.

### 4. Stored XSS

- Log in, open a post, and add a comment with this body: `<script>alert('stored')</script>`
- Result: the comment is stored and rendered as raw HTML. The script runs for every later
  viewer of that post.

### 5. DOM based XSS

- In the search box, enter: `` <img src=1 onerror=alert(`dom`)> ``
- Result: the client script `public/js/search.js` writes the value into the page with
  `innerHTML`. The image fails to load, the `onerror` handler runs, and an alert box appears.

### 6. Sensitive data exposure

- Plaintext passwords: register an account, then use the debug dump below and note the password
  is stored exactly as typed.
- Debug dump: visit `/?debug=true`. Result: a JSON response with the hard-coded secrets, the
  session, and the `users` table including plaintext passwords.
- Verbose errors: visit `/search?q=x'x`. Result: a 500 page with the SQLite error and a stack
  trace, which leaks the SQL and file paths.
- Hard-coded secret: see `src/secrets.js`, which is committed with a session secret and an API
  key.

## Requirements

- Node.js 18 or newer (developed on Node 23)
- npm (bundled with Node)

`better-sqlite3` ships as a prebuilt native binary for common platforms, so no database server
or separate SQLite install is required.

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

Open <http://localhost:3000> in a browser. The first account you register becomes the admin.
Every account after that is a regular user.

## Configuration

All configuration is read from environment variables, loaded from a local `.env` file. Copy
`.env.example` to `.env` and adjust:

| Variable         | Default        | Description                                              |
|------------------|----------------|----------------------------------------------------------|
| `PORT`           | `3000`         | Port the HTTP server listens on.                         |
| `SESSION_SECRET` | dev fallback   | Secret used to sign the session cookie.                  |
| `DB_PATH`        | `data/blog.db` | Path to the SQLite database file, relative to the project root. |
| `BCRYPT_ROUNDS`  | `12`           | bcrypt cost factor. Not used on this branch, kept for parity with the other branches. |

## npm scripts

| Script            | Action                                                     |
|-------------------|------------------------------------------------------------|
| `npm start`       | Start the server.                                          |
| `npm run dev`     | Start with `node --watch` (restarts on file changes).      |
| `npm run init-db` | Create the database file and apply the schema (idempotent). |
