
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Clock, Edit2, LogOut, CheckSquare, Square, X, Plus, AlertTriangle, User, FileText, Stethoscope, ArrowRightLeft, Star, ChevronDown, ChevronUp, Trash2, Save, Activity as ActivityIcon, CheckCircle, Wallet, PanelLeft, ArrowRight, Sparkles, RefreshCw, BarChart2, ClipboardList } from 'lucide-react';
import { Patient, Doctor, Bed, SurgicalData, ClinicalData, FloorName, HospitalRole, AppNotification, PatientImage, WarrantyLetter, VoiceCommandData, Insurance } from '../../types';
import { ImagingTab } from './ImagingTab';
import { SurgeryTab } from './SurgeryTab';
import { LabTab } from './LabTab'; 
import { MedicalReportsTab } from './MedicalReportsTab';
import { AnamnesisTab } from './AnamnesisTab';
import { VisitaTab } from './VisitaTab';
import { EvolutionsTab } from './EvolutionsTab';
import { ChartsTab } from './ChartsTab';
import { KardexTab } from './KardexTab';
import { lookupDiagnosisInfo } from '../../services/geminiService';

interface PatientFileProps {
  patientId: string;
  onBack: () => void;
  onDischarge: () => void;
  userRole?: HospitalRole;
  initialVoiceData?: VoiceCommandData | null; 
  sessionUser?: string; 
}

const ALL_ROLES: HospitalRole[] = [
    'ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA', 'CARDIOLOGIA', 'FARMACIA',
    'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO', 'MEDICO STAFF',
    'ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE'
];

