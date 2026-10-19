# SmarTutor

A marketplace where freelance tutors build profiles, offer single sessions or multi-week courses, and students find, book and pay them.

- **Tutors** set a headline, bio, subjects, rate and location, publish courses, and mark sessions complete.
- **Students** search tutors, book a session or enroll in a course, pay through Stripe Checkout, and review the tutor afterwards.
- **Courses** run over time: 2 to 52 sessions, 1 to 3 per week, one price paid up front. The schedule is generated in the student's time zone, and sessions are completed in order.
- **Reviews** are verified: a review needs a completed session or a completed course, once each.
- **Login** is email and password (bcrypt) with JWT sessions.

## Stack

- Backend: Node 20+, Express, PostgreSQL (Supabase) via `pg`, Stripe
- Frontend: React 18, Vite, React Router
- Deploy: Vercel (`vercel.json` defines the frontend and backend services)

## Database setup (Supabase Postgres)

1. In Supabase, open your project, click **Connect**, and copy the **Transaction pooler** connection string (port 6543). Replace `[YOUR-PASSWORD]` with your database password, URL-encoding special characters.
2. Put it in `backend/.env` as `DATABASE_URL`.
3. Create the tables (safe to run repeatedly):

```bash
cd backend
npm install
npm run migrate
npm run seed      # optional demo data
```

Every table has row level security enabled with no policies, so Supabase's public REST API exposes nothing. The backend connects directly with `DATABASE_URL`.

## Run it locally

```bash
# Backend (http://localhost:4000)
cd backend && cp .env.example .env && npm run dev

# Frontend (http://localhost:5173), second terminal
cd frontend && npm install && npm run dev
```

Demo accounts after seeding (password `password123`): `maya@example.com` (tutor), `student@example.com` (student).

Tests need a throwaway database: `TEST_DATABASE_URL=... npm test` (they delete their own `@smartutor-test.invalid` rows).

## Deploy to Vercel

Set these under **Settings > Environment Variables**, then redeploy:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler string |
| `JWT_SECRET` | A long random string, e.g. `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Your Stripe key (use a test key first) |
| `STRIPE_WEBHOOK_SECRET` | From the webhook you create for `/api/payments/webhook` |
| `ALLOW_MOCK_PAYMENTS` | Optional: `true` for a demo with no Stripe key |
| `CLIENT_URL` | Optional: your site URL |

Check it worked by opening `/api/health`. It reports `database`, `jwtSecretSet` and `stripeConfigured`. If login fails, this page says why.

## Payments

With no `STRIPE_SECRET_KEY`, a mock checkout is used outside production (or when `ALLOW_MOCK_PAYMENTS=true`). In production without a key, payment endpoints return 503. A booking becomes `paid`, and an enrollment `active`, when Stripe sends `checkout.session.completed`.

## Known gaps

- No tutor payouts. The platform fee is recorded but money goes to your Stripe account; add Stripe Connect to pay tutors.
- No refunds or disputes, and no rescheduling.
- No availability calendar or messaging.
- No email verification, password reset or rate limiting.

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Database, JWT and Stripe status |
| POST | `/api/auth/register`, `/api/auth/login` | Returns `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/tutors`, `/api/tutors/:id` | Search; profile with courses and reviews |
| GET/PUT | `/api/tutors/me/profile` | Tutor only |
| POST | `/api/bookings` | Student; returns a checkout URL |
| GET | `/api/bookings/mine` | Student or tutor |
| POST | `/api/bookings/:id/complete`, `/cancel` | Tutor after payment / unpaid only |
| GET | `/api/courses`, `/api/courses/:id` | Browse and detail |
| GET | `/api/courses/mine` | Tutor's courses |
| POST/PUT | `/api/courses`, `/api/courses/:id` | Tutor; also archive and restore |
| POST | `/api/enrollments` | Student; generates the schedule |
| GET | `/api/enrollments/mine` | With sessions and progress |
| POST | `/api/enrollments/sessions/:id/complete` | Tutor, in order, after start time |
| POST | `/api/enrollments/:id/cancel` | Unpaid only |
| POST | `/api/reviews` | Student; `bookingId` or `enrollmentId` |
| POST | `/api/payments/webhook` | Stripe webhook |
