import { doc, getDoc, serverTimestamp, writeBatch, collection, increment } from "firebase/firestore";
import { signOut, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import type { User } from '@/lib/types';

/**
 * Ensures a user profile document exists for the given authenticated user.
 * If the document is missing, it triggers the self-healing process to create
 * a new tenant and user profile, preventing the user from being in a broken state.
 * This is the client-side second line of defense after the `onAuthCreate` Cloud Function.
 */
export async function ensureUserProfile(firebaseUser: FirebaseUser): Promise<User | null> {
  const userDocRef = doc(db, "users", firebaseUser.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    // If this document was created by the auto-recovery mechanism, we might want to log it
    // or check its integrity, but for now, we just return the data.
    return { uid: firebaseUser.uid, ...userDocSnap.data() } as User;
  }

  // --- SELF-HEALING ---
  // The user is authenticated, but their user document is missing.
  // This can happen during emulator resets, manual DB deletion, or partial restores.
  // We will atomically create a new tenant and a new user doc to fix this.
  console.warn(
    `CALYBRA: User document missing for UID ${firebaseUser.uid}. Starting auto-recovery.`
  );

  try {
    const batch = writeBatch(db);
    const schemaVersion = 1;

    // 1. Create a new tenant document for the orphaned user.
    const tenantDocRef = doc(collection(db, 'tenants'));
    const companyName = firebaseUser.email ? `Company for ${firebaseUser.email}` : 'Recovered Tenant';

    batch.set(tenantDocRef, {
      name: companyName,
      ownerId: firebaseUser.uid,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'EUR',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion,
    });

    // 2. Create the user profile document, linking it to the new tenant.
    const newUserDocData = {
      schemaVersion,
      uid: firebaseUser.uid,
      tenantId: tenantDocRef.id,
      email: firebaseUser.email,
      role: 'OWNER' as const,
      plan: 'free' as const,
      status: 'active' as const,
      locale: 'es' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        source: "auto-recovery",
        recoveryCount: 1,
      }
    };
    batch.set(userDocRef, newUserDocData);

    // 3. Commit the atomic write.
    await batch.commit();

    console.log(`CALYBRA: Auto-recovery successful for UID ${firebaseUser.uid}. New tenant and user profile created.`);
    
    // 4. Return the newly created user data to the app.
    // The client doesn't get the real timestamps until the next fetch, but has enough data to proceed.
    return {
      ...newUserDocData,
      createdAt: new Date(), // Approximate timestamp
      updatedAt: new Date(),
    } as unknown as User;

  } catch (err) {
    console.warn(
      "CALYBRA: CRITICAL - User profile auto-recovery failed. The user will be signed out.",
      { uid: firebaseUser.uid, error: err }
    );
    // If recovery fails, something is seriously wrong (e.g., Firestore permissions, network).
    // The only safe option is to sign the user out to prevent a broken session.
    await signOut(auth);
    throw new Error("CALYBRA_USER_PROFILE_RECOVERY_FAILED");
  }
}
