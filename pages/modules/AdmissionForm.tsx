
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Stethoscope, FileText, Search, AlertCircle, Eraser, Sparkles, Baby, RefreshCw } from 'lucide-react';
import { Doctor, Patient, Bed, AppNotification, HospitalRole, Insurance } from '../../types';
import { lookupDiagnosisInfo } from '../../services/geminiService';

interface AdmissionFormProps {
  bedNumber: string;
  bedId: string;
  onClose: () => void;
  onSuccess: (newPatientId: string) => void;
  sessionUser?: string; // Passed from WorkspaceHub
}

export const AdmissionForm: React.FC<AdmissionFormProps> = ({ bedNumber, bedId, onClose, onSuccess, sessionUser }) => {
  // --- STATE ---
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    documentType: 'DNI' as 'DNI' | 'CE',
    documentNumber: '',
    hc: '',
    age: '',
    ageMonths: '',
    phone: '',
    familyPhone: '',
    admissionDate: new Date().toISOString().split('T')[0],
    admissionSource: 'Emergencia' as 'Emergencia' | 'Consulta Externa',
    insurance: '', // Start empty, will fill in useEffect
    pregnancyComplications: '' // New Field
  });

  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [availableInsurances, setAvailableInsurances] = useState<Insurance[]>([]);
  
  // Doctor Selection Helpers
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctorName, setSelectedDoctorName] = useState('');
  const [assignedDoctors, setAssignedDoctors] = useState<string[]>([]);

  // Diagnosis Selection Helpers
  const [tempDiagnosis, setTempDiagnosis] = useState('');
  const [tempCie10, setTempCie10] = useState('');
  const [assignedDiagnoses, setAssignedDiagnoses] = useState<{ dx: string; cie: string }[]>([]);
  const [isSearchingDx, setIsSearchingDx] = useState(false);
  const [activeField, setActiveField] = useState<'dx' | 'cie' | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [errors, setErrors] = useState<string[]>([]);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // --- 1. LOAD DATA & DRAFT ---
  useEffect(() => {
    // A. Load Doctors
    const savedDoctors = localStorage.getItem('omni_doctors');
    let docs: Doctor[] = [];
    if (savedDoctors && savedDoctors !== '[]') {
      docs = JSON.parse(savedDoctors);
    } else {
      docs = [
        { id: 'doc-test-1', name: 'Dr. Juan Perez', specialty: 'CARDIOLOGIA', phone: '987654321', cmp: '12345' },
        { id: 'doc-test-2', name: 'Dra. Maria Rodriguez', specialty: 'PEDIATRIA', phone: '912345678', cmp: '67890' }
      ];
      localStorage.setItem('omni_doctors', JSON.stringify(docs));
    }
    setDoctorsList(docs);
    const specs = Array.from(new Set(docs.map((d: Doctor) => d.specialty)));
    setAvailableSpecialties(specs);

    // B. Load Insurances (DYNAMIC)
    let validInsurances: Insurance[] = [];
    const savedInsurances = localStorage.getItem('omni_insurances');
    if (savedInsurances) {
        try {
            const parsed = JSON.parse(savedInsurances);
            if (Array.isArray(parsed) && parsed.length > 0) {
                 if (typeof parsed[0] === 'string') {
                     validInsurances = parsed.map((s: string) => ({ name: s, type: s === 'PARTICULAR' ? 'PARTICULAR' : 'EPS' })); 
                 } else {
                     validInsurances = parsed;
                 }
            }
        } catch(e) { console.error(e); }
    } 
    
    if (validInsurances.length === 0) {
        validInsurances = [{ name: 'RIMAC', type: 'EPS' }, { name: 'PARTICULAR', type: 'PARTICULAR' }];
    }
    setAvailableInsurances(validInsurances);

    // C. Load Draft or Set Default Insurance
    const draft = localStorage.getItem('omni_admission_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setFormData(parsed.formData);
        setAssignedDoctors(parsed.assignedDoctors);
        setAssignedDiagnoses(parsed.assignedDiagnoses);
        setHasDraft(true);
      } catch (e) {
        console.error("Error loading draft", e);
      }
    } else {
        // Set default insurance to the first one in the list if not set
        if (validInsurances.length > 0) {
            setFormData(prev => ({ ...prev, insurance: validInsurances[0].name }));
        }
    }
  }, []);

  // --- 2. AUTOSAVE EFFECT ---
  useEffect(() => {
    const hasData = formData.lastName || formData.documentNumber || assignedDoctors.length > 0;
    if (hasData) {
      const draftState = { formData, assignedDoctors, assignedDiagnoses };
      localStorage.setItem('omni_admission_draft', JSON.stringify(draftState));
    }
  }, [formData, assignedDoctors, assignedDiagnoses]);

  // --- 3. AUTO-COMPLETE DIAGNOSIS (Robust Bidirectional) ---
  
  // Effect 1: Text -> CIE10
  useEffect(() => {
      if (activeField !== 'dx') return;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (tempDiagnosis.length > 3) {
          setIsSearchingDx(true);
          searchTimeoutRef.current = setTimeout(async () => {
              const result = await lookupDiagnosisInfo(tempDiagnosis, 'text');
              if (result && result.code) {
                  setTempCie10(result.code);
              }
              setIsSearchingDx(false);
          }, 800);
      } else {
          setIsSearchingDx(false);
      }
      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [tempDiagnosis, activeField]);

  // Effect 2: CIE10 -> Text
  useEffect(() => {
      if (activeField !== 'cie') return;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (tempCie10.length >= 3) {
          setIsSearchingDx(true);
          searchTimeoutRef.current = setTimeout(async () => {
              const result = await lookupDiagnosisInfo(tempCie10, 'code');
              if (result && result.name) {
                  setTempDiagnosis(result.name);
              }
              setIsSearchingDx(false);
          }, 800);
      } else {
          setIsSearchingDx(false);
      }
      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [tempCie10, activeField]);


  // --- HANDLERS ---
  const handleClearDraft = () => {
    localStorage.removeItem('omni_admission_draft');
    setFormData({
      lastName: '',
      firstName: '',
      documentType: 'DNI',
      documentNumber: '',
      hc: '',
      age: '',
      ageMonths: '',
      phone: '',
      familyPhone: '',
      admissionDate: new Date().toISOString().split('T')[0],
      admissionSource: 'Emergencia',
      insurance: availableInsurances[0]?.name || '', // Reset to default
      pregnancyComplications: ''
    });
    setAssignedDoctors([]);
    setAssignedDiagnoses([]);
    setHasDraft(false);
    setIsAutoFilled(false);
  };

  const handleAgeChange = (val: string) => {
    let num = parseInt(val);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 130) num = 130;
    const newMonths = num >= 2 ? '' : formData.ageMonths;
    setFormData({ ...formData, age: val === '' ? '' : num.toString(), ageMonths: newMonths });
  };

  const handleMonthsChange = (val: string) => {
    let num = parseInt(val);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 11) num = 11;
    setFormData({ ...formData, ageMonths: val === '' ? '' : num.toString() });
  };

  const checkExistingPatient = (docNumber: string) => {
    if (!docNumber || docNumber.length < 8) return;
    const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
    
    // Check Active
    const activeAdmission = allPatients.find(p => p.dni === docNumber && !p.dischargeDate);
    if (activeAdmission) {
      setErrors([`¡ALERTA! El paciente ya se encuentra hospitalizado en la cama ${activeAdmission.bedNumber}. No puede haber duplicidad.`]);
      return;
    } else {
      setErrors([]);
    }

    // Check History
    const historicRecord = allPatients
      .filter(p => p.dni === docNumber)
      .sort((a, b) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime())[0];

    if (historicRecord) {
      const [last, first] = historicRecord.name.split(', ');
      setFormData(prev => ({
        ...prev,
        lastName: last || '',
        firstName: first || '',
        documentType: historicRecord.documentType,
        hc: historicRecord.hc,
        age: historicRecord.age.toString(),
        ageMonths: historicRecord.ageMonths !== undefined ? historicRecord.ageMonths.toString() : '',
        phone: historicRecord.phone,
        familyPhone: historicRecord.familyPhone,
        insurance: historicRecord.insurance || availableInsurances[0]?.name || ''
      }));
      setIsAutoFilled(true);
    } else {
      setIsAutoFilled(false);
    }
  };

  const handleAddDoctor = () => { if (selectedDoctorName && !assignedDoctors.includes(selectedDoctorName)) { setAssignedDoctors([...assignedDoctors, selectedDoctorName]); setSelectedDoctorName(''); } };
  const removeDoctor = (name: string) => { setAssignedDoctors(assignedDoctors.filter(d => d !== name)); };
  const handleAddDiagnosis = () => { if (tempDiagnosis || tempCie10) { setAssignedDiagnoses([...assignedDiagnoses, { dx: tempDiagnosis, cie: tempCie10 }]); setTempDiagnosis(''); setTempCie10(''); } };
  const removeDiagnosis = (idx: number) => { setAssignedDiagnoses(assignedDiagnoses.filter((_, i) => i !== idx)); };

  const generateNotifications = (patient: Patient, docObjects: Doctor[]) => {
    const notifs: AppNotification[] = [];
    const timestamp = Date.now();
    const ageStr = patient.age < 2 && patient.ageMonths !== undefined ? `${patient.age}a ${patient.ageMonths}m` : `${patient.age} años`;
    const baseMsg = `Paciente: ${patient.name} (${ageStr}). Dx: ${patient.diagnoses[0]}.`;

    notifs.push({ id: `notif-${timestamp}-piso`, toRole: 'MEDICOS DE PISO', title: 'Nuevo Ingreso', message: `${baseMsg} Asignado a cama ${patient.bedNumber}.`, timestamp, read: false, relatedPatientId: patient.id });
    if (patient.age < 15) { notifs.push({ id: `notif-${timestamp}-pedia`, toRole: 'RESIDENTES PEDIA', title: 'Ingreso Pediátrico', message: `${baseMsg} Requiere valoración.`, timestamp, read: false, relatedPatientId: patient.id }); }

    const assignedDocObjects = docObjects.filter(d => assignedDoctors.includes(d.name));
    if (assignedDocObjects.some(d => d.specialty.toUpperCase().includes('TRAUMATOLOGIA') || d.specialty.toUpperCase().includes('ORTOPEDIA'))) {
      notifs.push({ id: `notif-${timestamp}-trauma`, toRole: 'RESIDENTES TRAUMATO', title: 'Ingreso Traumatología', message: `${baseMsg}`, timestamp, read: false, relatedPatientId: patient.id });
    }
    if (assignedDocObjects.some(d => d.specialty.toUpperCase().includes('GINECO') || d.specialty.toUpperCase().includes('OBSTETRICIA'))) {
      notifs.push({ id: `notif-${timestamp}-obste`, toRole: 'OBSTETRICIA', title: 'Ingreso Obstetricia', message: `${baseMsg}`, timestamp, read: false, relatedPatientId: patient.id });
    }
    if (assignedDocObjects.some(d => d.specialty.toUpperCase().includes('CARDIOLOGIA'))) {
        notifs.push({ id: `notif-${timestamp}-cardio`, toRole: 'CARDIOLOGIA', title: 'Ingreso Cardiología', message: `${baseMsg}`, timestamp, read: false, relatedPatientId: patient.id });
    }

    assignedDoctors.forEach((docName, idx) => {
        notifs.push({ id: `notif-${timestamp}-staff-${idx}`, toRole: 'MEDICO STAFF', targetDoctorName: docName, title: 'Paciente Asignado', message: `Se le ha asignado el paciente ${patient.name} en la cama ${patient.bedNumber}.`, timestamp: timestamp + idx, read: false, relatedPatientId: patient.id });
    });
    return notifs;
  };

  const handleSubmit = () => {
    const newErrors: string[] = [];
    if (!formData.lastName || !formData.firstName) newErrors.push("El nombre completo es obligatorio.");
    if (formData.documentType === 'DNI' && formData.documentNumber.length !== 8) newErrors.push("El DNI debe tener exactamente 8 dígitos.");
    if (formData.documentType === 'CE' && formData.documentNumber.length !== 10) newErrors.push("El CE debe tener exactamente 10 dígitos.");
    if (formData.hc.length !== 6) newErrors.push("La Historia Clínica (HC) debe tener 6 dígitos.");
    if (assignedDoctors.length === 0) newErrors.push("Debe asignar al menos un médico tratante.");
    if (assignedDiagnoses.length === 0) newErrors.push("Debe ingresar al menos un diagnóstico.");
    
    const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
    if (allPatients.some(p => p.dni === formData.documentNumber && !p.dischargeDate)) newErrors.push("El paciente ya tiene una admisión activa.");

    if (newErrors.length > 0) { setErrors(newErrors); return; }

    const ageNum = parseInt(formData.age) || 0;
    const ageMonthsNum = (ageNum < 2 && formData.ageMonths !== '') ? parseInt(formData.ageMonths) : undefined;

    const newPatient: Patient = {
      id: Date.now().toString(),
      bedNumber: bedNumber,
      name: `${formData.lastName}, ${formData.firstName}`,
      documentType: formData.documentType,
      dni: formData.documentNumber,
      hc: formData.hc,
      age: ageNum,
      ageMonths: ageMonthsNum,
      phone: formData.phone,
      familyPhone: formData.familyPhone,
      insurance: formData.insurance,
      admissionSource: formData.admissionSource,
      admissionDate: formData.admissionDate,
      doctors: assignedDoctors,
      diagnoses: assignedDiagnoses.map(d => d.dx),
      cie10: assignedDiagnoses.map(d => d.cie),
      admittingActor: sessionUser, // CAPTURE ACTOR
      admissionDiagnosis: assignedDiagnoses[0].dx, // SNAPSHOT ADMISSION DX
      surgicalData: { isSurgical: false, preOp: false, risk: false, letterSent: false, letterApproved: false },
      clinicalData: { allergies: '', pathologies: '', anticoagulation: '' },
      obstetricData: { pregnancyComplications: formData.pregnancyComplications }, // CAPTURE COMPLICATIONS
      bedHistory: [{ bedNumber: bedNumber, startDate: formData.admissionDate, days: 0 }],
      alerts: [],
      images: [],
      warrantyLetters: [],
      surgeries: [],
      labResults: [],
      medicalReports: [],
      evolutions: [],
      pendingTasks: [],
      anamnesis: undefined,
      clinicalSummary: undefined, 
      summaryLastUpdate: 0
    };

    localStorage.setItem('omni_patients', JSON.stringify([...allPatients, newPatient]));
    
    // UPDATE BEDS
    let existingBeds: Bed[] = JSON.parse(localStorage.getItem('omni_beds') || '[]');
    if (existingBeds.length === 0) {
       existingBeds = [
        { id: 'def-201', number: '201', floor: 'Piso 2', status: 'available' },
        { id: 'def-300', number: '300', floor: 'Piso 3', status: 'available' },
        { id: 'def-uci1', number: 'UCI 1', floor: 'UCI', status: 'available' },
        { id: 'def-ucea', number: 'UCE A', floor: 'UCE', status: 'available' },
        { id: 'def-dila1', number: 'DILA 1', floor: 'DILA', status: 'available' },
       ];
    }
    const updatedBeds = existingBeds.map(b => {
      if (b.id === bedId) { return { ...b, status: 'occupied' as const, patientId: newPatient.id }; }
      return b;
    });
    localStorage.setItem('omni_beds', JSON.stringify(updatedBeds));

    const newNotifications = generateNotifications(newPatient, doctorsList);
    const existingNotifs = JSON.parse(localStorage.getItem('omni_notifications') || '[]');
    localStorage.setItem('omni_notifications', JSON.stringify([...existingNotifs, ...newNotifications]));
    
    localStorage.removeItem('omni_admission_draft');
    window.dispatchEvent(new Event('omni_db_update'));
    onSuccess(newPatient.id);
  };

  const isInfant = parseInt(formData.age || '0') < 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="px-4 py-2 border-b border-slate-200 flex justify-between items-center bg-primary-50 rounded-t-xl">
          <div>
              <h2 className="text-sm font-bold text-slate-800">Admisión Hospitalaria</h2>
              <p className="text-[10px] text-primary-700 font-medium">Cama {bedNumber} {sessionUser ? `• Usuario: ${sessionUser}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasDraft && (
                <button onClick={handleClearDraft} className="text-[10px] text-slate-500 hover:text-red-500 flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                    <Eraser size={12} /> Borrar
                </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="p-3 space-y-2 max-h-[80vh] overflow-y-auto">
          {hasDraft && !isAutoFilled && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-2 py-1 rounded text-[10px] flex items-center gap-1"><FileText size={12} /><span>Borrador restaurado.</span></div>}
          {isAutoFilled && <div className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-1 rounded text-[10px] flex items-center gap-1"><AlertCircle size={12} /><span>Datos autocompletados.</span></div>}

          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-0.5">Datos del Paciente</h3>
             <div className="grid grid-cols-3 gap-2">
                <div>
                   <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Tipo Doc.</label>
                   <select value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value as 'DNI' | 'CE'})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7">
                     <option value="DNI">DNI</option><option value="CE">CE</option>
                   </select>
                </div>
                <div className="col-span-2 relative">
                   <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Número ({formData.documentType === 'DNI' ? '8' : '10'} dígitos)</label>
                   <input type="text" maxLength={formData.documentType === 'DNI' ? 8 : 10} value={formData.documentNumber} onChange={e => { const val = e.target.value.replace(/\D/g, ''); setFormData({...formData, documentNumber: val}); }} onBlur={() => checkExistingPatient(formData.documentNumber)} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs font-mono tracking-wide focus:ring-1 focus:ring-primary-500 outline-none h-7" />
                  <div className="absolute right-2 top-6 text-slate-400"><Search size={12} /></div>
                </div>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div><label className="block text-[9px] font-bold text-slate-500 mb-0.5">Apellidos</label><input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" placeholder="Ej: Perez Garcia"/></div>
              <div><label className="block text-[9px] font-bold text-slate-500 mb-0.5">Nombres</label><input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" placeholder="Ej: Juan Carlos"/></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1"><label className="block text-[9px] font-bold text-slate-500 mb-0.5">HC (6 dig.)</label><input type="text" maxLength={6} value={formData.hc} onChange={e => { const val = e.target.value.replace(/\D/g, ''); setFormData({...formData, hc: val}); }} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-primary-500 outline-none h-7" placeholder="123456"/></div>
                
                <div className="col-span-1">
                    <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Edad</label>
                    <div className="flex gap-1">
                        <input 
                            type="number" 
                            value={formData.age} 
                            onChange={e => handleAgeChange(e.target.value)} 
                            className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" 
                            placeholder="Años"
                            min="0" max="130"
                        />
                        {isInfant && (
                            <input 
                                type="number" 
                                value={formData.ageMonths} 
                                onChange={e => handleMonthsChange(e.target.value)}
                                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" 
                                placeholder="Mes"
                                min="0" max="11"
                            />
                        )}
                    </div>
                </div>

                <div className="col-span-1"><label className="block text-[9px] font-bold text-slate-500 mb-0.5">F. Ingreso</label><input type="date" value={formData.admissionDate} onChange={e => setFormData({...formData, admissionDate: e.target.value})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" /></div>
             </div>
             <div className="grid grid-cols-3 gap-2">
               <div className="col-span-1">
                 <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Origen</label>
                 <select value={formData.admissionSource} onChange={e => setFormData({...formData, admissionSource: e.target.value as any})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 py-1 text-[10px] focus:ring-1 focus:ring-primary-500 outline-none h-7">
                   <option value="Emergencia">Emergencia</option><option value="Consulta Externa">C. Externa</option>
                 </select>
               </div>
               <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div><label className="block text-[9px] font-bold text-slate-500 mb-0.5">Tel. Paciente</label><input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" /></div>
                  <div><label className="block text-[9px] font-bold text-slate-500 mb-0.5">Tel. Familiar</label><input type="tel" value={formData.familyPhone} onChange={e => setFormData({...formData, familyPhone: e.target.value})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7" /></div>
               </div>
             </div>
             <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Seguro</label>
                <select value={formData.insurance} onChange={e => setFormData({...formData, insurance: e.target.value})} className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 outline-none h-7">
                   {availableInsurances.map(ins => (
                       <option key={ins.name} value={ins.name}>
                           {ins.name} ({ins.type})
                       </option>
                   ))}
                </select>
             </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-0.5 flex items-center gap-2"><Stethoscope size={12} /> Médicos Tratantes</h3>
            <div className="flex gap-1 items-end bg-slate-50 p-2 rounded-lg border border-slate-100">
               <div className="flex-1"><label className="block text-[9px] font-bold text-slate-400 mb-0.5">Especialidad</label><select value={selectedSpecialty} onChange={e => { setSelectedSpecialty(e.target.value); setSelectedDoctorName(''); }} className="w-full bg-white text-slate-900 text-[10px] border border-slate-300 rounded p-1 focus:ring-1 focus:ring-primary-500 outline-none h-6"><option value="">Seleccionar...</option>{availableSpecialties.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
               <div className="flex-1"><label className="block text-[9px] font-bold text-slate-400 mb-0.5">Médico</label><select value={selectedDoctorName} onChange={e => setSelectedDoctorName(e.target.value)} disabled={!selectedSpecialty} className="w-full bg-white text-slate-900 text-[10px] border border-slate-300 rounded p-1 disabled:opacity-50 focus:ring-1 focus:ring-primary-500 outline-none h-6"><option value="">Seleccionar...</option>{doctorsList.filter(d => d.specialty === selectedSpecialty).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
               <button onClick={handleAddDoctor} disabled={!selectedDoctorName} className="bg-primary-600 text-white p-1 rounded hover:bg-primary-700 disabled:opacity-50 h-6 w-6 flex items-center justify-center"><Plus size={14} /></button>
            </div>
            {assignedDoctors.length > 0 && <div className="flex flex-wrap gap-1">{assignedDoctors.map(doc => <span key={doc} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded text-[10px] border border-primary-100 leading-none">{doc}<button onClick={() => removeDoctor(doc)} className="text-primary-400 hover:text-red-500"><X size={10} /></button></span>)}</div>}
          </div>

          <div className="space-y-1.5">
             <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-0.5 flex items-center gap-2"><FileText size={12} /> Diagnósticos</h3>
             <div className="flex gap-1 items-end bg-slate-50 p-2 rounded-lg border border-slate-100 relative">
                <div className="flex-[2] relative">
                    <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Diagnóstico</label>
                    <input 
                        type="text" 
                        value={tempDiagnosis} 
                        onChange={e => { setTempDiagnosis(e.target.value); setActiveField('dx'); }} 
                        className="w-full bg-white text-slate-900 text-[10px] border border-slate-300 rounded p-1 focus:ring-1 focus:ring-primary-500 outline-none h-6 pr-6" 
                        placeholder="Texto"
                    />
                    {isSearchingDx && activeField === 'cie' && <Sparkles size={10} className="absolute right-2 top-6 text-purple-500 animate-pulse" />}
                </div>
                <div className="flex-1 relative">
                    <label className="block text-[9px] font-bold text-slate-400 mb-0.5">CIE10</label>
                    <input 
                        type="text" 
                        value={tempCie10} 
                        onChange={e => { setTempCie10(e.target.value); setActiveField('cie'); }} 
                        className="w-full bg-white text-slate-900 text-[10px] border border-slate-300 rounded p-1 focus:ring-1 focus:ring-primary-500 outline-none h-6 pr-6" 
                        placeholder="Cod"
                    />
                    {isSearchingDx && activeField === 'dx' && <RefreshCw size={10} className="absolute right-2 top-6 text-blue-500 animate-spin" />}
                </div>
                <button onClick={handleAddDiagnosis} disabled={!tempDiagnosis} className="bg-primary-600 text-white p-1 rounded hover:bg-primary-700 disabled:opacity-50 h-6 w-6 flex items-center justify-center"><Plus size={14} /></button>
             </div>
             {assignedDiagnoses.length > 0 && <div className="space-y-1">{assignedDiagnoses.map((item, idx) => <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 p-1 rounded text-[10px]"><div><span className="font-bold text-slate-700">{item.cie}</span><span className="mx-1 text-slate-300">|</span><span className="text-slate-600">{item.dx}</span></div><button onClick={() => removeDiagnosis(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button></div>)}</div>}
          </div>

          {/* OBSTETRIC COMPLICATIONS INPUT */}
          <div className="space-y-1.5">
             <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-0.5 flex items-center gap-2"><Baby size={12} /> Datos Obstétricos Iniciales</h3>
             <div className="bg-pink-50 border border-pink-100 rounded-lg p-2">
                 <label className="block text-[9px] font-bold text-pink-700 mb-0.5">Complicaciones del Embarazo</label>
                 <input 
                    type="text" 
                    value={formData.pregnancyComplications} 
                    onChange={e => setFormData({...formData, pregnancyComplications: e.target.value})}
                    placeholder="Ej: Preclamsia, Placenta Previa... (Dejar en blanco si no aplica)"
                    className="w-full bg-white text-slate-900 text-[10px] border border-pink-200 rounded p-1.5 focus:ring-1 focus:ring-pink-500 outline-none"
                 />
             </div>
          </div>

          {errors.length > 0 && <div className="bg-red-50 border border-red-100 rounded-lg p-2"><ul className="list-disc list-inside text-[10px] text-red-600 font-bold">{errors.map((err, idx) => <li key={idx}>{err}</li>)}</ul></div>}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 rounded-b-xl flex justify-end gap-2">
           <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
           <button onClick={handleSubmit} className="px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-md transition-colors flex items-center gap-1"><Save size={14} /> Crear</button>
        </div>
      </div>
    </div>
  );
};
