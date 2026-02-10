# CALYBRA

A Next.js 15 application with Firebase backend for financial reconciliation and month-end close management.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Firebase CLI** (for backend development)

## Quick Start

Follow these steps to get the application running locally:

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Firebase CLI (if not already installed)

Firebase tools are included as a dev dependency, so you can use them via `npx`. Alternatively, install globally:

```bash
npm install -g firebase-tools
```

### 3. Login to Firebase (optional, for production deployment)

```bash
firebase login
# or if using npx
npx firebase login
```

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory with your Firebase configuration:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

**Note:** You can find these values in your [Firebase Console](https://console.firebase.google.com/) under Project Settings > General > Your apps > Firebase SDK snippet.

**For local development with emulators**, you can use placeholder values or skip this step if you're only using the local emulator suite.

## Running the Application

### Option 1: Frontend Only (Recommended for UI Development)

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at: **http://localhost:9002**

> **Note:** On first load, you'll be redirected to the authentication page. The application is a financial reconciliation platform for managing month-end close processes.

### Option 2: Full Stack with Firebase Emulators (Recommended for Full Development)

For complete backend functionality including Firestore, Authentication, and Cloud Functions, run the application with Firebase emulators:

1. **Start Firebase Emulators** (in one terminal):
   ```bash
   firebase emulators:start
   # or if using npx
   npx firebase emulators:start
   ```
   
   This will start:
   - Firestore Emulator on port 8085
   - Emulator UI at: **http://127.0.0.1:4001**

2. **Start Next.js Development Server** (in another terminal):
   ```bash
   npm run dev
   ```
   
   - Application: **http://localhost:9002**
   - Emulator UI: **http://127.0.0.1:4001**

The emulators provide a complete local environment with:
- Firestore database
- Firebase Authentication
- Firebase Cloud Functions
- Admin UI for inspecting and managing data

## Development Workflow

### Typical Development Process

1. Start the Firebase emulators:
   ```bash
   firebase emulators:start
   # or with npx
   npx firebase emulators:start
   ```

2. In a separate terminal, start the Next.js dev server:
   ```bash
   npm run dev
   ```

3. Open your browser to http://localhost:9002

4. Make changes to the code - the dev server will hot-reload automatically

5. View Firestore data and logs in the Emulator UI at http://127.0.0.1:4001

### Other Development Commands

- **Build for production:**
  ```bash
  npm run build
  ```

- **Run production build locally:**
  ```bash
  npm run build
  npm start
  ```

- **Lint your code:**
  ```bash
  npm run lint
  ```

- **Type checking:**
  ```bash
  npm run typecheck
  ```

- **Run Genkit AI development server:**
  ```bash
  npm run genkit:dev
  ```

## Testing

### Running Security Rules Tests

The project includes comprehensive security rules tests for Firestore that ensure tenant data isolation and proper access control.

**Prerequisites:** Firebase emulators must be running before you run tests.

1. **Start the emulators** (if not already running):
   ```bash
   firebase emulators:start
   # or with npx
   npx firebase emulators:start
   ```

2. **In a separate terminal, run the tests:**
   ```bash
   npm test
   ```

The tests will automatically connect to the Firestore emulator on port 8085 and validate all security rules defined in `firestore.rules`.

## Project Structure

```
CALYBRA/
├── src/
│   ├── app/              # Next.js app directory (routes and pages)
│   ├── components/       # Reusable React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and libraries
│   ├── ai/              # Genkit AI flows and prompts
│   └── middleware.ts    # Next.js middleware (i18n routing)
├── functions/           # Firebase Cloud Functions (job processing, etc.)
├── calybra-database/    # Firebase Functions for database operations
├── tests/              # Security rules and unit tests
├── docs/               # Additional documentation
├── public/             # Static assets
├── firestore.rules     # Firestore security rules
├── firebase.json       # Firebase configuration
└── package.json        # Project dependencies and scripts
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js development server on port 9002 with Turbopack |
| `npm run build` | Build the application for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint to check code quality |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run Jest tests (security rules tests) |
| `npm run genkit:dev` | Start Genkit AI development server |
| `npm run genkit:watch` | Start Genkit with auto-reload on changes |

## Troubleshooting

### Port Already in Use

If you see an error about port 9002 being in use:
- Kill the process using port 9002, or
- Change the port in `package.json` under the `dev` script

### Firebase Emulator Issues

**"Port already in use" error:**
- Stop any running emulator instances: `firebase emulators:stop` (or `npx firebase emulators:stop`) or press Ctrl+C
- Check if processes are still running: `lsof -i :8085` or `lsof -i :4001`

**Cannot connect to emulator:**
- Ensure emulators are running: `firebase emulators:start` (or `npx firebase emulators:start`)
- Check emulator status at: http://127.0.0.1:4001

### Environment Variables Not Loading

- Ensure `.env.local` is in the root directory
- Restart the development server after creating/modifying `.env.local`
- Variable names must start with `NEXT_PUBLIC_` to be accessible in the browser

### Tests Failing

- Ensure Firebase emulators are running before executing tests
- Clear emulator data if needed: Stop emulators and delete the `.emulator-data` directory
- Check that port 8085 is available for the Firestore emulator

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Technical Contracts](./CONTRACTS.MD) - Detailed technical specifications
- [Architecture Documentation](./docs/) - Additional project documentation

## Contributing

For detailed technical specifications and development contracts, please refer to [CONTRACTS.MD](./CONTRACTS.MD).
