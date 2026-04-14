
import React from 'react';

export type HospitalRole = 
  | 'ADMINISTRADOR'
  | 'ADMISION HOSPITALARIA'
  | 'CARTAS DE GARANTIA'
  | 'CARDIOLOGIA'
  | 'FARMACIA'
  | 'RESIDENTES TRAUMATO'
  | 'RESIDENTES PEDIA'
  | 'OBSTETRICIA'
  | 'MEDICOS DE PISO'
  | 'MEDICO STAFF'
  | 'MEDICO UCI'
  | 'MEDICO UCE'
  | 'ENFERMERIA PISO'
  | 'ENFERMERIA UCI'
  | 'ENFERMERIA UCE';

export interface User {
  id: string; 
  username: string;
  role: HospitalRole; 
  password?: string; 
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface StaffSelection {
  specialty: string;
  doctorName: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ModuleId = string;
export type ViewId = string;

export interface ModuleContextProps {
  user?: User;
  viewRole?: HospitalRole;
  onPatientClick?: (id: string) => void;
  sessionUser?: string;
  filterByDoctor?: string;
}

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  description: string;
  icon: React.ElementType;
  component: React.FC<ModuleContextProps>;
  allowedRoles?: HospitalRole[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  cmp: string;
}

export interface BedHistoryRecord {
  bedNumber: string;
  startDate: string;
  endDate?: string;
  days: number;
}

export interface SurgicalData {
  isSurgical: boolean;
  preOp: boolean;
  risk: boolean; 
  letterSent: boolean; 
  letterApproved: boolean; 
  postOpDay?: number; 
}

export interface WarrantyDocumentData {
    segusCodes: { code: string; description: string }[];
    medicalReport: string; 
    anesthesiaType?: string;
    hospitalizationDays?: string;
    illnessTime?: string; 
    auxExams?: string;
    requirements?: string;
    selectedDiagnoses?: { name: string; code: string }[];
}

export interface WarrantyLetter {
  id: string;
  number: number;
  name?: string;
  status: 'pending' | 'sent' | 'approved';
  createdAt: number;
  receptionDate?: string;
  processingDate?: string;
  responseDate?: string;
  documentData?: WarrantyDocumentData;
}

export type WarrantyStatus = 'PENDIENTE' | 'EN TRAMITE' | 'APROBADO' | 'OBSERVADO' | 'REINGRESADA' | 'RECHAZADA';

export interface WarrantyRequestNote {
    id: string;
    date: string;
    text: string;
    author: string;
}

export interface WarrantyPayment {
    id: string;
    date: string;
    amount: number;
    notes?: string;
    linkedExpenseId?: string;
}

export interface WarrantyRequest {
  id: string;
  patientId?: string; 
  patientName: string;
  patientDoc: string; 
  insurance: string;
  isHospitalized: boolean;
  bedNumber?: string;
  procedure: string;
  origin?: 'Hospitalización' | 'Emergencia' | 'Consulta Externa' | 'Medicina Física' | 'Ambulatorio' | 'SOAT' | '';
  totalAmount?: number;
  coveragePercent?: number;
  initialApprovedAmount?: number;
  approvedAmount?: number;
  patientCopay?: number;
  payments?: WarrantyPayment[];
  receptionDate: string;
  processingDate?: string;
  responseDate?: string;
  letterNumber: string;
  status: WarrantyStatus;
  isClosed?: boolean;
  observation?: string;
  notesLog?: WarrantyRequestNote[];
  lastUpdate: number;
  managedBy: string;
}

export interface FinancialPayment {
    id: string;
    date: string;
    amount: number;
    notes?: string;
}

export interface FinancialCost {
    id: string;
    date: string;
    description: string;
    amount: number;
}

export interface FinancialObservation {
    id: string;
    date: string;
    text: string;
    author: string;
}

export interface FinancialData {
    warrantyAmount?: number;
    isClosed?: boolean;
    initialBudget?: number;
    totalEstimatedAmount?: number; 
    additionalCosts?: FinancialCost[];
    payments: FinancialPayment[];
    observations: FinancialObservation[];
}

export interface Surgery {
  id: string;
  date: string;
  time: string;
  procedure: string;
  linkedLetterId?: string;
  checklist: {
    preOp: boolean;
    risk: boolean;
    anesthesia: boolean;
    consent: boolean;
  };
  status: 'scheduled' | 'completed' | 'cancelled';
  cost?: number; 
  paymentStatus?: 'pending' | 'approved'; 
}

export interface ClinicalData {
  allergies: string;
  pathologies: string;
  anticoagulation: string;
}

export interface PatientImage {
  id: string;
  data: string;
  name: string; // Nuevo
  date: string;
  timestamp: number;
  report?: string;
  folderId?: string; // Nuevo
  groupId?: string; 
}

export interface ImageFolder {
  id: string;
  name: string;
  createdAt: number;
  parentId?: string;
}

export interface LabResult {
  id: string;
  date: string;
  time: string;
  testName: string;
  value: number;
  unit: string;
}

export interface MedicalReport {
  id: string;
  type: string;
  reportNumber: number;
  content: string;
  createdAt: number;
  createdByRole?: string;
}

export interface AnamnesisData {
  content: string;
  lastUpdate: number;
  locked: boolean;
  unlockRequest?: {
    requestedBy: string;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
  };
}

export interface VitalSigns {
  pa: string;
  fc: string;
  fr: string;
  temp: string;
  sat: string;
  fio2: string;
}

export interface BiologicalFunctions {
  diuresis: 'Conservada' | 'Ausente <12h' | 'Anuria >12h' | '';
  bowel: 'Conservada' | 'Ausente <3d' | 'Estreñimiento >3d' | '';
  tolerance: 'Total' | 'Parcial' | 'Vómitos/Intolerancia' | '';
}

export interface PendingTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueTime?: string;
  completedAt?: number; // Added for tracking completion time
}

export interface EvolutionRecord {
  id: string;
  date: string;
  time: string;
  note: string;
  vitals: VitalSigns;
  bioFunctions?: BiologicalFunctions;
  author: string;
  timestamp: number;
  locked: boolean;
  unlockRequest?: {
    type: 'edit' | 'delete';
    requestedBy: string;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
  };
}

export type EvolutionType = 'Nota de Ingreso' | 'Evolución' | 'Recepción' | 'Parto';

export interface ObstetricData {
    gestationWeeks?: string;
    patientType?: 'Primigesta' | 'Multigesta';
    procedureType?: string;
    procedureDate?: string;
    procedureTime?: string;
    rnSex?: 'M' | 'F';
    rnWeight?: string;
    rnHeight?: string;
    rnApgar?: string;
    au?: string;
    lcf?: string;
    loquios?: string;
    herida?: string;
    postTime?: string;
    diet?: string;
    activity?: string;
    pregnancyComplications?: string; 
}

export interface KardexData {
    diet: string;
    ivFluids: string; // Hydration
    carePlan: string; // Nursing notes/plan
    lastUpdate: number;
    updatedBy: string;
}

// NEW: Shift-based Data Structure for Charts
export interface DrainEntry {
    id: string;
    name: string;
    amount: number;
}

// Expanded for Detailed Fluid Balance
export interface ShiftRecord {
    id: string;
    date: string; 
    time: string; 
    shift: 'Mañana' | 'Tarde' | 'Noche'; 
    vitals: {
        fc?: number;
        fr?: number;
        sat?: number;
        temp?: number;
        paSys?: number;
        paDia?: number;
    };
    // Detailed Intake/Output for Balance Hidrico
    balance: {
        // Ingresos
        oral?: number;
        parenteral?: number;
        oxidation?: number; // Agua endogena
        
        // Egresos
        urine?: number;
        stool?: number; // Volume if liquid/measured
        vomit?: number;
        insensible?: number; // Perdidas insensibles
        drains: DrainEntry[];
    };
    author: string;
    timestamp: number;
}

export interface Patient {
  id: string;
  bedNumber: string;
  name: string;
  documentType: 'DNI' | 'CE';
  dni: string;
  age: number; 
  ageMonths?: number;
  hc: string; 
  phone: string; 
  familyPhone: string; 
  insurance: string;
  admissionSource: 'Emergencia' | 'Consulta Externa'; 
  weight?: string;
  height?: string;
  diagnoses: string[]; 
  cie10: string[];
  doctors: string[];
  admittingActor?: string;
  dischargingActor?: string;
  admissionDiagnosis?: string;
  dischargeDiagnosis?: string;
  surgicalData: SurgicalData;
  clinicalData: ClinicalData;
  financialData?: FinancialData;
  images: PatientImage[];
  imageFolders?: ImageFolder[]; // Nuevo
  warrantyLetters: WarrantyLetter[];
  surgeries: Surgery[];
  labResults: LabResult[];
  medicalReports: MedicalReport[];
  evolutions: EvolutionRecord[];
  shiftRecords?: ShiftRecord[]; // Updated for Balance Hidrico
  obstetricData?: ObstetricData;
  kardex?: KardexData; 
  clinicalSummary?: string;
  summaryLastUpdate?: number;
  pendingTasks: PendingTask[]; 
  anamnesis?: AnamnesisData;
  bedHistory: BedHistoryRecord[];
  alerts: string[];
  admissionDate: string;
  dischargeDate?: string;
}

export type BedStatus = 'available' | 'occupied' | 'maintenance';
export type FloorName = 'Piso 2' | 'Piso 3' | 'UCI' | 'UCE' | 'DILA';

export interface Bed {
  id: string;
  number: string;
  floor: FloorName;
  status: BedStatus;
  patientId?: string;
}

export interface AppNotification {
  id: string;
  toRole: HospitalRole;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  relatedPatientId?: string;
  targetDoctorName?: string;
}

export interface VoiceCommandData {
    rawText: string;
    targetBed?: string;
    clinicalText: string;
}

export interface Insurance {
    name: string;
    type: string;
}
