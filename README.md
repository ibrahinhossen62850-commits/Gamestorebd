# GameStore (top-up store) – Node.js + PostgreSQL

## Structure
server.js (API) · schema.sql · scripts/setup-db.js, create-admin.js · public/ (frontend) · .env.example

## Local setup
1. Install Node 18+ and PostgreSQL; create a database.
2. `npm install`
3. `cp .env.example .env` and fill DATABASE_URL and SESSION_SECRET (generate with the command in the file).
4. `npm run db:setup`
5. Create the first admin (password typed only in your own terminal, never in code):
   `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-unique-password' npm run create-admin`
6. `npm start` → http://localhost:3000

## Deploy (Render / Railway / any VPS)
1. Push code to a PRIVATE or public repo (`.env` is git-ignored).
2. Create a managed PostgreSQL; copy its connection URL.
3. Create a Node web service: build `npm install`, start `npm start`.
4. Add env vars in the host dashboard: DATABASE_URL, SESSION_SECRET, NODE_ENV=production, PGSSL=true (if the host needs SSL).
5. In the host shell run `npm run db:setup`, then the create-admin command above.
6. Serve over HTTPS only (secure cookies need it).

## Test checklist
- Register a user, submit a deposit → appears as pending; same txn ID again → rejected.
- Log in as admin → approve → balance increases once; approve again → "Already reviewed".
- Normal user opening #/admin or /api/admin/* gets blocked.
- Try 11 wrong logins → rate-limited.

## Important
Payments are verified MANUALLY by the admin against the bKash/Nagad app. There is no automatic gateway.
Real automatic verification requires a merchant account and official bKash/Nagad payment API credentials.
