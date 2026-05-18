'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';

/**
 * Singleton para asegurar una única inicialización de los servicios de Firebase en el cliente.
 */
let appInstance: FirebaseApp | undefined;
let firestoreInstance: Firestore | undefined;

/**
 * Inicializa los servicios de Firebase con una configuración optimizada para entornos detrás de proxies.
 * Se fuerza el uso de long-polling de forma inmediata para evitar el bloqueo de WebSockets y
 * se desactiva la autodetección para eliminar el tiempo de espera de 10 segundos antes de fallar.
 */
export function initializeFirebase() {
  // Solo inicializar en el navegador
  if (typeof window === 'undefined') {
    return { firebaseApp: null as any, firestore: null as any };
  }

  if (!appInstance) {
    const apps = getApps();
    if (apps.length > 0) {
      appInstance = apps[0];
    } else {
      try {
        appInstance = initializeApp(firebaseConfig);
      } catch (e) {
        appInstance = getApp();
      }
    }
  }

  if (!firestoreInstance) {
    try {
      /**
       * CRÍTICO: Usamos initializeFirestore con experimentalForceLongPolling y 
       * experimentalAutoDetectLongPolling desactivado para resolver problemas de conectividad 
       * en workstations y dominios con túneles de puerto.
       */
      firestoreInstance = initializeFirestore(appInstance, {
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: false,
      });
    } catch (e) {
      firestoreInstance = getFirestore(appInstance);
    }
  }

  return {
    firebaseApp: appInstance,
    firestore: firestoreInstance
  };
}

export function getSdks(firebaseApp: FirebaseApp) {
  return initializeFirebase();
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
