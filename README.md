# Employee Management System - Backend

This project provides the backend services for the Employee Management System, built with Node.js, Express, and MongoDB.

## Authentication APIs

All authentication routes are prefixed with `/api/auth`.

| Endpoint             | Method | Description                   | Auth Required                   |
| -------------------- | ------ | ----------------------------- | ------------------------------- |
| `/api/auth/register` | `POST` | Register a new user           | No                              |
| `/api/auth/login`    | `POST` | Authenticate user & get token | No                              |
| `/api/auth/me`       | `GET`  | Get current user's profile    | Yes (`view_profile` permission) |

## Candidate APIs

All candidate routes are prefixed with `/api/candidates`.

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/candidates/sync` | `POST` | Sync data from Google Sheet | Yes (`superadmin` only) |
| `/api/candidates/import` | `POST` | Bulk import from Excel (.xlsx) | Yes (`superadmin` only) |
| `/api/candidates` | `GET` | Get candidates with pagination and sorting | Yes (Authenticated) |

### GET /api/candidates Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sortBy`: Field to sort by (e.g., `createdAt`, `name`)
- `order`: Sort order (`asc` or `desc`, default: `desc`)
- `search`: Find by name or email (case-insensitive regex)
- `role`: Filter by role
- `status`: Filter by status

**Response Format:**
```json
{
  "candidates": [...],
  "total": 120,
  "page": 1,
  "pages": 12
}
```
| `/api/candidates/:id` | `GET` | Get candidate details with history and interview info | Yes (Authenticated) |
| `/api/candidates` | `POST` | Create a candidate manually | Yes (Authenticated) |
| `/api/candidates/:id/status` | `PATCH` | Update candidate status (appends to history) | Yes (Authenticated) |
| `/api/candidates/:id` | `DELETE` | Delete a candidate | Yes (`superadmin` only) |

### Bulk Import Format
For Excel imports, use the following headers (case-sensitive or fuzzy-matched):
- `Email address` or `Email` (Required)
- `Full Name` or `Name`
- `Phone NO` or `Phone Number`
- `Role` or `Position` (JR MERN, SR MERN, HR, QA, DevOps)
- Any other columns will be stored in the `details` map.

## Role-Based Access Control (RBAC)

The system uses a permission-based authorization middleware. For a detailed breakdown of all roles, permissions, and how to add new ones, see the [Roles and Permissions Guide](./ROLES_AND_PERMISSIONS.md).

### Summary Table

| Role         | Permissions                       | Description                       |
|--------------|-----------------------------------|-----------------------------------|
| `superadmin` | ALL (Bypasses checks)             | Full system control               |
| `interviewer`| `view_profile`, `manage_interviews` | Candidate management & interviews |
| `staff`      | `view_profile`                    | Basic access to profile/candidate info |

### Usage in Routes

```javascript
import { protect, authorize } from "../../middlewares/auth.middleware.js";

// Protect route with specific permission
router.get(
  "/protected-route",
  protect,
  authorize("your_permission"),
  controller,
);
```

### API Details

#### 1. Register User

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "interviewer"
  }
  ```
- **Success Response**: `201 Created` with token and user object.

#### 2. Login User

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Success Response**: `200 OK` with token and user object.

#### 3. Get Current User

- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response**: `200 OK` with user object.

## Testing with Dummy Data

### 1. Authentication

#### Register a new Superadmin/Interviewer
- **Endpoint**: `POST /api/auth/register`
- **Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123",
  "role": "superadmin"
}
```

#### Login
- **Endpoint**: `POST /api/auth/login`
- **Body**:
```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```

---

### 2. Candidate Management

#### Create a Candidate Manually
- **Endpoint**: `POST /api/candidates`
- **Body**:
```json
{
  "name": "John Smith",
  "email": "john.smith@example.com",
  "phone": "9876543210",
  "role": "JR MERN"
}
```

#### Update Candidate Status
- **Endpoint**: `PATCH /api/candidates/{id}/status`
- **Body**:
```json
{
  "status": "Shortlisted"
}
```

#### Get All Candidates (with filtering)
- **Endpoint**: `GET /api/candidates?role=JR MERN&status=Pending`

---

### 3. Bulk Operations

#### Google Sheets Sync
- **Endpoint**: `POST /api/candidates/sync`
- **Method**: `POST`
- **Body**:
```json
{
  "role": "JR MERN"
}
```
*(Optional: If provided, this role will be assigned to all candidates from the sheet)*
- **Auth**: Requires Superadmin token in `Authorization` header.

#### Excel Import
- **Endpoint**: `POST /api/candidates/import`
- **Method**: `multipart/form-data`
- **Fields**:
    - `file`: The `.xlsx` file (Required)
    - `role`: The role to assign to all candidates in this file (Optional - e.g., `JR MERN`, `HR`). If omitted, the server looks for a "Role" column in the file.
- **Sample Excel Data**:
| Email | Name | Phone NO |
|-------|------|----------|
| test@example.com | Test User | 1234567890 |

---

## Setup

1. Install dependencies: `npm install`
2. Create a `.env` file in the root directory. Use `.env.example` as a template:
   ```bash
   cp .env.example .env
   ```
3. Update the values in `.env` with your actual configuration.
4. Start the server: `npm start` (runs on port 2000 by default)

## Initial Superadmin Creation

To create the initial superadmin user, you can run the following command from the project root:

```bash
node src/utils/seed_admin.js
```

By default, this will create a superadmin with:

- **Email**: `admin@gmail.com`
- **Password**: `admin@123`

You can also create a superadmin via the `/api/auth/register` API by setting `"role": "superadmin"` in the request body.
