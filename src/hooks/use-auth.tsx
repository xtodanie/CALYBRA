
"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseClient';
import type { User } from '@/lib/types';
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        try {
          // This self-healing function ensures a user profile exists.
          const userProfile = await ensureUserProfile(firebaseUser);
          setUser(userProfile);
        } catch (error) {
          // ensureUserProfile will sign the user out and throw on failure.
          // We catch it here to stop execution and keep the user state as null.
          console.warn("Auth context setup failed during ensureUserProfile.", error);
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string) => {
    // Client only creates the Auth user. The `onAuthCreate` Cloud Function
    // is responsible for creating the tenant and user documents atomically.
    return createUserWithEmailAndPassword(auth, email, pass);
  };
  
  const logout = async () => {
    await signOut(auth);
  };

  const setActiveMonthClose = async (monthCloseId: string) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    // Note: The Firestore rules only allow a user to update their own document,
    // but not critical fields. We are only updating a non-critical field here.
    // In a future phase, we could move this to a Cloud Function if more complex
    // logic or validation is needed.
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
