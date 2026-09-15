# AGX Service Portal — Node.js Backend

// Auto deployment test

## Stack
- Node.js
- Express
- MySQL
- mysql2
- Helmet
- CORS
- dotenv

## Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and set your MySQL credentials plus a strong `JWT_SECRET`.

Import `database/schema.sql` into MySQL/phpMyAdmin.

Then run:

```bash
npm run dev
```

API:
- `GET /`
- `GET /api/health`

The health endpoint verifies both the Express server and MySQL connection.

## Important
Never commit `.env`, passwords, JWT secrets, uploaded documents, or production credentials.

## Authentication API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` with `Authorization: Bearer <token>`

Passwords are stored as bcrypt hashes. JWTs are signed using `JWT_SECRET`.

## Profile API

- `GET /api/profile` — authenticated user's profile
- `PUT /api/profile` — update authenticated user's profile

Both endpoints require `Authorization: Bearer <token>`.

## Services & Requests API

Public:
- `GET /api/services`
- `GET /api/services/:slug`

Authenticated:
- `GET /api/requests`
- `POST /api/requests`
- `GET /api/requests/:id`

Import `database/seed.sql` after `database/schema.sql` to create the initial AGX service catalog.

## Documents API

Authenticated endpoints:
- `GET /api/documents/request/:requestId`
- `POST /api/documents/request/:requestId` — multipart field: `documents`
- `GET /api/documents/:id/download`
- `DELETE /api/documents/:id`

Allowed uploads: PDF, JPG, JPEG, PNG. Maximum 10 MB per file and 5 files per request.
Uploaded files are kept outside public static routes and are served only after ownership checks.


### Dashboard API
- `GET /api/dashboard` — authenticated live dashboard summary including profile, request statistics, recent requests, and recent notifications.
