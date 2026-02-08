import { doc, getDoc } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { db } from "@/lib/firebaseClient";
import type { User } from "@/lib/types";

/**
 * Waits for a user's Firestore document to be created.
 *
 * This function polls Firestore at a regular interval until the user document
 * exists or a timeout is reached. This is crucial for handling the latency
 * between Firebase Auth user creation and the `onAuthCreate` Cloud Function
 * trigger that creates the corresponding Firestore document.
 *
 * @param firebaseUser - The user object from Firebase Authentication.
 * @param timeoutMs - The maximum time to wait in milliseconds.
 * @param pollIntervalMs - The interval between polling attempts.
 * @returns A promise that resolves with the User object once it's found.
 * @throws Throws a `USER_PROFILE_PROVISIONING_TIMEOUT` error if the document
 *         is not found within the timeout period.
 * @throws Throws a `CALYBRA_USER_PROFILE_VERIFICATION_FAILED` for other Firestore errors.
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
  timeoutMs = 15000, // 15 seconds
  pollIntervalMs = 500
): Promise<User> {
  const userDocRef = doc(db, "users", firebaseUser.uid);
  const startTime = Date.now();

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  while (Date.now() - startTime < timeoutMs) {
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        // HAPPY PATH — user profile exists.
        return {
          uid: firebaseUser.uid,
          ...userDocSnap.data(),
        } as User;
      }
      // Document doesn't exist yet, wait before polling again.
      await sleep(pollIntervalMs);
    } catch (err) {
      // This catches Firestore-level errors (e.g., permissions).
      // We shouldn't retry in this case, so we fail fast.
      console.warn(
        "CALYBRA: A terminal error occurred while trying to poll for user profile.",
        { uid: firebaseUser.uid, error: err }
      );
      throw new Error("CALYBRA_USER_PROFILE_VERIFICATION_FAILED");
    }
  }

  // If we exit the loop, it means we timed out.
  throw new Error("USER_PROFILE_PROVISIONING_TIMEOUT");
}