export const PatientFile: React.FC<PatientFileProps> = ({ patientId, onBack, onDischarge, userRole, initialVoiceData, sessionUser }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState('visita');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // DIAGNOSIS EDITING STATE
  const [isEditingDx, setIsEditingDx] = useState(false);
  const [tempDiagnosesList, setTempDiagnosesList] = useState<{dx: string, cie: string}[]>([]); 
  const [editingRow, setEditingRow] = useState<{ index: number, field: 'dx' | 'cie' } | null>(null);
  const [isSearchingDx, setIsSearchingDx] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAllDx, setShowAllDx] = useState(false); 
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);
  const [dischargeDiagnosisInput, setDischargeDiagnosisInput] = useState('');
  const [showBedSelector, setShowBedSelector] = useState(false);
  const [allBeds, setAllBeds] = useState<Bed[]>([]);
  const [isEditingInsurance, setIsEditingInsurance] = useState(false);
  const [availableInsurances, setAvailableInsurances] = useState<Insurance[]>([]);
  const [tempDocSpecialty, setTempDocSpecialty] = useState('');
  const [tempDocName, setTempDocName] = useState('');
  const [availableDocs, setAvailableDocs] = useState<Doctor[]>([]);

  useEffect(() => {
    const loadPatient = () => {
        const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
        const found = allPatients.find(p => p.id === patientId);
        if (found) {
            if (!found.images) found.images = [];
            if (!found.warrantyLetters) found.warrantyLetters = [];
            if (!found.surgeries) found.surgeries = [];
            if (!found.labResults) found.labResults = []; 
            if (!found.medicalReports) found.medicalReports = [];
            if (!found.evolutions) found.evolutions = [];
            if (!found.imageFolders) found.imageFolders = [];
            
            setPatient(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(found)) return found;
                return prev;
            });
            
            if (!dischargeDiagnosisInput && found.diagnoses[0]) {
                setDischargeDiagnosisInput(found.diagnoses[0]);
            }
        }
    };

    loadPatient();
    const handleDbUpdate = () => loadPatient();
    window.addEventListener('omni_db_update', handleDbUpdate);
    const storedBeds = localStorage.getItem('omni_beds');
    if (storedBeds) setAllBeds(JSON.parse(storedBeds));
    const storedDocs = localStorage.getItem('omni_doctors');
    if (storedDocs) setAvailableDocs(JSON.parse(storedDocs));
    
    // Load Insurances (Robustly) from System Configuration
    const storedInsurances = localStorage.getItem('omni_insurances');
    if (storedInsurances) {
        try {
            const parsed = JSON.parse(storedInsurances);
            if (Array.isArray(parsed) && parsed.length > 0) {
                 if (typeof parsed[0] === 'string') {
                     // Migration: Convert string array to objects
                     setAvailableInsurances(parsed.map((s: string) => ({ name: s, type: s === 'PARTICULAR' ? 'PARTICULAR' : 'EPS' }))); 
                 } else {
                     setAvailableInsurances(parsed);
                 }
            } else {
                setAvailableInsurances([]);
            }
        } catch (e) { setAvailableInsurances([]); }
    } else {
        // Fallback default
        setAvailableInsurances([{ name: 'RIMAC', type: 'EPS' }, { name: 'PARTICULAR', type: 'PARTICULAR' }]);
    }

    return () => window.removeEventListener('omni_db_update', handleDbUpdate);
  }, [patientId]);

  // ... (Rest of useEffects and functions remain similar)

  useEffect(() => {
      if (initialVoiceData && patient) {
          setActiveTab('visita');
      }
  }, [initialVoiceData, patient]);

  // --- BIDIRECTIONAL AI DIAGNOSIS LOOKUP ---
  useEffect(() => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (!editingRow) return;
      const { index, field } = editingRow;
      const currentVal = field === 'dx' ? tempDiagnosesList[index]?.dx : tempDiagnosesList[index]?.cie;
      
      if (!currentVal || currentVal.length < 3) return;

      searchTimeoutRef.current = setTimeout(async () => {
          setIsSearchingDx(true);
          const type = field === 'dx' ? 'text' : 'code';
          const result = await lookupDiagnosisInfo(currentVal, type);
          
          if (result && (result.name || result.code)) {
              setTempDiagnosesList(prev => {
                  const newList = [...prev];
                  if (!newList[index]) return prev;
                  if (field === 'dx' && result.code) {
                      newList[index] = { ...newList[index], cie: result.code };
                  } else if (field === 'cie' && result.name) {
                      newList[index] = { ...newList[index], dx: result.name };
                  }
                  return newList;
              });
          }
          setIsSearchingDx(false);
          setEditingRow(null); 
      }, 800);

      return () => {
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      };
  }, [editingRow, tempDiagnosesList]);


  const getVisibleTabs = () => {
      const role = userRole || '';
      const isClinicalBase = ['ADMINISTRADOR', 'MEDICOS DE PISO', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'CARDIOLOGIA'].includes(role);
      const isNurse = ['ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE'].includes(role);
      const isStaff = role === 'MEDICO STAFF';
      
      const tabs = ['imagenes', 'cirugias']; 
      
      if (isClinicalBase || isNurse) {
          tabs.unshift('kardex');
          tabs.unshift('visita');
          tabs.unshift('graficas');
          tabs.push('laboratorio', 'evoluciones'); 
      }
      
      if (isClinicalBase || isStaff) {
          if (!tabs.includes('visita')) tabs.unshift('visita'); 
          if (!tabs.includes('laboratorio')) tabs.push('laboratorio');
          if (!tabs.includes('evoluciones')) tabs.push('evoluciones');
          tabs.push('anamnesis', 'informes');
      }
      
      const ordered = ['graficas', 'visita', 'kardex', 'imagenes', 'cirugias', 'laboratorio', 'evoluciones', 'informes', 'anamnesis'];
      return ordered.filter(t => tabs.includes(t));
  };

  const visibleTabs = getVisibleTabs();
  const isNurseRole = ['ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE'].includes(userRole || '');

  useEffect(() => {
      if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
          setActiveTab(visibleTabs[0]);
      }
  }, [visibleTabs, activeTab]);

  const canMoveBed = (): boolean => {
      const allowed: HospitalRole[] = ['ADMINISTRADOR', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO'];
      return userRole ? allowed.includes(userRole) : false;
  };

  const canEditInsurance = (): boolean => {
      const allowed: HospitalRole[] = ['ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA'];
      return userRole ? allowed.includes(userRole) : false;
  };

  const canEditClinical = (): boolean => {
    const allowed: HospitalRole[] = ['ADMINISTRADOR', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO'];
    return userRole ? allowed.includes(userRole) : false;
  };
  
  const canUncheck = (): boolean => {
      const allowed: HospitalRole[] = ['ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA'];
      return userRole ? allowed.includes(userRole) : false;
  };
  
  const canUploadImages = (): boolean => {
      const restricted: HospitalRole[] = ['ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA', 'CARDIOLOGIA', 'MEDICO STAFF'];
      return userRole ? !restricted.includes(userRole) : false;
  };

  // ... Notifications and other helpers ...
  const pushNotifications = (notifs: AppNotification[]) => {
      const existing = JSON.parse(localStorage.getItem('omni_notifications') || '[]');
      localStorage.setItem('omni_notifications', JSON.stringify([...existing, ...notifs]));
      window.dispatchEvent(new Event('omni_db_update')); 
  };

  const broadcastNotification = (title: string, message: string) => {
      if (!patient) return;
      const timestamp = Date.now();
      const notifs: AppNotification[] = ALL_ROLES.map((role, idx) => ({
          id: `broadcast-${timestamp}-${idx}`,
          toRole: role,
          title,
          message,
          timestamp,
          read: false,
          relatedPatientId: patient.id
      }));
      pushNotifications(notifs);
  };

  const notifyClinicalUpdate = (title: string, message: string, specificDoctors: string[] = []) => {
      if (!patient) return;
      const notifs: AppNotification[] = [];
      const timestamp = Date.now();
      notifs.push({ id: `clin-${timestamp}-admin`, toRole: 'ADMINISTRADOR', title, message, timestamp, read: false, relatedPatientId: patient.id });
      notifs.push({ id: `clin-${timestamp}-piso`, toRole: 'MEDICOS DE PISO', title, message, timestamp, read: false, relatedPatientId: patient.id });
      notifs.push({ id: `clin-${timestamp}-enf`, toRole: 'ENFERMERIA PISO', title, message, timestamp, read: false, relatedPatientId: patient.id });

      const allInvolvedDocs = Array.from(new Set([...patient.doctors, ...specificDoctors]));
      const docObjects = availableDocs.filter(d => allInvolvedDocs.includes(d.name));
      if (patient.age < 15) notifs.push({ id: `clin-${timestamp}-ped`, toRole: 'RESIDENTES PEDIA', title, message, timestamp, read: false, relatedPatientId: patient.id });
      if (docObjects.some(d => d.specialty.toUpperCase().includes('TRAUMATOLOGIA') || d.specialty.toUpperCase().includes('ORTOPEDIA'))) notifs.push({ id: `clin-${timestamp}-trauma`, toRole: 'RESIDENTES TRAUMATO', title, message, timestamp, read: false, relatedPatientId: patient.id });
      if (docObjects.some(d => d.specialty.toUpperCase().includes('GINECO') || d.specialty.toUpperCase().includes('OBSTETRICIA'))) notifs.push({ id: `clin-${timestamp}-obste`, toRole: 'OBSTETRICIA', title, message, timestamp, read: false, relatedPatientId: patient.id });
      if (docObjects.some(d => d.specialty.toUpperCase().includes('CARDIOLOGIA'))) notifs.push({ id: `clin-${timestamp}-cardio`, toRole: 'CARDIOLOGIA', title, message, timestamp, read: false, relatedPatientId: patient.id });
      patient.doctors.forEach((docName, idx) => {
        notifs.push({ id: `clin-${timestamp}-staff-${idx}`, toRole: 'MEDICO STAFF', targetDoctorName: docName, title, message, timestamp: timestamp + idx, read: false, relatedPatientId: patient.id });
      });
      pushNotifications(notifs);
  };

  const notifyDoctor = (doctorName: string, title: string, message: string) => {
      if (!patient) return;
      pushNotifications([{ id: `doc-specific-${Date.now()}`, toRole: 'MEDICO STAFF', targetDoctorName: doctorName, title, message, timestamp: Date.now(), read: false, relatedPatientId: patient.id }]);
  };
  
  const notifyAdminUnlock = () => {
    if (!patient) return;
    const notif: AppNotification = { id: `unlock-${Date.now()}`, toRole: 'ADMINISTRADOR', title: 'Solicitud Edición Anamnesis', message: `El usuario ${userRole} solicita editar anamnesis de ${patient.name}.`, timestamp: Date.now(), read: false, relatedPatientId: patient.id };
    pushNotifications([notif]);
  };

  const savePatient = (updated: Patient) => {
    const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
    const newAll = allPatients.map(p => p.id === updated.id ? updated : p);
    localStorage.setItem('omni_patients', JSON.stringify(newAll));
    setPatient(updated);
    window.dispatchEvent(new Event('omni_db_update'));
  };

  // ... Handlers ...
  const updateInsurance = (newInsurance: string) => { 
      if (patient) { 
          const old = patient.insurance; 
          savePatient({ ...patient, insurance: newInsurance }); 
          setIsEditingInsurance(false); 
          broadcastNotification('Cambio de Seguro', `Paciente ${patient.name} cambió seguro de ${old} a ${newInsurance}.`); 
      } 
  };
  
  const calculateDDH = (admissionDate: string) => { const start = new Date(admissionDate); const now = new Date(); const diffTime = Math.abs(now.getTime() - start.getTime()); return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); };
  const executeDischarge = () => { if (!patient) return; const updatedPatient: Patient = { ...patient, dischargeDate: new Date().toISOString().split('T')[0], dischargeDiagnosis: dischargeDiagnosisInput, dischargingActor: sessionUser }; let currentBeds: Bed[] = JSON.parse(localStorage.getItem('omni_beds') || '[]'); const updatedBeds = currentBeds.map(b => b.patientId === patient.id ? { ...b, status: 'available' as const, patientId: undefined } : b); localStorage.setItem('omni_beds', JSON.stringify(updatedBeds)); savePatient(updatedPatient); setShowDischargeConfirm(false); onDischarge(); };
  const handleBedMove = (newBed: Bed) => { if (!patient) return; const oldBed = patient.bedNumber; const updatedBeds = allBeds.map(b => { if (b.number === patient.bedNumber) return { ...b, status: 'available' as const, patientId: undefined }; if (b.id === newBed.id) return { ...b, status: 'occupied' as const, patientId: patient.id }; return b; }); const today = new Date().toISOString().split('T')[0]; const updatedHistory = [...patient.bedHistory]; if (updatedHistory.length > 0) updatedHistory[updatedHistory.length - 1].endDate = today; updatedHistory.push({ bedNumber: newBed.number, startDate: today, days: 0 }); const updatedPatient: Patient = { ...patient, bedNumber: newBed.number, bedHistory: updatedHistory }; localStorage.setItem('omni_beds', JSON.stringify(updatedBeds)); savePatient(updatedPatient); setAllBeds(updatedBeds); setShowBedSelector(false); broadcastNotification('Traslado de Cama', `Paciente ${patient.name} movido de cama ${oldBed} a ${newBed.number}.`); };
  const toggleSurgical = () => { if (!patient || !canEditClinical()) return; savePatient({ ...patient, surgicalData: { ...patient.surgicalData, isSurgical: !patient.surgicalData.isSurgical } }); };
  const updateSurgicalField = (field: keyof Omit<SurgicalData, 'postOpDay' | 'isSurgical'>) => { if (!patient || !canEditClinical()) return; const currentValue = patient.surgicalData[field]; if (currentValue === true && !canUncheck()) { alert('Acción restringida. Solo Administración o Admisión pueden desmarcar una casilla validada.'); return; } const newValue = !currentValue; const updatedSurgicalData = { ...patient.surgicalData, [field]: newValue }; let updatedSurgeries = [...patient.surgeries]; if (newValue === true && (field === 'preOp' || field === 'risk')) { updatedSurgeries = updatedSurgeries.map(surgery => ({ ...surgery, checklist: { ...surgery.checklist, [field]: true } })); } savePatient({ ...patient, surgicalData: updatedSurgicalData, surgeries: updatedSurgeries }); };
  const handleWarrantyLetterClick = () => { if (!patient || !canEditClinical()) return; if (patient.warrantyLetters.length >= 15) return; const newLetter: WarrantyLetter = { id: Date.now().toString(), number: patient.warrantyLetters.length + 1, status: 'pending', createdAt: Date.now() }; savePatient({ ...patient, warrantyLetters: [...patient.warrantyLetters, newLetter] }); };
  const updateClinicalData = (field: keyof ClinicalData, value: string) => { if (!patient || !canEditClinical()) return; savePatient({ ...patient, clinicalData: { ...patient.clinicalData, [field]: value } }); };
  const handleClinicalAlertBlur = (field: keyof ClinicalData, value: string) => { if (!patient) return; if (value.trim() !== '') { const labelMap: Record<string, string> = { allergies: 'Alergia', pathologies: 'Patología', anticoagulation: 'Anticoagulación' }; const label = labelMap[field] || field; notifyClinicalUpdate(`Alerta Clínica: ${label}`, `Paciente ${patient.name} reporta ${label}: ${value}`); } };
  const startEditingDx = () => { if (patient && canEditClinical()) { const zipped = patient.diagnoses.map((dx, i) => ({ dx, cie: patient.cie10?.[i] || '' })); setTempDiagnosesList(zipped); setIsEditingDx(true); } };
  const handleDxChange = (index: number, field: 'dx' | 'cie', value: string) => { const newList = [...tempDiagnosesList]; newList[index] = { ...newList[index], [field]: value }; setTempDiagnosesList(newList); setEditingRow({ index, field }); };
  const handleSetPrincipal = (index: number) => { const newList = [...tempDiagnosesList]; const item = newList.splice(index, 1)[0]; newList.unshift(item); setTempDiagnosesList(newList); };
  const handleDeleteDx = (index: number) => { const newList = tempDiagnosesList.filter((_, i) => i !== index); setTempDiagnosesList(newList); };
  const handleAddNewDxLine = () => { setTempDiagnosesList([...tempDiagnosesList, { dx: '', cie: '' }]); };
  const saveDxChanges = () => { if (patient) { const validItems = tempDiagnosesList.filter(d => d.dx.trim() !== ''); const newDx = validItems.map(d => d.dx); const newCie = validItems.map(d => d.cie); if (newDx.length === 0) return; savePatient({ ...patient, diagnoses: newDx, cie10: newCie }); setIsEditingDx(false); setEditingRow(null); notifyClinicalUpdate('Actualización Diagnóstico', `Nuevos diagnósticos para ${patient.name}: ${newDx.join(', ')}`); } };
  const handleAddDoc = () => { if (patient && tempDocName && !patient.doctors.includes(tempDocName)) { savePatient({ ...patient, doctors: [...patient.doctors, tempDocName] }); notifyDoctor(tempDocName, 'Asignación de Paciente', `Se le ha asignado el paciente ${patient.name} en cama ${patient.bedNumber}.`); notifyClinicalUpdate('Equipo Médico Modificado', `Se agregó al Dr. ${tempDocName} al equipo de ${patient.name}.`, [tempDocName]); setTempDocName(''); } };
  const handleRemoveDoc = (docName: string) => { if (patient) { savePatient({ ...patient, doctors: patient.doctors.filter(d => d !== docName) }); notifyDoctor(docName, 'Baja de Paciente', `Ya no está a cargo del paciente ${patient.name}.`); notifyClinicalUpdate('Equipo Médico Modificado', `El Dr. ${docName} fue retirado del equipo de ${patient.name}.`, [docName]); } };
  const getDocDetails = (docName: string) => availableDocs.find(d => d.name === docName);
  const getAgeDisplay = () => { if(!patient) return ''; if (patient.age < 2 && patient.ageMonths !== undefined) return patient.age === 0 ? `${patient.ageMonths}m` : `${patient.age}a ${patient.ageMonths}m`; return `${patient.age} años`; };
  const getApprovedLetters = () => patient?.warrantyLetters.filter(l => l.status === 'approved') || [];
  const approvedLetters = getApprovedLetters();
  const hasApprovedLetters = approvedLetters.length > 0;
  const getApprovedLettersLabel = () => { const approvedNumbers = approvedLetters.map(l => `#${l.number}`).join(', '); return approvedNumbers ? `(${approvedNumbers})` : ''; };
  const getInsuranceDisplay = (name: string) => { const ins = availableInsurances.find(i => i.name === name); if (ins) return `${name} (${ins.type})`; return name; };

  if (!patient) return <div className="p-4 text-center text-xs">Cargando...</div>;

  const surgicalItems: Array<{ key: keyof Omit<SurgicalData, 'postOpDay' | 'isSurgical'>; label: string }> = [
     { key: 'preOp', label: 'PreQx' },
     { key: 'risk', label: 'RQCV' },
  ];

  const visibleDiagnoses = showAllDx ? patient.diagnoses : patient.diagnoses.slice(0, 2);
  const hasMoreDiagnoses = patient.diagnoses.length > 2;
  const isClinicalAllowed = canEditClinical();
  const isParticular = patient.insurance === 'PARTICULAR';

  return (
    <div className="flex flex-col h-full bg-slate-100 relative">
      {/* ... (Modals omitted) ... */}
      {showDischargeConfirm && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="bg-red-50 border-b border-red-100 p-4 flex items-center gap-3">
                 <div className="bg-red-100 p-2 rounded-full text-red-600"><AlertTriangle size={20} /></div>
                 <div><h3 className="text-sm font-bold text-red-700">Confirmar Alta Médica</h3><p className="text-[10px] text-red-500">Esta acción liberará la cama.</p></div>
              </div>
              <div className="p-4 space-y-3">
                 <div className="flex items-start gap-3 bg-slate-50 p-2 rounded border border-slate-100"><User size={14} className="mt-0.5 text-slate-400" /><div><div className="text-xs font-bold text-slate-700">{patient.name}</div><div className="text-[10px] text-slate-500 font-mono">{patient.documentType}: {patient.dni}</div></div></div>
                 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnóstico de Alta</label><input type="text" value={dischargeDiagnosisInput} onChange={(e) => setDischargeDiagnosisInput(e.target.value)} className="w-full text-xs border border-slate-300 rounded p-2 text-slate-900" placeholder="Ingrese Dx Final..."/></div>
                 {sessionUser && <div className="text-[10px] text-right text-slate-400">Médico responsable: <strong>{sessionUser}</strong></div>}
              </div>
              <div className="bg-slate-50 p-3 flex gap-3"><button onClick={() => setShowDischargeConfirm(false)} className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded">Cancelar</button><button onClick={executeDischarge} className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow-sm">Confirmar Alta</button></div>
           </div>
        </div>
      )}

      {showBedSelector && (
          <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl"><h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><ArrowRightLeft size={16} className="text-primary-600"/> Mover Paciente</h3><button onClick={() => setShowBedSelector(false)}><X size={18} className="text-slate-400"/></button></div>
                  <div className="p-4 overflow-y-auto bg-slate-50 space-y-4">
                      {['UCI', 'UCE', 'DILA', 'Piso 2', 'Piso 3'].map(floor => {
                          const availBeds = allBeds.filter(b => b.floor === floor && b.status === 'available');
                          if (availBeds.length === 0) return null;
                          return (
                              <div key={floor} className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-[10px] font-bold text-slate-400 uppercase mb-2 pl-1 border-b border-slate-50 pb-1">{floor}</div><div className="grid grid-cols-4 gap-2">{availBeds.map(bed => (<button key={bed.id} onClick={() => handleBedMove(bed)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 py-2 rounded font-bold text-xs">{bed.number}</button>))}</div></div>
                          )
                      })}
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-3 h-10 flex items-center shadow-sm shrink-0 relative justify-between">
        <div className="flex items-center gap-2"><button onClick={onBack} className="flex items-center gap-1 text-slate-600 hover:text-primary-600 font-medium text-xs"><ArrowLeft size={16} /> <span className="hidden sm:inline">Volver</span></button><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`hidden md:flex p-1 rounded-md transition-colors ${!isSidebarOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`} title="Panel Lateral"><PanelLeft size={16} /></button></div>
        <h1 className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate px-2">{patient.name}</h1>
        <div className="flex items-center gap-2">{isClinicalAllowed && <button onClick={() => setShowDischargeConfirm(true)} className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg text-[10px] font-bold border border-red-200 transition-colors"><LogOut size={12} /> <span className="hidden sm:inline">ALTA</span></button>}</div>
      </div>

      <div className="flex-1 md:overflow-hidden overflow-y-auto flex flex-col md:flex-row relative">
        <div className={`transition-all duration-300 ease-in-out w-full md:flex-shrink-0 md:bg-white md:border-r border-slate-200 ${isSidebarOpen ? 'md:w-80' : 'md:w-0 md:overflow-hidden'} flex flex-col`}>
           <div className="md:h-full md:overflow-y-auto p-2 space-y-2">
               {/* INFO CARD */}
               <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative">
                   <div className="bg-slate-50 border-b border-slate-100 px-3 py-1 flex justify-between items-center"><div className="flex gap-3 text-[10px] font-bold text-slate-600 items-center"><button onClick={() => canMoveBed() && setShowBedSelector(true)} disabled={!canMoveBed()} className={`flex items-center gap-1 bg-white border border-slate-300 px-2 py-0.5 rounded shadow-sm transition-colors ${canMoveBed() ? 'text-primary-700 hover:bg-primary-50 cursor-pointer' : 'text-slate-400 cursor-not-allowed opacity-70'}`}><ArrowRight size={10} /><span>{patient.bedNumber}</span></button><div className="flex items-center gap-1"><Clock size={12} className="text-slate-400" /><span>DDH: {calculateDDH(patient.admissionDate)}</span></div>{patient.surgicalData.postOpDay !== undefined && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">PO: {patient.surgicalData.postOpDay}</span>}</div>
                   {isEditingInsurance ? (
                       <select 
                           value={patient.insurance} 
                           onChange={(e) => updateInsurance(e.target.value)} 
                           onBlur={() => setIsEditingInsurance(false)} 
                           autoFocus 
                           className="bg-white border border-blue-300 text-blue-700 text-[9px] font-bold rounded px-1 py-0.5 outline-none max-w-[120px]"
                       >
                           {availableInsurances.map(ins => <option key={ins.name} value={ins.name}>{ins.name} ({ins.type})</option>)}
                       </select>
                   ) : (
                       <button onClick={() => canEditInsurance() && setIsEditingInsurance(true)} disabled={!canEditInsurance()} className={`bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-bold border border-blue-200 flex items-center gap-1 ${canEditInsurance() ? 'hover:bg-blue-200' : 'opacity-70 cursor-not-allowed'}`}>
                           {isParticular ? <Wallet size={10} /> : <FileText size={10} />}
                           {getInsuranceDisplay(patient.insurance || 'PARTICULAR')}
                           {canEditInsurance() && <Edit2 size={8} className="opacity-50" />}
                       </button>
                   )}
                   </div>
                   <div className="p-2 text-xs space-y-1"><div className="flex justify-between items-start"><div><h2 className="text-sm font-bold text-slate-800 leading-tight">{patient.name}</h2><p className="text-[10px] text-slate-500 font-mono mt-0.5">{patient.documentType}: {patient.dni} | {getAgeDisplay()} | HC: {patient.hc}</p><div className="flex gap-2 mt-1"><a href={`tel:${patient.phone}`} className="flex items-center gap-1 text-slate-600 hover:text-primary-600 text-[10px]"><Phone size={10} /> {patient.phone}</a>{patient.familyPhone && <a href={`tel:${patient.familyPhone}`} className="flex items-center gap-1 text-slate-600 hover:text-primary-600 text-[10px] border-l border-slate-200 pl-2"><Phone size={10} /> {patient.familyPhone}</a>}</div></div><div className="text-right flex items-start gap-1">{patient.bedHistory.slice(-3).map((h, i) => (<div key={i} className="text-[9px] bg-slate-50 border border-slate-200 px-1 rounded flex flex-col items-center"><span className="font-bold text-slate-600">{h.bedNumber}</span><span className="text-[8px] text-slate-400 leading-none">{h.days || calculateDDH(h.startDate)}d</span></div>))}</div></div><div className={`mt-1 pt-1 border-t border-slate-100 flex flex-wrap items-center gap-2 ${!isClinicalAllowed ? 'opacity-80' : ''}`}><button onClick={toggleSurgical} disabled={!isClinicalAllowed} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${patient.surgicalData.isSurgical ? 'bg-primary-100 text-primary-700' : 'text-slate-400 hover:bg-slate-50'}`}>{patient.surgicalData.isSurgical ? <CheckSquare size={12} /> : <Square size={12} />}QUIRÚRGICO</button>{patient.surgicalData.isSurgical && surgicalItems.map(item => (<button key={item.key} onClick={() => updateSurgicalField(item.key)} disabled={!isClinicalAllowed} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${patient.surgicalData[item.key] ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-100 text-slate-300'}`}>{item.label}</button>))}{patient.surgicalData.isSurgical && !isParticular && (<button onClick={handleWarrantyLetterClick} disabled={!isClinicalAllowed || patient.warrantyLetters.length >= 15} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${patient.warrantyLetters.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-300'}`}>C. Env <span className="bg-white/50 px-1 rounded text-[8px]">{patient.warrantyLetters.length}</span></button>)}{patient.surgicalData.isSurgical && !isParticular && (<button className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${hasApprovedLetters ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-100 text-slate-300'} `}>C. OK <span className="text-[8px] font-mono opacity-80">{getApprovedLettersLabel()}</span></button>)}</div></div>
               </div>
               
               {/* CLINICAL DATA ALERTS */}
               <div className="grid grid-cols-3 gap-1.5">{[{ key: 'allergies', label: 'Alergias' }, { key: 'pathologies', label: 'Patologías' }, { key: 'anticoagulation', label: 'Anticoag' }].map((alert: any) => { const hasValue = !!patient.clinicalData[alert.key as keyof ClinicalData]; return (<div key={alert.key} className={`bg-white rounded border border-slate-200 p-1.5 ${!isClinicalAllowed && !hasValue ? 'opacity-50' : ''}`}><div className="flex items-center gap-1.5 mb-1"><button onClick={() => updateClinicalData(alert.key as keyof ClinicalData, hasValue ? '' : ' ')} disabled={!isClinicalAllowed} className={`p-0.5 rounded ${hasValue ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-300'}`}><CheckSquare size={10} /></button><span className={`text-[10px] font-bold truncate ${hasValue ? 'text-slate-700' : 'text-slate-400'}`}>{alert.label}</span></div>{hasValue && <input type="text" value={patient.clinicalData[alert.key as keyof ClinicalData]} onChange={(e) => updateClinicalData(alert.key as keyof ClinicalData, e.target.value)} onBlur={(e) => handleClinicalAlertBlur(alert.key as keyof ClinicalData, e.target.value)} readOnly={!isClinicalAllowed} className={`w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-900 outline-none`} />}</div>); })}</div>
               
               {/* DIAGNOSES SECTION */}
               <div className="bg-white p-1.5 rounded border border-slate-200 relative group transition-all">
                   <div className="flex justify-between items-start mb-1 px-1">
                       <span className="text-[9px] font-bold text-slate-400 uppercase">Diagnósticos</span>
                       {!isEditingDx && isClinicalAllowed && <button onClick={startEditingDx} className="text-primary-400 hover:text-primary-600"><Edit2 size={10}/></button>}
                   </div>
                   
                   {isEditingDx ? (
                       <div className="space-y-1.5 p-1">
                           {tempDiagnosesList.map((item, index) => (
                               <div key={index} className="flex gap-1 items-center bg-slate-50 border border-slate-100 p-1 rounded relative">
                                   <button onClick={() => handleSetPrincipal(index)} className={`p-0.5 shrink-0 ${index === 0 ? 'text-yellow-500' : 'text-slate-300'}`}>
                                       {index === 0 ? <Star size={12} fill="currentColor" /> : <Star size={12} />}
                                   </button>
                                   
                                   {/* CIE 10 INPUT */}
                                   <div className="relative w-16 shrink-0">
                                       <input 
                                           type="text" 
                                           value={item.cie} 
                                           onChange={(e) => handleDxChange(index, 'cie', e.target.value)} 
                                           className="w-full text-[9px] bg-white text-slate-900 border border-slate-300 rounded px-1 py-0.5 outline-none font-mono text-center"
                                           placeholder="CIE10"
                                       />
                                       {/* Spinner for CIE appears when editing DX */}
                                       {isSearchingDx && editingRow?.index === index && editingRow?.field === 'dx' && <RefreshCw size={8} className="absolute right-1 top-1 text-primary-500 animate-spin"/>}
                                   </div>

                                   {/* DIAGNOSIS NAME INPUT */}
                                   <div className="relative flex-1">
                                       <input 
                                           type="text" 
                                           value={item.dx} 
                                           onChange={(e) => handleDxChange(index, 'dx', e.target.value)} 
                                           className="w-full text-[10px] bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 outline-none"
                                           placeholder="Nombre del diagnóstico..."
                                       />
                                       {/* Sparkles for DX appear when editing CIE */}
                                       {isSearchingDx && editingRow?.index === index && editingRow?.field === 'cie' && <Sparkles size={8} className="absolute right-1 top-1 text-purple-500 animate-pulse"/>}
                                   </div>

                                   <button onClick={() => handleDeleteDx(index)} className="text-slate-300 hover:text-red-500 shrink-0">
                                       <Trash2 size={12} />
                                   </button>
                               </div>
                           ))}
                           
                           <div className="flex justify-between pt-1">
                               <button onClick={handleAddNewDxLine} className="flex items-center gap-1 text-[9px] font-bold text-primary-600 px-1.5 py-0.5 rounded">
                                   <Plus size={10} /> Agregar
                               </button>
                               <div className="flex gap-2">
                                   <button onClick={() => setIsEditingDx(false)} className="text-[9px] text-slate-500">Cancelar</button>
                                   <button onClick={saveDxChanges} className="flex items-center gap-1 text-[9px] font-bold text-white bg-primary-600 px-2 py-0.5 rounded">Guardar</button>
                               </div>
                           </div>
                       </div>
                   ) : (
                       <div className="space-y-0.5 px-1">
                           {visibleDiagnoses.map((dx, i) => (
                               <div key={i} className="flex items-start gap-1.5 font-medium text-slate-700 leading-tight">
                                   <div className={`mt-1 w-1 h-1 rounded-full shrink-0 ${i === 0 ? 'bg-primary-500' : 'bg-slate-300'}`}></div>
                                   <span className={`text-[10px] ${i === 0 ? 'font-bold' : ''}`}>
                                       {dx} <span className="text-slate-400 text-[8px] font-mono ml-1">{patient.cie10?.[i] || ''}</span>
                                   </span>
                               </div>
                           ))}
                           {hasMoreDiagnoses && (
                               <button onClick={() => setShowAllDx(!showAllDx)} className="w-full text-center text-[9px] font-bold text-slate-400 hover:bg-slate-50 py-0.5 rounded flex items-center justify-center gap-1">
                                   {showAllDx ? <ChevronUp size={8} /> : <ChevronDown size={8} />} ({patient.diagnoses.length - 2} más)
                               </button>
                           )}
                       </div>
                   )}
               </div>

               {/* DOCTORS SECTION */}
               <div className="bg-white p-1.5 rounded border border-slate-200 relative group"><div className="flex justify-between items-start mb-1 px-1"><span className="text-[9px] font-bold text-slate-400 uppercase">Equipo Médico</span>{isClinicalAllowed && <button onClick={() => setIsEditingDocs(!isEditingDocs)} className={`text-[10px] ${isEditingDocs ? 'text-primary-600 font-bold' : 'text-primary-400 hover:text-primary-600'}`}>{isEditingDocs ? 'Listo' : <Edit2 size={10}/>}</button>}</div><div className="space-y-1">{patient.doctors.map((docName, i) => { const details = getDocDetails(docName); return (<div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-1.5 rounded"><div className="flex items-center gap-1.5"><Stethoscope size={12} className="text-slate-400"/><div><div className="text-[10px] font-bold text-slate-800 leading-none">{docName}</div><div className="text-[8px] font-bold text-primary-600 mt-0.5 uppercase tracking-wide">{details?.specialty || 'Sin Especialidad'}</div></div></div><div className="flex items-center gap-2">{isEditingDocs ? <button onClick={() => handleRemoveDoc(docName)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button> : (details?.phone && <a href={`tel:${details.phone}`} className="bg-white text-green-600 p-1 rounded border border-green-100 shadow-sm"><Phone size={10} /></a>)}</div></div>); })}</div>{isEditingDocs && isClinicalAllowed && <div className="mt-2 pt-2 border-t border-slate-100 p-1"><div className="flex gap-1 items-center"><select value={tempDocSpecialty} onChange={e => {setTempDocSpecialty(e.target.value); setTempDocName('');}} className="w-1/3 text-[9px] border rounded bg-white text-slate-900 h-6 px-1 outline-none"><option value="">Esp...</option>{Array.from(new Set(availableDocs.map(d => d.specialty))).map(s => <option key={s} value={s}>{s}</option>)}</select><select value={tempDocName} onChange={e => setTempDocName(e.target.value)} className="flex-1 text-[9px] border rounded bg-white text-slate-900 h-6 px-1 outline-none"><option value="">Médico...</option>{availableDocs.filter(d => d.specialty === tempDocSpecialty).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select><button onClick={handleAddDoc} disabled={!tempDocName} className="bg-primary-600 text-white h-6 w-6 rounded flex items-center justify-center hover:bg-primary-700 disabled:opacity-50"><Plus size={12}/></button></div></div>}</div>
           </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col md:h-full md:bg-slate-50">
             <div className="bg-white border-b border-slate-200 overflow-x-auto shrink-0 flex shadow-sm z-10 sticky top-0 md:static">
                 {visibleTabs.map(tab => (
                     <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors border-b-2 ${activeTab === tab ? 'bg-primary-50 text-primary-700 border-primary-500' : 'border-transparent text-slate-400 hover:text-slate-600 bg-white'}`}>
                         {tab === 'graficas' ? <BarChart2 size={12} className="inline mr-1"/> : tab === 'kardex' ? <ClipboardList size={12} className="inline mr-1"/> : null}
                         {tab}
                     </button>
                 ))}
             </div>
             <div className="flex-1 md:overflow-y-auto p-2 pb-20 md:pb-2">
                 {activeTab === 'visita' ? (<VisitaTab patient={patient} onUpdate={savePatient} userRole={userRole} onNotify={(title, msg) => notifyClinicalUpdate(title, msg)} initialVoiceData={initialVoiceData} />) 
                 : activeTab === 'imagenes' ? (<ImagingTab patient={patient} onUpdate={savePatient} userRole={userRole} readOnly={!canUploadImages()} />) 
                 : activeTab === 'cirugias' ? (<SurgeryTab patient={patient} onUpdate={savePatient} userRole={userRole} />)
                 : activeTab === 'laboratorio' ? (<LabTab patient={patient} onUpdate={savePatient} userRole={userRole} />) 
                 : activeTab === 'evoluciones' ? (<EvolutionsTab patient={patient} onUpdate={savePatient} userRole={userRole} />) 
                 : activeTab === 'informes' ? (<MedicalReportsTab patient={patient} userRole={userRole} onUpdate={savePatient} />) 
                 : activeTab === 'anamnesis' ? (<AnamnesisTab patient={patient} userRole={userRole} onUpdate={savePatient} onRequestUnlock={notifyAdminUnlock} />)
                 : activeTab === 'graficas' ? (<ChartsTab patient={patient} onUpdate={savePatient} userRole={userRole} />)
                 : activeTab === 'kardex' ? (<KardexTab patient={patient} onUpdate={savePatient} userRole={userRole} />)
                 : (<div className="flex flex-col items-center justify-center h-full text-slate-300"><FileText size={24} className="mb-2 opacity-50"/><p className="text-[10px]">Módulo {activeTab.toUpperCase()} en construcción</p></div>)}
             </div>
        </div>
      </div>
    </div>
  );
};
