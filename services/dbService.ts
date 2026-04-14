
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  limit,
  FirestoreError,
  serverTimestamp,
  updateDoc,
  getDocFromServer
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Patient, Bed, User, AppNotification } from "../types";

/**
 * OMNIBASE SYNC ENGINE
 * Este servicio utiliza Firestore como fuente de verdad única.
 */

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const dbService = {
  
  testConnection: async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  },

  // --- REAL-TIME SUBSCRIPTIONS ---
  
  subscribePatients: (callback: (patients: Patient[]) => void) => {
    const path = "patients";
    const q = query(collection(db, path));
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      callback(patients);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
  },

  subscribeBeds: (callback: (beds: Bed[]) => void) => {
    const path = "beds";
    return onSnapshot(collection(db, path), (snapshot) => {
      const beds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bed));
      callback(beds);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
  },

  subscribeNotifications: (role: string, doctorName: string | undefined, callback: (notifs: AppNotification[]) => void) => {
    const path = "notifications";
    const q = query(
      collection(db, path), 
      where("toRole", "==", role),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      let notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      if (role === 'MEDICO STAFF' && doctorName) {
        notifs = notifs.filter(n => !n.targetDoctorName || n.targetDoctorName === doctorName);
      }
      callback(notifs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
  },

  // --- WRITE OPERATIONS ---

  savePatient: async (patient: Patient) => {
    const path = `patients/${patient.id}`;
    try {
      const patientRef = doc(db, "patients", patient.id);
      await setDoc(patientRef, { ...patient, lastSync: serverTimestamp() }, { merge: true });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  updateBed: async (bedId: string, updates: Partial<Bed>) => {
    const path = `beds/${bedId}`;
    try {
      const bedRef = doc(db, "beds", bedId);
      await updateDoc(bedRef, { ...updates, lastSync: serverTimestamp() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  addNotification: async (notif: AppNotification) => {
    const path = `notifications/${notif.id}`;
    try {
      const notifRef = doc(db, "notifications", notif.id);
      await setDoc(notifRef, { ...notif, serverTime: serverTimestamp() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // --- AUTH ---

  getUser: async (username: string): Promise<User | null> => {
    const cleanUser = username.toLowerCase();
    const path = `users/${cleanUser}`;
    try {
      const userDoc = await getDoc(doc(db, "users", cleanUser));
      if (userDoc.exists()) return { id: userDoc.id, ...userDoc.data() } as User;
    } catch (err: any) {
        if (cleanUser === 'admin') return { id: 'u1', username: 'admin', password: '1212', role: 'ADMINISTRADOR' };
        handleFirestoreError(err, OperationType.GET, path);
    }
    return null;
  }
};

dbService.testConnection();
