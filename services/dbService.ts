
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
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { Patient, Bed, User, AppNotification } from "../types";

/**
 * OMNIBASE SYNC ENGINE
 * Este servicio utiliza Firestore como fuente de verdad única.
 * El SDK maneja automáticamente la caché local y la sincronización cuando vuelve el internet.
 */

const handleFirestoreError = (error: FirestoreError, context: string) => {
    if (error.code === 'permission-denied') {
        console.error(`Error de Permisos en [${context}]: Revisa las reglas de seguridad de Firestore.`);
    } else {
        console.error(`Error técnico en [${context}]:`, error.message);
    }
};

export const dbService = {
  
  // --- REAL-TIME SUBSCRIPTIONS (Sincronización Inmediata) ---
  
  subscribePatients: (callback: (patients: Patient[]) => void) => {
    const q = query(collection(db, "patients"));
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      callback(patients);
    }, (err) => handleFirestoreError(err, "subscribePatients"));
  },

  subscribeBeds: (callback: (beds: Bed[]) => void) => {
    return onSnapshot(collection(db, "beds"), (snapshot) => {
      const beds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bed));
      callback(beds);
    }, (err) => handleFirestoreError(err, "subscribeBeds"));
  },

  subscribeNotifications: (role: string, doctorName: string | undefined, callback: (notifs: AppNotification[]) => void) => {
    const q = query(
      collection(db, "notifications"), 
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
    }, (err) => handleFirestoreError(err, "subscribeNotifications"));
  },

  // --- WRITE OPERATIONS (Queue-aware: Funcionan offline) ---

  savePatient: async (patient: Patient) => {
    try {
      const patientRef = doc(db, "patients", patient.id);
      // setDoc con merge es ideal para escalabilidad
      await setDoc(patientRef, { ...patient, lastSync: serverTimestamp() }, { merge: true });
    } catch (err: any) {
      handleFirestoreError(err, "savePatient");
    }
  },

  updateBed: async (bedId: string, updates: Partial<Bed>) => {
    try {
      const bedRef = doc(db, "beds", bedId);
      await updateDoc(bedRef, { ...updates, lastSync: serverTimestamp() });
    } catch (err: any) {
      handleFirestoreError(err, "updateBed");
    }
  },

  addNotification: async (notif: AppNotification) => {
    try {
      const notifRef = doc(db, "notifications", notif.id);
      await setDoc(notifRef, { ...notif, serverTime: serverTimestamp() });
    } catch (err: any) {
      handleFirestoreError(err, "addNotification");
    }
  },

  // --- AUTH ---

  getUser: async (username: string): Promise<User | null> => {
    const cleanUser = username.toLowerCase();
    try {
      const userDoc = await getDoc(doc(db, "users", cleanUser));
      if (userDoc.exists()) return { id: userDoc.id, ...userDoc.data() } as User;
    } catch (err: any) {
        // Fallback para desarrollo inicial si Firestore no responde
        if (cleanUser === 'admin') return { id: 'u1', username: 'admin', password: '1212', role: 'ADMINISTRADOR' };
    }
    return null;
  }
};
