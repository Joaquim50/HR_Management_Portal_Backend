# Refresh Token Implementation Guide

This folder contains the necessary code changes to implement Refresh Token functionality when you are ready to move past the development phase.

## Steps to Implement:

1. **Update User Model**:
   - Add `refreshToken: String` to the `userSchema` in `src/models/users/user.model.js`.
   - Update `timestamp: true` to `timestamps: true`.

2. **Update Auth Controller**:
   - Replace your existing `src/controllers/auth/auth.controller.js` with the logic in `future_updates/auth.controller.refresh.js`.
   - Notice the `generateTokens` helper and the new `refreshToken` export.

3. **Update Auth Routes**:
   - Update `src/routes/auth/auth.routes.js` to include the `POST /refresh` endpoint as shown in `future_updates/auth.routes.refresh.js`.

4. **Update Environment**:
   - Add `JWT_REFRESH_SECRET` to your `.env` file with another unique high-entropy string.

5. **Token Expiry**:
   - The access token expiry is typically reduced to 15-30 minutes once refresh tokens are in place.
