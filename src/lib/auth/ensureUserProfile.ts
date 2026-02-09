import { doc, getDoc, type DocumentData } from "firebase/firestore";
import { signOut, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import type { User } from "@/lib/types";

const PROVISIONING_TIMEOUT_MS = 20_000;
const INITIAL_BACKOFF_MS = 150;
const MAX_BACKOFF_MS = 1_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUser(uid: string, data: DocumentData): User {
  return { uid, ...(data as Omit<User, "uid">) } as User;
}

/**
 * CALYBRA AUTH INTEGRITY GUARD (READ-ONLY)
 *
 * Backend (onAuthCreate) is authoritative for creating /users + /tenants.
 * Client waits for /users/{uid} to exist with a hard timeout.
 *
 * Contract:
 * - Returns User if profile exists.
 * - Signs out and returns null if profile does not appear within timeout.
 * - Signs out and throws on terminal errors (e.g. permission issues).
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser
): Promise<User | null> {
  if (!firebaseUser?.uid) {
    await signOut(auth);
    return null;
  }

  const userDocRef = doc(db, "users", firebaseUser.uid);

  const deadline = Date.now() + PROVISIONING_TIMEOUT_MS;
  let backoff = INITIAL_BACKOFF_MS;
  let lastErr: unknown = null;

  while (Date.now() < deadline) {
    try {
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        return toUser(firebaseUser.uid, snap.data());
      }

      // Not yet provisioned. Fall through to retry.
      lastErr = null;
    } catch (err) {
      lastErr = err;

      // Terminal: permission issues should not be retried.
      // Firestore errors often carry a "code" string.
      const code = typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";

      if (code === "permission-denied" || code === "unauthenticated") {
        await signOut(auth);
        throw new Error("CALYBRA_USER_PROFILE_PERMISSION_DENIED");
      }
    }

    await sleep(backoff);
    backoff = Math.min(MAX_BACKOFF_MS, Math.floor(backoff * 1.6));
  }

  // Timeout: profile never appeared. Keep your integrity stance.
  console.warn(
    "CALYBRA: User document did not appear within provisioning timeout. Signing out.",
    { uid: firebaseUser.uid, lastErr }
  );

  await signOut(auth);
  return null;
}
