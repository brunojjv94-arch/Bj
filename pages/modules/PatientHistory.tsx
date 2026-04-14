
import React, { useEffect, useState } from 'react';
import { Patient, Surgery } from '../../types';
import { Archive, Lock, Search, Calendar, Clock, FileText, User, ArrowLeft, Stethoscope, Activity, Scissors, AlertTriangle } from 'lucide-react';

export const PatientHistory: React.FC = () => {
  const [history, setHistory] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const allPatientsStr = localStorage.getItem('omni_patients');
    if (allPatientsStr) {
      const allPatients: Patient[] = JSON.parse(allPatientsStr);
      // Filter discharged patients and sort by discharge date (newest first)
      const discharged = allPatients
        .filter(p => p.dischargeDate)
        .sort((a, b) => new Date(b.dischargeDate!).getTime() - new Date(a.dischargeDate!).getTime());
      setHistory(discharged);
    }
  }, []);

  const filteredHistory = history.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.dni.includes(searchTerm)
  );

  const calculateStayDuration = (start: string, end?: string) => {
      if (!end) return '-';
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diff = Math.abs(d2.getTime() - d1.getTime());
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days;
  };

  const formatDate = (isoStr?: string) => {
      if (!isoStr) return '-';
      const [y, m, d] = isoStr.split('-');
      return `${d}/${m}/${y}`;
  };

  // --- VISTA DETALLADA (RESUMEN DE ATENCIÓN) ---
  if (selectedPatient) {
      const daysStay = calculateStayDuration(selectedPatient.admissionDate, selectedPatient.dischargeDate);
      const completedSurgeries = selectedPatient.surgeries.filter(s => s.status === 'completed' || s.status === 'scheduled'); // Include scheduled if they weren't cancelled explicitly before discharge logic cleanup

      return (
          <div className="flex flex-col h-full bg-slate-100 p-2 md:p-4 overflow-hidden">
              {/* HEADER DE NAVEGACION */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm mb-3 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                          <ArrowLeft size={20} />
                      </button>
                      <div>
                          <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                              <Archive size={16} className="text-slate-400"/> Resumen de Atención
                          </h2>
                          <p className="text-[10px] text-slate-500">Expediente Histórico Cerrado</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-3 py-1 rounded-full flex items-center gap-1">
                          <Lock size={12}/> ALTA MÉDICA
                      </span>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  
                  {/* TARJETA 1: IDENTIFICACIÓN Y TIEMPOS */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
                          <div>
                              <h1 className="text-xl font-bold text-slate-900">{selectedPatient.name}</h1>
                              <div className="flex gap-4 mt-1 text-xs text-slate-500">
                                  <span className="font-mono bg-slate-100 px-1.5 rounded">{selectedPatient.documentType}: {selectedPatient.dni}</span>
                                  <span>Edad: <strong>{selectedPatient.age} años</strong></span>
                                  <span>HC: <strong>{selectedPatient.hc}</strong></span>
                                  <span>Seguro: <strong className="text-blue-600">{selectedPatient.insurance}</strong></span>
                              </div>
                          </div>
                          <div className="flex gap-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <div className="text-center">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Ingreso</p>
                                  <p className="text-xs font-bold text-slate-700">{formatDate(selectedPatient.admissionDate)}</p>
                              </div>
                              <div className="w-px bg-slate-200"></div>
                              <div className="text-center">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Alta</p>
                                  <p className="text-xs font-bold text-slate-700">{formatDate(selectedPatient.dischargeDate)}</p>
                              </div>
                              <div className="w-px bg-slate-200"></div>
                              <div className="text-center">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Estancia</p>
                                  <p className="text-xs font-bold text-purple-600">{daysStay} Días</p>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* DIAGNOSTICOS */}
                          <div>
                              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Activity size={14}/> Evolución Diagnóstica</h3>
                              <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 space-y-3">
                                  <div>
                                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5">Diagnóstico de Ingreso</p>
                                      <p className="text-xs font-medium text-slate-700">{selectedPatient.admissionDiagnosis || selectedPatient.diagnoses[0] || 'No registrado'}</p>
                                  </div>
                                  <div className="border-t border-blue-200/50"></div>
                                  <div>
                                      <p className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Diagnóstico de Alta (Definitivo)</p>
                                      <p className="text-sm font-bold text-slate-800">{selectedPatient.dischargeDiagnosis || selectedPatient.diagnoses[0]}</p>
                                      {selectedPatient.diagnoses.length > 1 && (
                                          <ul className="mt-1 list-disc list-inside text-[10px] text-slate-500">
                                              {selectedPatient.diagnoses.slice(1).map((d, i) => <li key={i}>{d}</li>)}
                                          </ul>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* EQUIPO MEDICO */}
                          <div>
                              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><User size={14}/> Responsables</h3>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-slate-500">Médico Tratante:</span>
                                      <span className="text-xs font-bold text-slate-700">{selectedPatient.doctors.join(', ') || 'No asignado'}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-slate-500">Admitido por:</span>
                                      <span className="text-xs font-mono text-slate-600 bg-white px-1 rounded border">{selectedPatient.admittingActor || '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-slate-500">Dado de alta por:</span>
                                      <span className="text-xs font-mono text-slate-600 bg-white px-1 rounded border">{selectedPatient.dischargingActor || '-'}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* TARJETA 2: RESUMEN CLÍNICO Y PROCEDIMIENTOS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* CIRUGIAS */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                          <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Scissors size={14}/> Procedimientos / Cirugías</h3>
                          {completedSurgeries.length > 0 ? (
                              <div className="space-y-2">
                                  {completedSurgeries.map((s, idx) => (
                                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded p-2">
                                          <p className="text-xs font-bold text-slate-800">{s.procedure}</p>
                                          <p className="text-[10px] text-slate-500 flex justify-between mt-1">
                                              <span>{formatDate(s.date)}</span>
                                              <span>{s.time}</span>
                                          </p>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 rounded">Sin procedimientos quirúrgicos.</div>
                          )}
                      </div>

                      {/* RESUMEN EPICRISIS / IA */}
                      <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                          <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><FileText size={14}/> Resumen Clínico / Última Evolución</h3>
                          <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 h-full max-h-60 overflow-y-auto">
                              {selectedPatient.clinicalSummary ? (
                                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedPatient.clinicalSummary}</p>
                              ) : (
                                  selectedPatient.evolutions && selectedPatient.evolutions.length > 0 ? (
                                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                          <span className="font-bold text-slate-500 block mb-1">Última nota ({formatDate(selectedPatient.evolutions[0].date)}):</span>
                                          {selectedPatient.evolutions[0].note}
                                      </p>
                                  ) : (
                                      <p className="text-xs text-slate-400 italic">No hay resumen clínico disponible.</p>
                                  )
                              )}
                          </div>
                      </div>
                  </div>

                  {/* OBSTETRIC DATA (Condicional) */}
                  {selectedPatient.obstetricData && Object.keys(selectedPatient.obstetricData).length > 0 && (
                      <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 shadow-sm">
                          <h3 className="text-xs font-bold text-pink-600 uppercase mb-2">Datos Obstétricos / Parto</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              <div className="bg-white p-2 rounded border border-pink-100">
                                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Procedimiento</span>
                                  <span className="font-bold text-slate-700">{selectedPatient.obstetricData.procedureType || '-'}</span>
                              </div>
                              <div className="bg-white p-2 rounded border border-pink-100">
                                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Recién Nacido</span>
                                  <span className="font-bold text-slate-700">Sexo: {selectedPatient.obstetricData.rnSex || '-'} / Peso: {selectedPatient.obstetricData.rnWeight || '-'}</span>
                              </div>
                              <div className="bg-white p-2 rounded border border-pink-100">
                                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Complicaciones</span>
                                  <span className="font-bold text-slate-700">{selectedPatient.obstetricData.pregnancyComplications || 'Ninguna'}</span>
                              </div>
                          </div>
                      </div>
                  )}

              </div>
          </div>
      );
  }

  // --- VISTA DE LISTA (MAESTRO) ---
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
        <Archive size={48} className="mb-3 text-slate-200" />
        <p className="text-sm font-medium">El archivo histórico está vacío.</p>
        <p className="text-xs mt-1">Los pacientes dados de alta aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 bg-slate-50 min-h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Archive className="text-slate-500"/> Historial de Altas Médicas</h1>
        <div className="relative">
            <input 
            type="text" 
            placeholder="Buscar en el archivo histórico..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
            />
            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 auto-rows-max">
        {filteredHistory.map((patient) => (
          <div 
            key={patient.id} 
            onClick={() => setSelectedPatient(patient)}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            {/* Status Stripe */}
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-300 group-hover:bg-primary-500 transition-colors"></div>
            
            <div className="pl-2">
                <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-slate-800 text-sm group-hover:text-primary-700 transition-colors">{patient.name}</h3>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono mt-1">
                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{patient.dni}</span>
                        <span>•</span>
                        <span>{patient.insurance}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Alta</span>
                    <span className="text-xs font-bold text-slate-700">{formatDate(patient.dischargeDate)}</span>
                </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <p className="flex items-start gap-1">
                        <Activity size={12} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{patient.dischargeDiagnosis || patient.diagnoses[0]}</span>
                    </p>
                    <p className="flex items-start gap-1">
                        <Stethoscope size={12} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{patient.doctors.join(', ') || 'Sin médico asignado'}</span>
                    </p>
                </div>
            </div>
          </div>
        ))}
      </div>
      
      {filteredHistory.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
              No se encontraron resultados para "{searchTerm}"
          </div>
      )}
    </div>
  );
};
