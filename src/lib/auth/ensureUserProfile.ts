import { doc, getDoc } from "firebase/firestore";
import { signOut, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import type { User } from "@/lib/types";

/**
 * CALYBRA AUTH INTEGRITY GUARD (READ-ONLY)
 *
 * This function is the client-side safety net for user authentication.
 * Its only job is to ensure that an authenticated user has a corresponding
 * user document in Firestore.
 *
 * The primary creation of user and tenant documents is handled by the
 * `onAuthCreate` Cloud Function, which is more reliable and secure.
 *
 * This client-side check handles edge cases where the client auth state
 * resolves before the `onAuthCreate` function has completed, or if
 * Firestore data has been cleared (e.g., in the emulator).
 *
 * If the user document is missing, it signs the user out. It does NOT attempt
 * to create any documents, as that is the backend's exclusive responsibility.
 *
 * Contract:
 * - Returns User object if the session and profile are valid.
 * - Returns null if the user document is missing, after signing the user out.
 * - Throws an error that is caught by the AuthProvider.
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser
): Promise<User | null> {
  const userDocRef = doc(db, "users", firebaseUser.uid);

  try {
    const userDocSnap = await getDoc(userDocRef);

    // ─────────────────────────────────────────────
    // HAPPY PATH — user profile already exists
    // ─────────────────────────────────────────────
    if (userDocSnap.exists()) {
      return {
        uid: firebaseUser.uid,
        ...userDocSnap.data(),
      } as User;
    }

    // ─────────────────────────────────────────────
    // RECOVERY PATH — missing user document
    // ─────────────────────────────────────────────
    console.warn(
      "CALYBRA: User document missing. This can happen with emulators or if the `onAuthCreate` function failed. Signing out to ensure data integrity.",
      { uid: firebaseUser.uid }
    );
    
    await signOut(auth);
    // Returning null will ensure the user state is cleared in the auth context.
    return null;

  } catch (err) {
    // ─────────────────────────────────────────────
    // TERMINAL FAILURE — e.g., Firestore permissions error
    // ─────────────────────────────────────────────
    console.warn(
      "CALYBRA: A terminal error occurred while trying to verify user profile. The user will be signed out.",
      { uid: firebaseUser.uid, error: err }
    );
    
    await signOut(auth);
    // We throw an error here to be caught by the calling AuthProvider,
    // which will stop the auth process and prevent the app from loading
    // in a broken state.
    throw new Error("CALYBRA_USER_PROFILE_VERIFICATION_FAILED");
  }
}
