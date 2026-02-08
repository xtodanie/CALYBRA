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
const myTenantId = 'tenant-1';
const otherTenantId = 'tenant-2';

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
    // Setup initial user and tenant data
    const adminDb = testEnv.unauthenticatedContext().firestore();
    await setDoc(doc(adminDb, 'users', myAuth.uid), { tenantId: myTenantId, email: myAuth.email });
    await setDoc(doc(adminDb, 'users', otherAuth.uid), { tenantId: otherTenantId, email: otherAuth.email });
});


describe('Calybra Firestore Security Rules', () => {
  
  describe('General Tenant Isolation', () => {
    it('should allow a user to read documents in their own tenant', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      // We are trying to read a document that doesn't exist, but the rules should allow the read attempt.
      // The rules are evaluated before the database operation.
      const docRef = doc(myDb, 'monthCloses', 'test-doc');
      // For a read to be successful on a non-existent doc, we must check what the rules expect.
      // Our generic read rule `isResourceOwner()` depends on `resource.data.tenantId`.
      // For a document that does not exist, `resource` is null. The read will fail.
      // This is expected behavior. To test a successful read, we must create a document first.
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
      // monthCloseId is not required for this test as isMonthLocked returns false
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

    it('should allow a user to update their own profile', async () => {
       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const docRef = doc(myDb, 'users', myAuth.uid);
       await assertSucceeds(updateDoc(docRef, { locale: 'en' }));
    });
  });

  describe('Audit Event Rules', () => {
    it('should allow an authenticated user to create an audit event for their own tenant', async () => {
      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const docRef = doc(myDb, 'auditEvents', 'event-1');
      await assertSucceeds(setDoc(docRef, { 
          tenantId: myTenantId, 
          actorUserId: myAuth.uid,
          action: 'test.action' 
        }));
    });

    it('should PREVENT a user from creating an audit event for another tenant', async () => {
        const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
        const docRef = doc(myDb, 'auditEvents', 'event-2');
        await assertFails(setDoc(docRef, { tenantId: otherTenantId, action: 'cross.tenant.write' }));
    });

    it('should PREVENT updating an audit event', async () => {
      const adminDb = testEnv.unauthenticatedContext().firestore();
      const docRef = doc(adminDb, 'auditEvents', 'event-3');
      await setDoc(docRef, { tenantId: myTenantId, actorUserId: myAuth.uid });

      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      const myDocRef = doc(myDb, 'auditEvents', 'event-3');
      await assertFails(updateDoc(myDocRef, { meta: 'new value' }));
    });

    it('should PREVENT deleting an audit event', async () => {
       const adminDb = testEnv.unauthenticatedContext().firestore();
       const docRef = doc(adminDb, 'auditEvents', 'event-4');
       await setDoc(docRef, { tenantId: myTenantId, actorUserId: myAuth.uid });

       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const myDocRef = doc(myDb, 'auditEvents', 'event-4');
       await assertFails(deleteDoc(myDocRef));
    });
  });

});
