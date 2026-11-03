# MediClock demo authentication

MediClock uses browser-only demo authentication. It does not use Firebase, a backend, or an external database.

## Sign-in and accounts

- Each seeded user has a unique role-based Login ID. Initial passwords are delivered separately with the demo credentials.
- Passwords are checked using salted PBKDF2-SHA-256 hashes. Plaintext passwords are not stored in LocalStorage; an administrator-generated password is shown once when creating or resetting an account.
- Five consecutive incorrect password attempts lock that account for 15 minutes. A browser-wide attempt limiter allows at most 20 attempts per minute. Attempt and lockout state is persisted in the existing LocalStorage data record.
- A successful login clears the account's failed-attempt and lockout state. Sessions persist across refreshes and expire after 12 hours. Logging out removes the current browser session.
- Administrators can view Login IDs, activate/deactivate accounts, and reset passwords from Administration → User management.
- Existing LocalStorage data is migrated in place: inventory, clinics, users, purchases, transfers, audit records, notifications, and historical demo records are retained. The old profile-selector session is intentionally not accepted; users must sign in.

## Security limitation

This is a frontend-only prototype, not production authentication. A person controlling the browser can edit LocalStorage or application code, replace password hashes, alter lockout state, or bypass role checks. Password hashes and client-side rate limits do not provide server-side protection. Do not use real accounts, patient information, or other sensitive data.
