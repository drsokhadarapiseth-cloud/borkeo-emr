# Borkeo EMR (មន្ទីរពេទ្យបង្អែក បរកែវ)

Borkeo EMR is an Electronic Medical Record system tailored for Cambodian provincial hospitals, built with Node.js and native `node:sqlite`.

---

## Quickstart

### Prerequisites
- **Node.js**: `v24.0.0` or higher (verified on Node.js v24.21.0)
- **Dependencies**: Zero external runtime npm packages (uses Node.js native standard libraries: `node:sqlite`, `node:crypto`, `node:test`, `node:http`, `node:fs`).

### 1. Running the Application
- **Demo Mode** (allows one-click staff role simulation for local workstation testing):
  ```bash
  npm start
  # or
  node server/server.mjs --demo
  ```
  Access in browser at: `http://127.0.0.1:3000`

- **Production Mode** (enforces password authentication, CSRF validation, and lockout protection):
  ```bash
  NODE_ENV=production HOST=127.0.0.1 PORT=3000 node server/server.mjs
  ```

### 2. Running Tests
The project features a comprehensive regression test suite:
```bash
npm test
```
To run a specific test file:
```bash
node --test tests/v371-phone-policy.test.mjs
```

### 3. User & Production Management
- **Create Staff Account**:
  ```bash
  node scripts/create-user.mjs <username> <displayName> <role> [wards]
  ```
- **Reset User Password**:
  ```bash
  node scripts/reset-password.mjs <username> <newPassword>
  ```

---

## Documentation
- [CHANGELOG.md](CHANGELOG.md): Version history and feature milestones.
- [docs/test-changes.md](docs/test-changes.md): Test modernization notes and application bug fixes.
- [docs/test-baseline.md](docs/test-baseline.md): Test suite baseline report.
