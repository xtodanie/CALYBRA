import { doc, getDoc, serverTimestamp, writeBatch, collection } from "firebase/firestore";
import { signOut, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import type { User } from '@/lib/types';

export async function ensureUserProfile(firebaseUser: FirebaseUser): Promise<User | null> {
  const userDocRef = doc(db, "users", firebaseUser.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    return { uid: firebaseUser.uid, ...userDocSnap.data() } as User;
  }

  // User doc does not exist, this is the auto-recovery case.
  console.log(`CALYBRA: User document missing for UID ${firebaseUser.uid}. Attempting auto-recovery.`);

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
      tenantId: tenantDocRef.id,
      email: firebaseUser.email,
      role: 'OWNER' as const,
      locale: 'es' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(userDocRef, newUserDocData);

    // 3. Commit the atomic write.
    await batch.commit();

    console.log(`CALYBRA: Auto-recovery successful for UID ${firebaseUser.uid}. New tenant created.`);

    // 4. Return the newly created user data to the app.
    const rehydratedUser: User = {
        uid: firebaseUser.uid,
        ...newUserDocData,
        // Timestamps will be null on the client until a server roundtrip, which is fine for now.
        createdAt: null,
        updatedAt: null,
    } as unknown as User;
    
    return rehydratedUser;

  } catch (err) {
    console.warn(
      "CALYBRA: Failed to auto-recover missing user profile and tenant.",
      { uid: firebaseUser.uid, err }
    );

    await signOut(auth);
    throw new Error("USER_PROFILE_RECOVERY_FAILED");
  }
}
