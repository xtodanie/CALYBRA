
"use client";

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, writeBatch, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseClient';
import type { User } from '@/lib/types';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string, companyName: string) => Promise<any>;
  logout: () => Promise<void>;
  setActiveMonthClose: (monthCloseId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDoc = useCallback(async (firebaseUser: FirebaseUser) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = { uid: firebaseUser.uid, ...userDoc.data() } as User;
      setUser(userData);
      return userData;
    } else {
      // This case can happen if the user doc creation fails after auth creation.
      // Or if the user is from an old system. For now, we sign them out.
      console.error("Authenticated user has no user document. Signing out.");
      await signOut(auth);
      setUser(null);
      return null;
    }
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserDoc(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserDoc]);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, companyName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;

    // Use a batch to ensure atomic creation of tenant and user docs
    const batch = writeBatch(db);
    const schemaVersion = 1;

    // 1. Create a new tenant document reference with an auto-generated ID
    const tenantDocRef = doc(collection(db, 'tenants'));
    batch.set(tenantDocRef, {
      name: companyName,
      ownerId: firebaseUser.uid,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'EUR',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion,
    });

    // 2. Create the user profile document reference
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    batch.set(userDocRef, {
      tenantId: tenantDocRef.id, // Use the same auto-generated ID for the tenant
      email: firebaseUser.email,
      role: 'OWNER',
      locale: 'es', // Default locale to Spanish as per spec
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion,
    });

    // 3. Commit the batch
    await batch.commit();

    return userCredential;
  };
  
  const logout = async () => {
    await signOut(auth);
  };

  const setActiveMonthClose = async (monthCloseId: string) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, { 
      activeMonthCloseId: monthCloseId,
      updatedAt: serverTimestamp() 
    });
    // Optimistically update local state or refetch user doc
    setUser(prevUser => prevUser ? { ...prevUser, activeMonthCloseId: monthCloseId } : null);
  };


  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setActiveMonthClose }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
