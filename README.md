# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Local Development

To run the application locally with Firebase, you will need to create a `.env.local` file in the root of the project and populate it with your Firebase project's configuration.

Create a file named `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

You can find these values in your Firebase project settings in the Firebase Console.

## Backend Development & Testing

This project uses the Firebase Local Emulator Suite for backend development and testing.

### Prerequisites

1.  **Install Firebase CLI:** If you haven't already, install the Firebase CLI globally:
    ```bash
    npm install -g firebase-tools
    ```

2.  **Login to Firebase:**
    ```bash
    firebase login
    ```

### Running the Emulator Suite

To develop and test against a local backend, start the emulators:

```bash
firebase emulators:start
```

This will start the Auth and Firestore emulators with the UI, which can be accessed at `http://127.0.0.1:4000`. The emulators will use the rules defined in `firestore.rules`.

### Running Security Rules Tests

The security rules for Firestore are tested using `jest` and `@firebase/rules-unit-testing`. These tests ensure that tenant data isolation and other security constraints are correctly enforced.

To run the tests:

```bash
npm test
```

This command will execute all files ending in `.test.ts` inside the `tests/` directory. The tests will automatically connect to the running Firestore emulator.
# CALYBRA
# CALYBRA
# CALYBRA
