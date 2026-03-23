# Scalable Modular Permission System

This architecture provides ultimate flexibility by treating features as "Modules" that can be dynamically added to the system.

## Core Models

### 1. Module Model
Stores the definition of a feature/module.
-   `name`: Display name (e.g., "Interviews")
-   `slug`: System identifier (e.g., "interviews")
-   `actions`: Allowed actions (default: view, create, update, delete)

### 2. UserPermission Model (Junction)
Maps a specific **User** to a **Module** with granular access flags.
-   `user`: Ref to User
-   `module`: Ref to Module
-   `canView`, `canCreate`, `canUpdate`, `canDelete`: Boolean flags

---

## Admin Workflow

### Step 1: Create a Module
As a `superadmin`, you first define the module in the database.
- **Endpoint**: `POST /api/users/modules`
- **Payload**:
```json
{
  "name": "Candidates",
  "slug": "candidates",
  "description": "Candidate management module"
}
```

### Step 2: Assign Permission to a User
Once the module exists, you grant access to a specific staff member.
- **Endpoint**: `PATCH /api/users/:userId/permissions`
- **Payload**:
```json
{
  "moduleId": "65ba...module_id_here...",
  "canView": true,
  "canCreate": true,
  "canUpdate": false,
  "canDelete": false
}
```

---

## Technical Overview for Developers

The `authorize(moduleSlug, action)` middleware automatically handles the cross-collection lookup.

```javascript
// Protection Example
router.get("/", protect, authorize("candidates", "view"), getCandidates);
```

1.  It finds the **Module** ID using the slug `"candidates"`.
2.  It looks up the **UserPermission** record for the current `user._id` and that `module._id`.
3.  It checks if the corresponding flag (e.g., `canView`) is `true`.
