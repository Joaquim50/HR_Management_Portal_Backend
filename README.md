# HR Management Portal Backend API Documentation

This document provides a detailed overview of the available API endpoints, their expected request bodies, and authorization requirements.

## Base URL

`http://localhost:5000` (or as configured in `.env`)

---

## Authentication

### Register User

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Body**:

```json
{
  "name": "Full Name",
  "email": "user@example.com",
  "password": "password123",
  "role": "staff" // "superadmin" or "staff"
}
```

### Login

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Body**:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

- **Response**: Returns a JWT token. Use this token in the `Authorization` header as `Bearer <token>`.

### Get Current User Profile

- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Auth**: Required

---

## Candidates Module

### Get All Candidates (with Filters)

- **URL**: `/api/candidates`
- **Method**: `GET`
- **Auth**: Required (`candidates.view`)
- **Query Parameters**:
  - `role`: Filter by role (e.g., "JR MERN", "HR")
  - `status` or `stage`: Filter by status (e.g., "Pending", "Hired", "Rejected")
  - `type`: "Fresher", "Experienced", "Intern", "Immediate Joiner", "Backup"
  - `noticePeriod`: Filter by notice period
  - `search`: Search by name, email, or phone
  - `sortBy`: Field to sort by (default: `createdAt`)
  - `order`: `asc` or `desc` (default: `desc`)
  - `page` & `limit`: For pagination

### Create Candidate (Manual)

- **URL**: `/api/candidates`
- **Method**: `POST`
- **Auth**: Required (`candidates.create`)
- **Body**: `multipart/form-data`
  - `name`: string
  - `email`: string
  - `phone`: string
  - `role`: string
  - `resume`: File (Optional)
  - `...additional fields`: Any other fields will be stored in `details`.

### Sync from Google Sheets

- **URL**: `/api/candidates/sync`
- **Method**: `POST`
- **Auth**: Required (`candidates.create`)
- **Body**:

```json
{
  "role": "JR MERN", // Optional: force specific role
  "sheetId": "GSheetID" // Optional: override default
}
```

### Bulk Import Excel

- **URL**: `/api/candidates/import`
- **Method**: `POST`
- **Auth**: Required (`candidates.create`)
- **Body**: `multipart/form-data`
  - `file`: .xlsx or .csv file
  - `role`: Optional global role

### Update Candidate Status

- **URL**: `/api/candidates/:id/status`
- **Method**: `PATCH`
- **Auth**: Required (`candidates.update`)
- **Body**:

```json
{
  "status": "Hired" // "Rejected", "Interviewing", "Pending", etc.
}
```

---

## Job Openings Module

### Get All Job Openings

- **URL**: `/api/jobs`
- **Method**: `GET`
- **Auth**: Required (`job-openings.view`)

### Create Job Opening

- **URL**: `/api/jobs`
- **Method**: `POST`
- **Auth**: Required (`job-openings.create`)
- **Body**:

```json
{
  "role": "Senior Developer",
  "requiredCount": 5,
  "category": "Full-time", // "Internship", "Contract"
  "description": "Job details..."
}
```

### Update/Delete Job Opening

- **URL**: `/api/jobs/:id`
- **Method**: `PUT` / `DELETE`
- **Auth**: Required (`job-openings.update` / `delete`)

---

## Interviews (Pipeline) Module

### Schedule Interview

- **URL**: `/api/interviews`
- **Method**: `POST`
- **Auth**: Required (`pipeline.create`)
- **Body**:

```json
{
  "candidate": "CandidateID",
  "jobOpening": "JobID",
  "interviewer": "UserID",
  "scheduledAt": "2024-03-25T10:00:00Z",
  "mode": "Online", // "Offline"
  "location": "Zoom Link / Address",
  "type": "Technical" // "HR", "Cultural"
}
```

### Update Interview (Feedback/Rating)

- **URL**: `/api/interviews/:id`
- **Method**: `PUT`
- **Auth**: Required (`pipeline.update`)
- **Body**:

```json
{
  "status": "Completed",
  "feedback": "Great technical skills.",
  "rating": 4 // 1 to 5
}
```

---

## User & Permission Management

### Get All Users

- **URL**: `/api/users`
- **Method**: `GET`
- **Auth**: Required

### Update User Permissions

- **URL**: `/api/users/:id/permissions`
- **Method**: `PATCH`
- **Auth**: Required
- **Body**:

```json
{
  "permissions": [
    {
      "module": "ModuleID",
      "canView": true,
      "canCreate": false,
      "canUpdate": true,
      "canDelete": false
    }
  ]
}
```

### Module Management

- **URL**: `/api/users/modules`
- **Method**: `GET` / `POST` / `PATCH` / `DELETE`
- **Auth**: Required (Superadmin only)

---

## Development & Seeding

### Seed Modules

To reset or initialize the module list:

```bash
node src/utils/seed_modules.js
```

This will register all 7 standard modules (Dashboard, Candidates, Pipeline, etc.) with the 4 basic CRUD actions.
