
import React, { useState, useEffect } from 'react';
import { Bed, FloorName, User, HospitalRole, Patient, Doctor } from '../../types';
import { UserPlus, User as UserIcon, Wrench, LayoutGrid } from 'lucide-react';
import { AdmissionForm } from './AdmissionForm';

interface BedMapProps {
  user?: User;
  viewRole?: HospitalRole;
  onPatientClick?: (patientId: string) => void;
  sessionUser?: string;
}

export const BedMap: React.FC<BedMapProps> = ({ user, viewRole, onPatientClick, sessionUser }) => {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmission, setShowAdmission] = useState(false);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);

  const effectiveRole = viewRole || user?.role;

  const loadData = () => {
    const today = new Date().toISOString().split('T')[0];

    // 1. DOCTORS SEEDING
    let currentDoctors: Doctor[] = [];
    const savedDoctors = localStorage.getItem('omni_doctors');
    if (savedDoctors && savedDoctors !== '[]') {
        currentDoctors = JSON.parse(savedDoctors);
    } else {
        currentDoctors = [
            { id: 'doc-1', name: 'Dr. Juan Perez', specialty: 'CARDIOLOGIA', phone: '987654321', cmp: '12345' },
            { id: 'doc-2', name: 'Dra. Maria Rodriguez', specialty: 'PEDIATRIA', phone: '912345678', cmp: '67890' },
            { id: 'doc-3', name: 'Dr. Carlos Huesos', specialty: 'TRAUMATOLOGIA', phone: '998877665', cmp: '11223' },
            { id: 'doc-4', name: 'Dra. Ana Gomez', specialty: 'OBSTETRICIA', phone: '991122334', cmp: '54321' },
            { id: 'doc-5', name: 'Dr. Luis Torres', specialty: 'MEDICINA INTERNA', phone: '955443322', cmp: '98765' }
        ];
        localStorage.setItem('omni_doctors', JSON.stringify(currentDoctors));
    }
    setDoctorsList(currentDoctors);

    // 2. PATIENTS SEEDING (With Examples)
    let currentPatients: Patient[] = [];
    const savedPatients = localStorage.getItem('omni_patients');
    if (savedPatients && savedPatients !== '[]') {
        currentPatients = JSON.parse(savedPatients);
    } else {
        // --- GENERATE EXAMPLE PATIENTS ---
        currentPatients = [
            {
                id: 'pat-1', bedNumber: '201', name: 'Gonzales Perez, Maria', documentType: 'DNI', dni: '40506070', age: 45, hc: '100200', phone: '999000111', familyPhone: '999000222', insurance: 'RIMAC', admissionSource: 'Emergencia', admissionDate: today,
                doctors: ['Dr. Luis Torres'], diagnoses: ['Apendicitis Aguda', 'Peritonitis Localizada'], cie10: ['K35.8', 'K65.0'],
                surgicalData: { isSurgical: true, preOp: true, risk: true, letterSent: true, letterApproved: false, postOpDay: 1 },
                clinicalData: { allergies: 'Penicilina', pathologies: 'HTA', anticoagulation: '' },
                images: [], warrantyLetters: [], surgeries: [{ id: 'sx-1', date: today, time: '14:00', procedure: 'Apendicectomía Laparoscópica', checklist: { preOp: true, risk: true, anesthesia: true, consent: true }, status: 'completed' }],
                labResults: [], medicalReports: [], evolutions: [], pendingTasks: [], bedHistory: [{ bedNumber: '201', startDate: today, days: 1 }], alerts: []
            },
            {
                id: 'pat-2', bedNumber: 'UCI 1', name: 'Quispe Mamani, Jorge', documentType: 'DNI', dni: '10203040', age: 68, hc: '100201', phone: '988777666', familyPhone: '', insurance: 'PACIFICO', admissionSource: 'Emergencia', admissionDate: today,
                doctors: ['Dr. Juan Perez'], diagnoses: ['TEC Grave', 'Politraumatismo'], cie10: ['S06.2', 'T07'],
                surgicalData: { isSurgical: false, preOp: false, risk: false, letterSent: false, letterApproved: false },
                clinicalData: { allergies: '', pathologies: 'Diabetes Mellitus 2', anticoagulation: 'Enoxaparina' },
                images: [], warrantyLetters: [], surgeries: [],
                labResults: [], medicalReports: [], evolutions: [], pendingTasks: [{ id: 'tsk-1', text: 'Control TAC Cerebral 6pm', completed: false, createdAt: Date.now() }], bedHistory: [{ bedNumber: 'UCI 1', startDate: today, days: 0 }], alerts: []
            },
            {
                id: 'pat-3', bedNumber: '301', name: 'Vargas Llosa, Sofia', documentType: 'DNI', dni: '70809010', age: 28, hc: '100202', phone: '911222333', familyPhone: '', insurance: 'PARTICULAR', admissionSource: 'Consulta Externa', admissionDate: today,
                doctors: ['Dra. Ana Gomez'], diagnoses: ['Gestante a Término', 'Cesárea Anterior'], cie10: ['O34.2', 'O82.0'],
                surgicalData: { isSurgical: true, preOp: true, risk: true, letterSent: false, letterApproved: false },
                clinicalData: { allergies: '', pathologies: '', anticoagulation: '' },
                obstetricData: { pregnancyComplications: 'Ninguna', gestationWeeks: '39' },
                images: [], warrantyLetters: [], surgeries: [{ id: 'sx-2', date: today, time: '08:00', procedure: 'Cesárea Electiva', checklist: { preOp: true, risk: true, anesthesia: true, consent: true }, status: 'scheduled' }],
                labResults: [], medicalReports: [], evolutions: [], pendingTasks: [], bedHistory: [{ bedNumber: '301', startDate: today, days: 0 }], alerts: []
            },
            {
                id: 'pat-4', bedNumber: '202', name: 'Diaz Rojas, Lucas', documentType: 'DNI', dni: '90807060', age: 5, ageMonths: 2, hc: '100203', phone: '977888999', familyPhone: '977888000', insurance: 'MAPFRE', admissionSource: 'Emergencia', admissionDate: today,
                doctors: ['Dra. Maria Rodriguez'], diagnoses: ['Neumonía Adquirida en Comunidad'], cie10: ['J18.9'],
                surgicalData: { isSurgical: false, preOp: false, risk: false, letterSent: false, letterApproved: false },
                clinicalData: { allergies: 'AINES', pathologies: 'Asma', anticoagulation: '' },
                images: [], warrantyLetters: [], surgeries: [],
                labResults: [], medicalReports: [], evolutions: [], pendingTasks: [], bedHistory: [{ bedNumber: '202', startDate: today, days: 2 }], alerts: []
            },
            {
                id: 'pat-5', bedNumber: 'UCE A', name: 'Rojas Silva, Ana', documentType: 'DNI', dni: '44556677', age: 75, hc: '100204', phone: '955112233', familyPhone: '', insurance: 'RIMAC', admissionSource: 'Emergencia', admissionDate: today,
                doctors: ['Dr. Carlos Huesos'], diagnoses: ['Fractura de Cadera Derecha', 'Fibrilación Auricular'], cie10: ['S72.0', 'I48'],
                surgicalData: { isSurgical: true, preOp: true, risk: true, letterSent: true, letterApproved: true },
                clinicalData: { allergies: '', pathologies: 'Osteoporosis', anticoagulation: 'Warfarina (Suspendida)' },
                images: [], warrantyLetters: [], surgeries: [{ id: 'sx-3', date: today, time: '10:00', procedure: 'Artroplastia de Cadera', checklist: { preOp: true, risk: true, anesthesia: true, consent: true }, status: 'completed' }],
                labResults: [], medicalReports: [], evolutions: [], pendingTasks: [{id: 'tsk-2', text: 'Transfusión 1 PG', completed: false, createdAt: Date.now()}], bedHistory: [{ bedNumber: 'UCE A', startDate: today, days: 1 }], alerts: []
            }
        ];
        localStorage.setItem('omni_patients', JSON.stringify(currentPatients));
    }
    setPatients(currentPatients);

    // 3. BEDS SEEDING (Expanded Layout)
    const savedBeds = localStorage.getItem('omni_beds');
    if (savedBeds && savedBeds !== '[]') { 
        setBeds(JSON.parse(savedBeds)); 
    } else {
       // Seed default beds if empty (Expanded List)
       const defaultBeds: Bed[] = [
        // Piso 2
        { id: 'b-201', number: '201', floor: 'Piso 2', status: 'occupied', patientId: 'pat-1' },
        { id: 'b-202', number: '202', floor: 'Piso 2', status: 'occupied', patientId: 'pat-4' },
        { id: 'b-203', number: '203', floor: 'Piso 2', status: 'available' },
        { id: 'b-204', number: '204', floor: 'Piso 2', status: 'available' },
        { id: 'b-205', number: '205', floor: 'Piso 2', status: 'available' },
        { id: 'b-206', number: '206', floor: 'Piso 2', status: 'maintenance' },
        
        // Piso 3
        { id: 'b-301', number: '301', floor: 'Piso 3', status: 'occupied', patientId: 'pat-3' },
        { id: 'b-302', number: '302', floor: 'Piso 3', status: 'available' },
        { id: 'b-303', number: '303', floor: 'Piso 3', status: 'available' },
        { id: 'b-304', number: '304', floor: 'Piso 3', status: 'available' },

        // UCI
        { id: 'b-uci1', number: 'UCI 1', floor: 'UCI', status: 'occupied', patientId: 'pat-2' },
        { id: 'b-uci2', number: 'UCI 2', floor: 'UCI', status: 'available' },
        { id: 'b-uci3', number: 'UCI 3', floor: 'UCI', status: 'available' },

        // UCE
        { id: 'b-ucea', number: 'UCE A', floor: 'UCE', status: 'occupied', patientId: 'pat-5' },
        { id: 'b-uceb', number: 'UCE B', floor: 'UCE', status: 'available' },
        { id: 'b-ucec', number: 'UCE C', floor: 'UCE', status: 'available' },

        // DILA
        { id: 'b-dila1', number: 'DILA 1', floor: 'DILA', status: 'available' },
        { id: 'b-dila2', number: 'DILA 2', floor: 'DILA', status: 'available' },
      ];
      setBeds(defaultBeds);
      localStorage.setItem('omni_beds', JSON.stringify(defaultBeds));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('omni_db_update', handleUpdate);
    return () => window.removeEventListener('omni_db_update', handleUpdate);
  }, []);

  const canAdmitPatient = () => {
    if (!effectiveRole) return false;
    const allowedRoles: HospitalRole[] = ['ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO'];
    return allowedRoles.includes(effectiveRole);
  };

  const handleBedClick = (bed: Bed) => {
    if (bed.status === 'available' && canAdmitPatient()) {
      setSelectedBed(bed);
      setShowAdmission(true);
    } else if (bed.status === 'occupied' && bed.patientId) {
       // Open Patient File
       if (onPatientClick) onPatientClick(bed.patientId);
    }
  };

  const handleAdmissionSuccess = (newPatientId: string) => {
    setShowAdmission(false);
    setSelectedBed(null);
    loadData();
    // Redirect to patient file immediately
    if (onPatientClick) onPatientClick(newPatientId);
  };

  const isPatientHighlighted = (patient: Patient): boolean => {
      if (!effectiveRole) return false;
      switch (effectiveRole) {
          case 'RESIDENTES TRAUMATO':
              const traumaDocs = doctorsList.filter(d => (d.specialty || '').toUpperCase().includes('TRAUMATOLOGIA') || (d.specialty || '').toUpperCase().includes('ORTOPEDIA')).map(d => d.name);
              return patient.doctors.some(docName => traumaDocs.includes(docName));
          case 'RESIDENTES PEDIA': return patient.age < 15;
          case 'OBSTETRICIA':
              const obsteDocs = doctorsList.filter(d => (d.specialty || '').toUpperCase().includes('GINECO') || (d.specialty || '').toUpperCase().includes('OBSTETRICIA')).map(d => d.name);
              return patient.doctors.some(docName => obsteDocs.includes(docName));
          case 'CARDIOLOGIA':
              const cardioDocs = doctorsList.filter(d => (d.specialty || '').toUpperCase().includes('CARDIOLOGIA')).map(d => d.name);
              return patient.doctors.some(docName => cardioDocs.includes(docName));
          default: return false;
      }
  };

  const hasSpecificHighlight = ['RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'CARDIOLOGIA'].includes(effectiveRole || '');
  const floors: FloorName[] = ['UCI', 'UCE', 'DILA', 'Piso 2', 'Piso 3'];

  // FILTER LOGIC FOR BEDS
  const isBedVisible = (bed: Bed) => {
      if (effectiveRole === 'ADMINISTRADOR') return true;
      if (effectiveRole === 'ENFERMERIA UCI' || effectiveRole === 'MEDICO UCI') return bed.floor === 'UCI';
      if (effectiveRole === 'ENFERMERIA UCE' || effectiveRole === 'MEDICO UCE') return bed.floor === 'UCE';
      if (effectiveRole === 'ENFERMERIA PISO' || effectiveRole === 'MEDICOS DE PISO') return bed.floor !== 'UCI' && bed.floor !== 'UCE';
      return true; // Default visible for other roles
  };

  const getStatusColor = (status: string, highlighted: boolean) => {
    if (status === 'available') return 'bg-emerald-50 border-emerald-200 hover:border-emerald-400';
    if (status === 'maintenance') return 'bg-slate-100 border-slate-300 opacity-90';
    if (status === 'occupied') {
        if (highlighted) return 'bg-white border-yellow-400 ring-2 ring-yellow-400 shadow-md z-10';
        return 'bg-blue-50 border-blue-200 hover:border-blue-400';
    }
    return 'bg-white';
  };

  const getPatientForBed = (bedId: string) => {
    const bed = beds.find(b => b.id === bedId);
    if (!bed || !bed.patientId) return null;
    return patients.find(p => p.id === bed.patientId && !p.dischargeDate);
  };

  const formatName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.split(',');
    if (parts.length < 2) return fullName;
    const lastName = parts[0].trim().split(' ')[0];
    const firstName = parts[1].trim().split(' ')[0];
    return `${lastName}, ${firstName}`;
  };

  if (loading) return <div className="p-4 text-center text-slate-400 text-[10px]">Cargando...</div>;

  if (beds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 p-6">
        <LayoutGrid size={32} className="mb-2 text-slate-200" />
        <h3 className="text-xs font-bold text-slate-600">Sin configuración</h3>
        <p className="text-[10px] text-center mt-1 max-w-xs">Configura las camas en el menú de ajustes.</p>
      </div>
    );
  }

  const isAdmissionAllowed = canAdmitPatient();

  return (
    <div className="p-2 md:p-4 bg-slate-50 min-h-full space-y-4">
      {showAdmission && selectedBed && (
        <AdmissionForm 
            bedNumber={selectedBed.number} 
            bedId={selectedBed.id} 
            onClose={() => setShowAdmission(false)} 
            onSuccess={handleAdmissionSuccess} 
            sessionUser={sessionUser}
        />
      )}

      {floors.map((floor) => {
        const floorBeds = beds.filter(b => b.floor === floor && isBedVisible(b));
        if (floorBeds.length === 0) return null;

        return (
          <div key={floor} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1.5 pl-1"><div className="w-0.5 h-2.5 bg-primary-600 rounded-full"></div>{floor}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 md:gap-2">
              {floorBeds.map((bed) => {
                const patient = bed.status === 'occupied' ? getPatientForBed(bed.id) : null;
                const highlighted = patient ? isPatientHighlighted(patient) : false;
                const isDimmed = hasSpecificHighlight && bed.status === 'occupied' && !highlighted;

                return (
                  <div key={bed.id} onClick={() => handleBedClick(bed)} className={`relative p-1.5 rounded border transition-all min-h-[60px] flex flex-col justify-between ${getStatusColor(bed.status, highlighted)} ${(bed.status === 'available' && isAdmissionAllowed) || bed.status === 'occupied' ? 'cursor-pointer hover:shadow-md' : 'cursor-default'} ${isDimmed ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`} style={bed.status === 'maintenance' ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #e2e8f0 5px, #e2e8f0 10px)' } : undefined}>
                    <div className="flex justify-between items-start">
                      <span className={`font-mono font-bold text-xs text-slate-700 leading-none ${bed.status === 'maintenance' ? 'line-through decoration-slate-400 decoration-2 text-slate-500' : ''}`}>{bed.number}</span>
                      {bed.status === 'occupied' && <div className={`w-1.5 h-1.5 rounded-full ${highlighted ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>}
                    </div>
                    {bed.status === 'available' && (<div className={`flex items-center justify-center mt-2 ${isAdmissionAllowed ? 'text-emerald-600/50' : 'text-slate-200'}`}>{isAdmissionAllowed ? <UserPlus size={16} /> : <div className="w-4 h-4 rounded-full bg-slate-100"></div>}</div>)}
                    {bed.status === 'occupied' && patient && (<div className="mt-1 overflow-hidden"><div className="text-[9px] font-bold text-slate-800 leading-tight truncate">{formatName(patient.name)}</div><div className="text-[8px] text-slate-500 truncate leading-tight mt-0.5">{patient.diagnoses[0]}</div></div>)}
                    {bed.status === 'occupied' && !patient && (<div className="mt-1 text-[8px] text-red-400">Error Datos</div>)}
                    {bed.status === 'maintenance' && (<div className="flex items-center justify-center mt-1 text-slate-400"><Wrench size={14} /></div>)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
