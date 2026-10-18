# Tutoring App

A marketplace where freelance tutors build profiles and students find, book and pay them.

- **Tutors** sign up, set a headline, bio, subjects, rate and location, and mark paid sessions as completed.
- **Students** search and filter tutors, book a time slot, pay through Stripe Checkout, and review the tutor after a completed session.
- **Reviews** are verified: only a student with a completed session can leave one, once per session.
- **Login** uses email and password (bcrypt) with JWT sessions.

## Stack

- Backend: Node.js 22.13+, Express, SQLite (built-in `node:sqlite`), Stripe
- Frontend: React 18, Vite, React Router

## Run it locally

```bash
# 1. Backend (http://localhost:4000)
cd backend
cp .env.example .env        # then set JWT_SECRET
npm install
npm run seed                # optional demo data
npm run dev

# 2. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Demo accounts after seeding (password `password123`): `maya@example.com` (tutor), `student@example.com` (student).

Run the API tests with `cd backend && npm test`.

## Payments

With no `STRIPE_SECRET_KEY`, the app uses a **mock checkout** page so you can click through the whole flow without taking money.

To use real Stripe Checkout:

1. Put your key in `backend/.env` as `STRIPE_SECRET_KEY`.
2. Forward webhooks: `stripe listen --forward-to localhost:4000/api/payments/webhook`, and set the printed secret as `STRIPE_WEBHOOK_SECRET`.
3. A booking becomes `paid` when Stripe sends `checkout.session.completed`.

## Before this is a real business

This is a working foundation, not a finished product. Known gaps:

- **Tutor payouts.** Payments currently go to your Stripe account and the platform fee is only recorded (`PLATFORM_FEE_PERCENT`). To pay tutors automatically, add Stripe Connect onboarding and use destination charges.
- **Refunds and disputes** are not handled; paid bookings cannot be cancelled in-app.
- **Availability.** Students propose a time; tutors cannot yet publish an availability calendar or confirm/decline.
- Email verification, password reset, rate limiting, and a production database (Postgres) are not included.
- Frontend and backend deploy separately; set `CLIENT_URL` to the frontend's URL.

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Returns `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/tutors` | Filters: `q`, `subject`, `maxRate`, `sort` |
| GET | `/api/tutors/:id` | Profile plus reviews |
| GET/PUT | `/api/tutors/me/profile` | Tutor only |
| POST | `/api/bookings` | Student only; returns a checkout URL |
| GET | `/api/bookings/mine` | Student or tutor |
| POST | `/api/bookings/:id/complete` | Tutor only, after payment |
| POST | `/api/bookings/:id/cancel` | Unpaid bookings only |
| POST | `/api/reviews` | Student only, completed sessions |
| POST | `/api/payments/webhook` | Stripe webhook |
