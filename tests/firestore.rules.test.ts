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
      const docRef = doc(myDb, 'monthCloses', 'test-doc');
      await assertSucceeds(getDoc(docRef));
    });

    it('should PREVENT a user from reading documents in another tenant', async () => {
       const adminDb = testEnv.unauthenticatedContext().firestore();
       // Create a doc in the other tenant
       await setDoc(doc(adminDb, `tenants/${otherTenantId}/monthCloses/some-doc`), { tenantId: otherTenantId });

       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       const docRef = doc(myDb, `tenants/${otherTenantId}/monthCloses/some-doc`);
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
      await setDoc(docRef, { tenantId: myTenantId });

      const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
      await assertFails(updateDoc(docRef, { meta: 'new value' }));
    });

    it('should PREVENT deleting an audit event', async () => {
       const adminDb = testEnv.unauthenticatedContext().firestore();
       const docRef = doc(adminDb, 'auditEvents', 'event-4');
       await setDoc(docRef, { tenantId: myTenantId });

       const myDb = testEnv.authenticatedContext(myAuth.uid).firestore();
       await assertFails(deleteDoc(docRef));
    });
  });

});
