
import React, { useEffect, useState } from 'react';
import { Patient, HospitalRole, Bed, Doctor, PendingTask, Insurance } from '../../types';
import { UserPlus, AlertTriangle, Stethoscope, Clock, ClipboardList, Activity, Scissors, AlertCircle, Thermometer, X, CheckCircle, Droplets, Wind, HeartPulse } from 'lucide-react';

interface ActivePatientsProps {
  filterByDoctor?: string;
  viewRole?: HospitalRole;
  onPatientClick?: (patientId: string) => void;
}

type ModalType = 'pendings' | 'vitals' | 'surgery' | 'alerts' | null;

interface QuickModalState {
    type: ModalType;
    patient: Patient | null;
}

export const ActivePatients: React.FC<ActivePatientsProps> = ({ filterByDoctor, viewRole, onPatientClick }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]); // Store doctors to lookup specialty
  const [insurances, setInsurances] = useState<Insurance[]>([]); // Store insurances to lookup type
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<QuickModalState>({ type: null, patient: null });
  
  const loadPatients = () => {
      try {
          const allPatientsStr = localStorage.getItem('omni_patients');
          const allPatients: Patient[] = allPatientsStr ? JSON.parse(allPatientsStr) : [];
          
          const beds: Bed[] = JSON.parse(localStorage.getItem('omni_beds') || '[]');
          const doctors: Doctor[] = JSON.parse(localStorage.getItem('omni_doctors') || '[]');
          setDoctorsList(doctors);

          // Load Insurances
          const storedInsurances = localStorage.getItem('omni_insurances');
          if (storedInsurances) {
              try {
                  const parsed = JSON.parse(storedInsurances);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                       if (typeof parsed[0] === 'string') {
                           setInsurances(parsed.map((s: string) => ({ name: s, type: s === 'PARTICULAR' ? 'PARTICULAR' : 'EPS' }))); 
                       } else {
                           setInsurances(parsed);
                       }
                  }
              } catch (e) { setInsurances([]); }
          } else {
              setInsurances([{ name: 'RIMAC', type: 'EPS' }, { name: 'PARTICULAR', type: 'PARTICULAR' }]);
          }

          let active = allPatients.filter(p => !p.dischargeDate);

          // 2. Filtro Específico por Rol
          if (viewRole && viewRole !== 'ADMINISTRADOR') {
              switch (viewRole) {
                  case 'MEDICO UCI':
                  case 'ENFERMERIA UCI':
                      active = active.filter(p => { const bed = beds.find(b => b.number === p.bedNumber); return bed?.floor === 'UCI'; }); break;
                  case 'MEDICO UCE':
                  case 'ENFERMERIA UCE':
                      active = active.filter(p => { const bed = beds.find(b => b.number === p.bedNumber); return bed?.floor === 'UCE'; }); break;
                  case 'MEDICOS DE PISO':
                  case 'ENFERMERIA PISO':
                      active = active.filter(p => { const bed = beds.find(b => b.number === p.bedNumber); return !bed || (bed.floor !== 'UCI' && bed.floor !== 'UCE'); }); break;
                  case 'RESIDENTES PEDIA':
                      active = active.filter(p => p.age < 15); break;
                  case 'RESIDENTES TRAUMATO':
                      active = active.filter(p => { const patientDocs = doctors.filter(d => p.doctors.includes(d.name)); return patientDocs.some(d => (d.specialty || '').toUpperCase().includes('TRAUMATOLOGIA') || (d.specialty || '').toUpperCase().includes('ORTOPEDIA')); }); break;
                  case 'OBSTETRICIA':
                      const obsKeywords = ['embarazo', 'gesta', 'cesarea', 'parto', 'aborto', 'obito', 'fetal', 'placenta', 'puerperio'];
                      active = active.filter(p => { const hasObsData = p.obstetricData && Object.keys(p.obstetricData).length > 0; const hasObsDx = p.diagnoses.some(dx => obsKeywords.some(k => dx.toLowerCase().includes(k))); return hasObsData || hasObsDx; }); break;
              }
          }

          if (filterByDoctor) {
            const search = filterByDoctor.toLowerCase();
            active = active.filter(p => p.doctors.some(d => d.toLowerCase().includes(search)));
          }
          
          active.sort((a, b) => a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true }));
          setPatients(active);
      } catch (error) {
          console.error("Error loading patients:", error);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    loadPatients();
    window.addEventListener('omni_db_update', loadPatients);
    return () => window.removeEventListener('omni_db_update', loadPatients);
  }, [filterByDoctor, viewRole]);

  const closeModal = () => setModalState({ type: null, patient: null });

  const calculatePO = (dateStr: string) => {
      const surgeryDate = new Date(dateStr);
      const today = new Date();
      surgeryDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      const diffTime = Math.abs(today.getTime() - surgeryDate.getTime());
      return Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const getDocSpecialty = (docName: string) => {
      if (!docName) return '';
      const doc = doctorsList.find(d => d.name === docName);
      return doc?.specialty || 'General';
  };

  const getInsuranceDisplay = (name: string) => {
      const ins = insurances.find(i => i.name === name);
      if (ins) return `${name} (${ins.type})`;
      return name;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4 shadow-inner"><UserPlus size={48} className="text-slate-200" /></div>
        <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Sin Pacientes Activos</h3>
        <p className="text-[10px] mt-1 text-slate-400">No hay pacientes asignados a tu vista ({viewRole || 'General'}).</p>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 bg-slate-50 min-h-full pb-20 relative">
      
      {/* --- QUICK ACTION MODAL --- */}
      {modalState.type && modalState.patient && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={closeModal}>
              <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
                      <div>
                          <h3 className="text-xs font-black text-slate-800 uppercase">{modalState.patient.name}</h3>
                          <p className="text-[10px] text-slate-500 font-bold">{modalState.type === 'pendings' ? 'PENDIENTES ACTIVOS' : modalState.type === 'vitals' ? 'FUNCIONES VITALES' : modalState.type === 'surgery' ? 'ESTADO QUIRÚRGICO' : 'ALERTAS CLÍNICAS'}</p>
                      </div>
                      <button onClick={closeModal} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={16}/></button>
                  </div>
                  
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                      {/* PENDINGS CONTENT */}
                      {modalState.type === 'pendings' && (
                          <div className="space-y-2">
                              {(modalState.patient.pendingTasks || []).filter(t => !t.completed).length === 0 ? (
                                  <div className="text-center py-4 text-slate-400 text-xs italic">¡Todo al día! No hay pendientes.</div>
                              ) : (
                                  (modalState.patient.pendingTasks || []).filter(t => !t.completed).map((task, i) => (
                                      <div key={i} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-slate-700">
                                          <AlertCircle size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                                          <div>
                                              <span className="font-bold block">{task.text}</span>
                                              {task.dueTime && <span className="text-[9px] text-yellow-600 font-mono block mt-0.5">Hora límite: {task.dueTime}</span>}
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      )}

                      {/* VITALS CONTENT */}
                      {modalState.type === 'vitals' && (
                          <div className="space-y-3">
                              {modalState.patient.evolutions && modalState.patient.evolutions.length > 0 ? (
                                  <>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div className="bg-blue-50 p-2 rounded border border-blue-100 flex flex-col items-center">
                                              <span className="text-[9px] text-blue-400 font-bold uppercase">P. Arterial</span>
                                              <span className="text-lg font-black text-blue-700">{modalState.patient.evolutions[0].vitals.pa || '--/--'}</span>
                                          </div>
                                          <div className="bg-purple-50 p-2 rounded border border-purple-100 flex flex-col items-center">
                                              <span className="text-[9px] text-purple-400 font-bold uppercase">Sat O2</span>
                                              <span className="text-lg font-black text-purple-700">{modalState.patient.evolutions[0].vitals.sat || '--'}%</span>
                                          </div>
                                          <div className="bg-red-50 p-2 rounded border border-red-100 flex flex-col items-center">
                                              <span className="text-[9px] text-red-400 font-bold uppercase">F. Cardíaca</span>
                                              <span className="text-lg font-black text-red-700">{modalState.patient.evolutions[0].vitals.fc || '--'}</span>
                                          </div>
                                          <div className="bg-orange-50 p-2 rounded border border-orange-100 flex flex-col items-center">
                                              <span className="text-[9px] text-orange-400 font-bold uppercase">Temperatura</span>
                                              <span className="text-lg font-black text-orange-700">{modalState.patient.evolutions[0].vitals.temp || '--'}°</span>
                                          </div>
                                      </div>
                                      
                                      {/* Bio Functions if available in last evolution */}
                                      {modalState.patient.evolutions[0].bioFunctions && (
                                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-200 pb-1">Funciones Biológicas</h4>
                                              <div className="space-y-1 text-xs">
                                                  <div className="flex justify-between">
                                                      <span className="text-slate-500 flex items-center gap-1"><Droplets size={10}/> Diuresis:</span>
                                                      <span className="font-bold text-slate-700">{modalState.patient.evolutions[0].bioFunctions.diuresis || 'S/D'}</span>
                                                  </div>
                                                  <div className="flex justify-between">
                                                      <span className="text-slate-500 flex items-center gap-1"><Wind size={10}/> Deposiciones:</span>
                                                      <span className="font-bold text-slate-700">{modalState.patient.evolutions[0].bioFunctions.bowel || 'S/D'}</span>
                                                  </div>
                                                  <div className="flex justify-between">
                                                      <span className="text-slate-500">Tolerancia Oral:</span>
                                                      <span className="font-bold text-slate-700">{modalState.patient.evolutions[0].bioFunctions.tolerance || 'S/D'}</span>
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                      <p className="text-[9px] text-center text-slate-300 mt-2">Registrado: {modalState.patient.evolutions[0].date} {modalState.patient.evolutions[0].time}</p>
                                  </>
                              ) : (
                                  <div className="text-center py-4 text-slate-400 text-xs italic">Sin evoluciones registradas.</div>
                              )}
                          </div>
                      )}

                      {/* SURGERY CONTENT */}
                      {modalState.type === 'surgery' && (
                          <div className="space-y-2">
                              {modalState.patient.surgeries.filter(s => s.status !== 'cancelled').length === 0 ? (
                                  <div className="text-center py-4 text-slate-400 text-xs italic">Sin cirugías programadas o realizadas.</div>
                              ) : (
                                  modalState.patient.surgeries.filter(s => s.status !== 'cancelled').map((s, i) => {
                                      const po = s.status === 'completed' ? calculatePO(s.date) : null;
                                      return (
                                          <div key={i} className="flex flex-col p-2 bg-purple-50 border border-purple-100 rounded text-xs">
                                              <div className="flex justify-between items-start mb-1">
                                                  <span className="font-bold text-purple-900">{s.procedure}</span>
                                                  {s.status === 'completed' 
                                                      ? <span className="bg-purple-200 text-purple-800 text-[9px] font-black px-1.5 py-0.5 rounded">PO: {po}</span>
                                                      : <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded">PENDIENTE</span>
                                                  }
                                              </div>
                                              <div className="flex gap-2 text-[10px] text-purple-600 font-mono">
                                                  <span>{s.date}</span>
                                                  <span>{s.time}</span>
                                              </div>
                                          </div>
                                      );
                                  })
                              )}
                          </div>
                      )}

                      {/* ALERTS CONTENT */}
                      {modalState.type === 'alerts' && (
                          <div className="space-y-3">
                              {modalState.patient.clinicalData.allergies && modalState.patient.clinicalData.allergies !== 'Ninguna' && (
                                  <div className="bg-red-50 p-2 rounded border border-red-200">
                                      <h4 className="text-[10px] font-bold text-red-500 uppercase mb-1">Alergias</h4>
                                      <p className="text-xs font-bold text-red-800">{modalState.patient.clinicalData.allergies}</p>
                                  </div>
                              )}
                              {modalState.patient.clinicalData.pathologies && (
                                  <div className="bg-orange-50 p-2 rounded border border-orange-200">
                                      <h4 className="text-[10px] font-bold text-orange-500 uppercase mb-1">Antecedentes / Patologías</h4>
                                      <p className="text-xs font-medium text-orange-800">{modalState.patient.clinicalData.pathologies}</p>
                                  </div>
                              )}
                              {modalState.patient.clinicalData.anticoagulation && (
                                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                      <h4 className="text-[10px] font-bold text-blue-500 uppercase mb-1">Anticoagulación</h4>
                                      <p className="text-xs font-medium text-blue-800">{modalState.patient.clinicalData.anticoagulation}</p>
                                  </div>
                              )}
                              {(!modalState.patient.clinicalData.allergies && !modalState.patient.clinicalData.pathologies) && (
                                  <div className="text-center py-4 text-slate-400 text-xs italic">Sin alertas registradas.</div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {patients.map((patient) => {
            // --- DATA EXTRACTION ---
            const lastEvo = patient.evolutions?.[0];
            const vitals = lastEvo?.vitals;
            const activePendings = (patient.pendingTasks || []).filter(t => !t.completed).length;
            const isSurgical = patient.surgicalData.isSurgical;
            const completedSurgeries = patient.surgeries.filter(s => s.status === 'completed');
            const lastSurgery = completedSurgeries.length > 0 ? completedSurgeries[completedSurgeries.length - 1] : null;
            const postOpDay = lastSurgery ? calculatePO(lastSurgery.date) : null;
            
            const hasAllergies = patient.clinicalData.allergies && patient.clinicalData.allergies.trim() !== '' && patient.clinicalData.allergies !== 'Ninguna';
            const hasPathologies = patient.clinicalData.pathologies && patient.clinicalData.pathologies.trim() !== '';
            
            // Doctor & Specialty
            const primaryDoc = patient.doctors[0] || 'Guardia';
            const specialty = getDocSpecialty(primaryDoc);

            // Status Logic
            let statusBorder = 'border-slate-200';
            if (activePendings > 0) statusBorder = 'border-l-4 border-l-yellow-400 border-slate-200';
            if (hasAllergies) statusBorder = 'border-l-4 border-l-red-500 border-slate-200';

            return (
              <div 
                key={patient.id} 
                onClick={() => onPatientClick && onPatientClick(patient.id)}
                className={`bg-white rounded-xl border ${statusBorder} shadow-sm cursor-pointer transition-all hover:shadow-lg active:scale-[0.99] flex flex-col relative overflow-hidden group min-h-[140px]`}
              >
                {/* 1. COMPACT HEADER */}
                <div className="p-2.5 flex justify-between items-start bg-slate-50/50">
                    <div className="w-full flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-800 text-white text-[10px] font-black px-1.5 py-0.5 rounded font-mono shadow-sm leading-none">
                                {patient.bedNumber}
                            </span>
                            <h3 className="text-sm font-black text-slate-800 leading-none truncate flex-1 group-hover:text-primary-600 transition-colors">
                                {patient.name}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-tight pl-0.5">
                            <span>{patient.age < 2 && patient.ageMonths !== undefined ? `${patient.age}a ${patient.ageMonths}m` : `${patient.age} años`}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{getInsuranceDisplay(patient.insurance)}</span>
                        </div>
                    </div>
                </div>

                {/* 2. BODY */}
                <div className="px-2.5 pb-2 flex-1 flex flex-col justify-center gap-2">
                    <p className="text-xs font-bold text-slate-600 leading-snug line-clamp-1" title={patient.diagnoses[0]}>
                        {patient.diagnoses[0] || <span className="text-slate-300 italic">Sin diagnóstico</span>}
                    </p>
                    
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                        <div className="bg-white p-1 rounded-full text-primary-500 shadow-sm border border-slate-100">
                            <Stethoscope size={10} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-slate-700 leading-none truncate">{primaryDoc}</span>
                            <span className="text-[8px] font-black text-primary-600 uppercase tracking-wider leading-none mt-0.5 truncate">{specialty}</span>
                        </div>
                    </div>
                </div>
                
                {/* 3. INTERACTIVE DASHBOARD FOOTER */}
                <div className="grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100 h-10 bg-white">
                    
                    {/* BUTTON 1: PENDINGS */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setModalState({ type: 'pendings', patient }); }}
                        className={`flex flex-col items-center justify-center hover:bg-slate-50 transition-colors relative ${activePendings > 0 ? 'text-yellow-600' : 'text-slate-300'}`}
                    >
                        <ClipboardList size={14} className={activePendings > 0 ? 'animate-pulse' : ''} />
                        <span className="text-[9px] font-black mt-0.5 leading-none">{activePendings}</span>
                        {activePendings > 0 && <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                    </button>

                    {/* BUTTON 2: VITALS / BIO */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setModalState({ type: 'vitals', patient }); }}
                        className="flex flex-col items-center justify-center hover:bg-blue-50 transition-colors text-slate-600 hover:text-blue-600 group/vitals"
                    >
                        <Activity size={14} className="group-hover/vitals:text-blue-500" />
                        <span className="text-[9px] font-bold mt-0.5 leading-none">
                            {vitals?.pa ? vitals.pa.split('/')[0] : '--'} <span className="text-[7px] opacity-60">mmHg</span>
                        </span>
                    </button>

                    {/* BUTTON 3: SURGERY PO */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setModalState({ type: 'surgery', patient }); }}
                        className={`flex flex-col items-center justify-center hover:bg-purple-50 transition-colors ${isSurgical ? 'text-purple-600' : 'text-slate-300'}`}
                    >
                        <Scissors size={14} />
                        <span className="text-[9px] font-black mt-0.5 leading-none">
                            {postOpDay !== null ? `PO:${postOpDay}` : (isSurgical ? 'PreQx' : '-')}
                        </span>
                    </button>

                    {/* BUTTON 4: ALERTS */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setModalState({ type: 'alerts', patient }); }}
                        className={`flex flex-col items-center justify-center hover:bg-red-50 transition-colors ${hasAllergies || hasPathologies ? 'text-red-500' : 'text-slate-300'}`}
                    >
                        {hasAllergies ? <AlertTriangle size={14} className="animate-pulse" /> : <CheckCircle size={14} />}
                        <span className="text-[8px] font-bold mt-0.5 uppercase tracking-tighter leading-none">
                            {hasAllergies ? 'ALERTA' : 'OK'}
                        </span>
                    </button>

                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};
