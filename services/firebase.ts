
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  enableIndexedDbPersistence
} from "firebase/firestore";

/**
 * OmniBase Cloud Engine
 * Configurado para sincronización multi-dispositivo y resiliencia offline.
 */
const firebaseConfig = {
  apiKey: process.env.API_KEY || "AIzaSy-OmniBase-Placeholder",
  authDomain: "omnibase-hospital.firebaseapp.com",
  projectId: "omnibase-hospital",
  storageBucket: "omnibase-hospital.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Inicialización con Cache Persistente (Offline Support nativo)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { db };
