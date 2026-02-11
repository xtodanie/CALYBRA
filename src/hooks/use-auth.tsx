
"use client";

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  UserCredential,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/lib/firebaseClient';
import type { User } from '@/lib/types';
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  provisioningError: Error | null;
  login: (email: string, pass: string) => Promise<UserCredential>;
  signup: (email: string, pass: string, companyName: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  setActiveMonthClose: (monthCloseId: string) => Promise<void>;
  retryProvisioning: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioningError, setProvisioningError] = useState<Error | null>(null);
  // Store the raw firebase user to allow for retries
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const attemptProvisioning = useCallback(async (fbUser: FirebaseUser) => {
    setLoading(true);
    setProvisioningError(null);
    try {
      let userProfile: User | null = null;
      try {
        userProfile = await ensureUserProfile(fbUser);
      } catch (innerError: unknown) {
        const innerMessage = innerError instanceof Error ? innerError.message : "";
        if (innerMessage === "USER_PROFILE_PROVISIONING_TIMEOUT") {
          const ensureProvisioned = httpsCallable(functions, "ensureUserProvisioned");
          await ensureProvisioned({});
          userProfile = await ensureUserProfile(fbUser);
        } else {
          throw innerError;
        }
      }
      setUser(userProfile);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage === "USER_PROFILE_PROVISIONING_TIMEOUT") {
        console.warn("Timed out waiting for user profile. The user is authenticated but provisioning is delayed.");
        setProvisioningError(error instanceof Error ? error : new Error("Provisioning timeout"));
      } else {
        console.error("A critical error occurred during profile verification.", error);
        await signOut(auth);
        setUser(null);
        setProvisioningError(error instanceof Error ? error : new Error("Provisioning error"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser); // Store for retries
      if (fbUser) {
        await attemptProvisioning(fbUser);
      } else {
        setUser(null);
        setLoading(false);
        setProvisioningError(null);
      }
    });

    return () => unsubscribe();
  }, [attemptProvisioning]);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, _companyName: string) => {
    void _companyName;
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    const ensureProvisioned = httpsCallable(functions, "ensureUserProvisioned");
    await ensureProvisioned({});
    return credential;
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
    setUser(prevUser => prevUser ? { ...prevUser, activeMonthCloseId: monthCloseId } : null);
  };
  
  const retryProvisioning = () => {
    if (firebaseUser) {
      attemptProvisioning(firebaseUser);
    }
  };


  return (
    <AuthContext.Provider value={{ user, loading, provisioningError, login, signup, logout, setActiveMonthClose, retryProvisioning }}>
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
