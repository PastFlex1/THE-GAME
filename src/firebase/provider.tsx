
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  resolvedIdentification: string | null;
  companyId: string | null;
  companyInfo: any | null;
  isUserLoading: boolean;
  setSession: (id: string | null) => void;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
}) => {
  const [resolvedIdentification, setResolvedIdentification] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const SUPER_ADMIN_ID = '1793221927';
  const MASTER_COMPANY_ID = '1793221927001';

  useEffect(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('facturaflow_session') : null;
    if (savedId) {
      loadUserData(savedId);
    } else {
      setIsUserLoading(false);
    }
  }, []);

  const loadUserData = async (uid: string) => {
    try {
      const userSnap = await getDoc(doc(firestore, 'users', uid));
      let effectiveCompanyId = MASTER_COMPANY_ID;

      // DATOS DE RESPALDO (THEGAME)
      const masterFallback = {
        id: MASTER_COMPANY_ID,
        name: "THEGAMEEC S.A.S",
        ruc: MASTER_COMPANY_ID,
        address: "REPUBLICA DEL SALVADOR N36-110 Y N36 SUECIA",
        isActive: true
      };

      if (userSnap.exists()) {
        const userData = userSnap.data();
        setResolvedIdentification(uid);
        
        effectiveCompanyId = userData.companyId || (uid === SUPER_ADMIN_ID ? MASTER_COMPANY_ID : 'unknown');
        setCompanyId(effectiveCompanyId);
        
        const compSnap = await getDoc(doc(firestore, 'companies', effectiveCompanyId));
        if (compSnap.exists()) {
          setCompanyInfo(compSnap.data());
        } else {
          // Si el documento físico no existe (común en despliegue nuevo), usamos THEGAME como base si es el ID maestro
          if (effectiveCompanyId === MASTER_COMPANY_ID || uid === SUPER_ADMIN_ID) {
            setCompanyInfo(masterFallback);
          } else {
            setCompanyInfo(null);
          }
        }
      } else if (uid === SUPER_ADMIN_ID) {
        setResolvedIdentification(uid);
        setCompanyId(MASTER_COMPANY_ID);
        setCompanyInfo(masterFallback);
      }
    } catch (e) {
      console.error("Error loading user data:", e);
    } finally {
      setIsUserLoading(false);
    }
  };

  const setSession = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('facturaflow_session', id);
        loadUserData(id);
      } else {
        localStorage.removeItem('facturaflow_session');
        setResolvedIdentification(null);
        setCompanyId(null);
        setCompanyInfo(null);
      }
    }
  };

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      resolvedIdentification,
      companyId,
      companyInfo,
      isUserLoading,
      setSession,
    };
  }, [firebaseApp, firestore, resolvedIdentification, companyId, companyInfo, isUserLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider.');
  return context;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore as Firestore;
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const result = useMemo(() => {
    const val = factory();
    if (val && typeof val === 'object') {
      (val as any).__memo = true;
    }
    return val;
  }, deps);
  return result;
}

export const useUser = () => {
  const { resolvedIdentification, isUserLoading, setSession, companyId, companyInfo } = useFirebase();
  return { 
    user: null, 
    resolvedIdentification, 
    companyId,
    companyInfo,
    isUserLoading,
    logout: () => setSession(null)
  };
};
