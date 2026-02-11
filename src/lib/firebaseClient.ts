// src/lib/firebaseClient.ts
// Client-side Firebase initialization (Next.js App Router compatible).
// Strict env validation + singleton app instance + optional emulator wiring.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from "firebase/storage";
import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions as FirebaseFunctions,
} from "firebase/functions";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function requiredEnv(name: keyof FirebaseClientConfig, value?: string): string {
  const v = value?.trim();
  if (!v) {
    // Throwing here is intentional: prevents silent misconfig → auth/api-key-not-valid.
    throw new Error(`Missing Firebase client env var for: ${name}`);
  }
  return v;
}

const firebaseConfig: FirebaseClientConfig = {
  apiKey: requiredEnv("apiKey", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: requiredEnv("authDomain", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: requiredEnv("projectId", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: requiredEnv("storageBucket", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requiredEnv("messagingSenderId", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: requiredEnv("appId", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

// Extra guard: ensures no undefined sneaks in
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) throw new Error(`Missing Firebase config value for: ${k}`);
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _functions: FirebaseFunctions | null = null;


function shouldUseEmulators(): boolean {
  const flag = (process.env.NEXT_PUBLIC_USE_EMULATORS || "").toLowerCase() === "true";
  if (!flag || process.env.NODE_ENV === "production") {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Initialize and return Firebase singletons.
 * Call from client components only (or any file that is guaranteed to run client-side).
 */
export function getFirebaseClient() {
  if (!_app) {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  if (!_auth) _auth = getAuth(_app);
  if (!_db) _db = getFirestore(_app);
   if (!_storage) _storage = getStorage(_app);
   if (!_functions) _functions = getFunctions(_app);

  // Optional emulator wiring (only once)
  if (shouldUseEmulators()) {
    // Prevent double-connecting during Fast Refresh
    const w = globalThis as unknown as { __FIREBASE_EMULATORS_CONNECTED__?: boolean };
    if (!w.__FIREBASE_EMULATORS_CONNECTED__) {
      // Use 127.0.0.1 to avoid IPv6/localhost issues in some environments.
      connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(_db, "127.0.0.1", 8085);
      connectStorageEmulator(_storage, "127.0.0.1", 9199);
      connectFunctionsEmulator(_functions, "127.0.0.1", 5001);

      w.__FIREBASE_EMULATORS_CONNECTED__ = true;
    }
  }

  return { app: _app, auth: _auth, db: _db, storage: _storage, functions: _functions };
}

// Convenience named exports (optional)
export const firebaseClient = getFirebaseClient();
export const app = firebaseClient.app;
export const auth = firebaseClient.auth;
export const db = firebaseClient.db;
export const storage = firebaseClient.storage;
export const functions = firebaseClient.functions;
