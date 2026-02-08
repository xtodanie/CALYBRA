
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const MY_PROJECT_ID = 'calybra-test';
const myAuth = { uid: 'user-abc', email: 'abc@example.com' };
const otherAuth = { uid: 'user-xyz', email: 'xyz@example.com' };
const newAuth = { uid: 'user-new', email: 'new@example.com' }; // For creation tests
const myTenantId = 'tenant-1';
const otherTenantId = 'tenant-2';
const myMonthId = 'month-abc';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: MY_PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    // Setup initial user and tenant data for tests that require existing users.
    const adminDb = testEnv.unauthenticatedContext().firestore();
    await setDoc(doc(adminDb, 'users', myAuth.uid), { tenantId: myTenantId, email: myAuth.email });
    await setDoc(doc(adminDb, 'users', otherAuth.uid), { tenantId: otherTenantId, email: otherAuth.email });
});


describe('Calybra Firestore Security Rules', () => {

  describe('General Tenant Isolation', () => {
    it('should allow a user to read documents in their own tenant', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const adminDb = testEnv.unauthenticatedContext().firestore();
      const adminDocRef = doc(adminDb, 'monthCloses', 'test-doc-read');
      await setDoc(adminDocRef, { tenantId: myTenantId });

      const myDocRef = doc(myDb, 'monthCloses', 'test-doc-read');
      await assertSucceeds(getDoc(myDocRef));
    });

    it('should PREVENT a user from reading documents in another tenant', async () => {
       const adminDb = testEnv.unauthenticatedContext().firestore();
       await setDoc(doc(adminDb, 'invoices', 'some-doc'), { tenantId: otherTenantId });

       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const docRef = doc(myDb, 'invoices', 'some-doc');
       await assertFails(getDoc(docRef));
    });

    it('should allow a user to write documents in their own tenant', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const docRef = doc(myDb, 'invoices', 'new-invoice');
      await assertSucceeds(setDoc(docRef, { tenantId: myTenantId, amount: 100 }));
    });

    it('should PREVENT a user from writing documents into another tenant', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const docRef = doc(myDb, 'invoices', 'fraud-invoice');
      await assertFails(setDoc(docRef, { tenantId: otherTenantId, amount: 999 }));
    });
  });

  describe('User Profile Rules', () => {
    it('should allow a user to read their own profile', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const docRef = doc(myDb, 'users', myAuth.uid);
      await assertSucceeds(getDoc(docRef));
    });

    it('should PREVENT a user from reading another user\'s profile', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const docRef = doc(myDb, 'users', otherAuth.uid);
      await assertFails(getDoc(docRef));
    });

    it('should allow a user to update their own activeMonthCloseId', async () => {
       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const docRef = doc(myDb, 'users', myAuth.uid);
       await assertSucceeds(updateDoc(docRef, { activeMonthCloseId: 'new-month' }));
    });

    it('should PREVENT a user from updating their tenantId', async () => {
       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const docRef = doc(myDb, 'users', myAuth.uid);
       await assertFails(updateDoc(docRef, { tenantId: 'new-tenant' }));
    });

    it('should allow a user to create their own user document', async () => {
      const newDb = testEnv.authenticatedContext(newAuth.uid).firestore();
      const newUserDoc = doc(newDb, 'users', newAuth.uid);
      await assertSucceeds(setDoc(newUserDoc, { email: newAuth.email, tenantId: 'new-tenant-id' }));
    });

    it('should PREVENT a user from creating a document for another user', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const anotherUserDoc = doc(myDb, 'users', newAuth.uid);
      await assertFails(setDoc(anotherUserDoc, { email: newAuth.email, tenantId: myTenantId }));
    });
  });

  describe('Tenant Rules', () => {
    it('should allow a user to create a tenant where they are the owner', async () => {
      const newDb = testEnv.authenticatedContext(newAuth.uid).firestore();
      const newTenantDoc = doc(newDb, 'tenants', 'new-tenant');
      await assertSucceeds(setDoc(newTenantDoc, { name: 'NewCo', ownerId: newAuth.uid }));
    });

    it('should PREVENT a user from creating a tenant and assigning a different owner', async () => {
      const newDb = testEnv.authenticatedContext(newAuth.uid).firestore();
      const newTenantDoc = doc(newDb, 'tenants', 'new-tenant');
      await assertFails(setDoc(newTenantDoc, { name: 'HijackedCo', ownerId: otherAuth.uid }));
    });

    it('should allow a member to read their own tenant document', async () => {
      const adminDb = testEnv.unauthenticatedContext().firestore();
      await setDoc(doc(adminDb, 'tenants', myTenantId), { name: 'MyCo', ownerId: myAuth.uid });

      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const myTenantDoc = doc(myDb, 'tenants', myTenantId);
      await assertSucceeds(getDoc(myTenantDoc));
    });

    it('should PREVENT a user from reading a tenant document they are not a member of', async () => {
      const adminDb = testEnv.unauthenticatedContext().firestore();
      await setDoc(doc(adminDb, 'tenants', otherTenantId), { name: 'OtherCo', ownerId: otherAuth.uid });

      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const otherTenantDoc = doc(myDb, 'tenants', otherTenantId);
      await assertFails(getDoc(otherTenantDoc));
    });
  });

  describe('Audit Event Rules', () => {
    it('should allow a user to create an audit event for their own tenant', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const docRef = doc(myDb, 'auditEvents', 'event-1');
      await assertSucceeds(setDoc(docRef, {
          tenantId: myTenantId,
          actor: myAuth.uid,
          action: 'test.action',
          createdAt: serverTimestamp() // This is how you test server timestamps
        }));
    });

    it('should PREVENT creating an audit event for another tenant', async () => {
        const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
        const docRef = doc(myDb, 'auditEvents', 'event-2');
        await assertFails(setDoc(docRef, {
            tenantId: otherTenantId,
            action: 'cross.tenant.write',
            createdAt: serverTimestamp()
        }));
    });

    it('should PREVENT updating an audit event', async () => {
      const adminDb = testEnv.unauthenticatedContext().firestore();
      const docRef = doc(adminDb, 'auditEvents', 'event-3');
      await setDoc(docRef, { tenantId: myTenantId, actor: myAuth.uid });

      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const myDocRef = doc(myDb, 'auditEvents', 'event-3');
      await assertFails(updateDoc(myDocRef, { meta: 'new value' }));
    });

    it('should PREVENT deleting an audit event', async () => {
       const adminDb = testEnv.unauthenticatedContext().firestore();
       const docRef = doc(adminDb, 'auditEvents', 'event-4');
       await setDoc(docRef, { tenantId: myTenantId, actor: myAuth.uid });

       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const myDocRef = doc(myDb, 'auditEvents', 'event-4');
       await assertFails(deleteDoc(myDocRef));
    });
  });

  describe('Match Finalization Rules', () => {
    it('should PREVENT a client from setting a match status directly', async () => {
        const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
        const matchRef = doc(myDb, 'matches', 'match-1');
        await assertFails(setDoc(matchRef, {
            tenantId: myTenantId,
            status: 'CONFIRMED' // This is the forbidden field
        }));
    });

    it('should PREVENT a client from setting a match finalizedBy directly', async () => {
        const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
        const matchRef = doc(myDb, 'matches', 'match-2');
        await assertFails(setDoc(matchRef, {
            tenantId: myTenantId,
            finalizedBy: myAuth.uid // This is the forbidden field
        }));
    });

    it('should allow creating a match if forbidden fields are not present', async () => {
        const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
        const matchRef = doc(myDb, 'matches', 'match-3');
        await assertSucceeds(setDoc(matchRef, {
            tenantId: myTenantId,
            score: 80 // A client-settable field
        }));
    });
  });

  describe('Job Rules', () => {
      it('should allow creating a job for your own tenant', async () => {
          const db = testEnv.authenticatedContext(myAuth.uid).firestore();
          const jobRef = doc(db, 'jobs', 'job-1');
          await assertSucceeds(setDoc(jobRef, { tenantId: myTenantId, monthCloseId: myMonthId }));
      });
      it('should PREVENT creating a job for another tenant', async () => {
          const db = testEnv.authenticatedContext(myAuth.uid).firestore();
          const jobRef = doc(db, 'jobs', 'job-1');
          await assertFails(setDoc(jobRef, { tenantId: otherTenantId, monthCloseId: myMonthId }));
      });
  });
});
