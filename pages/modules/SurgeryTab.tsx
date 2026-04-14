
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Patient, Surgery, WarrantyLetter, HospitalRole, WarrantyRequest, WarrantyDocumentData } from '../../types';
import { Calendar, Clock, CheckSquare, Square, Plus, Trash2, FileText, Link as LinkIcon, Edit2, Save, X, AlertTriangle, CheckCircle, Sparkles, Search, ArrowRight, Scissors, Printer, BrainCircuit, RefreshCw } from 'lucide-react';
import { suggestSegusCodes, generateWarrantyReportText, generateWarrantyRequestDocument, lookupDiagnosisInfo } from '../../services/geminiService';
import { TARIFARIO_SEGUS } from '../../data/tarifario';

const timeSlots = Array.from({ length: 24 * 2 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const minutes = (i % 2 === 0 ? '00' : '30');
    return `${hours}:${minutes}`;
});

interface SurgeryTabProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
}

export const SurgeryTab: React.FC<SurgeryTabProps> = ({ patient, onUpdate, userRole }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingSurgeryId, setEditingSurgeryId] = useState<string | null>(null);
  const [newSurgery, setNewSurgery] = useState<Partial<Surgery>>({
    date: new Date().toISOString().split('T')[0], time: '08:00', procedure: '', linkedLetterId: '',
    checklist: { preOp: false, risk: false, anesthesia: false, consent: false }, status: 'scheduled'
  });
  const [tempEditSurgery, setTempEditSurgery] = useState<Surgery | null>(null);

  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [activeLetterForGenerator, setActiveLetterForGenerator] = useState<WarrantyLetter | null>(null);
  const [genData, setGenData] = useState<WarrantyDocumentData>({
      segusCodes: [], medicalReport: '', anesthesiaType: '', hospitalizationDays: '',
      illnessTime: '', auxExams: '', requirements: '', selectedDiagnoses: []
  });
  const [segusSearch, setSegusSearch] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [generatorStep, setGeneratorStep] = useState<'config' | 'preview'>('config');
  const [newDxQuery, setNewDxQuery] = useState('');
  const [isSearchingDx, setIsSearchingDx] = useState(false);
  const reportAutoUpdateTimer = useRef<any>(null);

  const filteredSegusResults = useMemo(() => {
    if (segusSearch.trim().length < 2) return [];
    const search = segusSearch.toLowerCase();
    return TARIFARIO_SEGUS.filter(item => item.code.includes(search) || item.description.toLowerCase().includes(search)).slice(0, 15);
  }, [segusSearch]);

  const isReadOnly = !['ADMINISTRADOR', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO'].includes(userRole || '');

  const handleRefreshReport = async (dataOverride?: Partial<WarrantyDocumentData>) => {
      const currentDx = dataOverride?.selectedDiagnoses || genData.selectedDiagnoses || [];
      const currentProcs = dataOverride?.segusCodes || genData.segusCodes || [];
      if (currentProcs.length === 0 || currentDx.length === 0) return;
      setIsAiLoading(true);
      const report = await generateWarrantyReportText(patient, currentProcs, currentDx);
      setGenData(prev => ({ ...prev, medicalReport: report }));
      setIsAiLoading(false);
  };

  const openGenerator = async (letter: WarrantyLetter) => {
      setActiveLetterForGenerator(letter);
      const savedData = letter.documentData;
      const linkedSurgery = patient.surgeries.find(s => s.linkedLetterId === letter.id);
      const initialDiagnoses = savedData?.selectedDiagnoses?.length ? savedData.selectedDiagnoses : patient.diagnoses.map((d, i) => ({ name: d, code: patient.cie10?.[i] || '' }));
      const initialSegus = savedData?.segusCodes?.length ? savedData.segusCodes : (linkedSurgery ? [{ code: '---', description: linkedSurgery.procedure }] : []);
      const currentGenData = {
          segusCodes: initialSegus, medicalReport: savedData?.medicalReport || '', anesthesiaType: savedData?.anesthesiaType || '',
          hospitalizationDays: savedData?.hospitalizationDays || '', illnessTime: savedData?.illnessTime || '',
          auxExams: savedData?.auxExams || '', requirements: savedData?.requirements || '', selectedDiagnoses: initialDiagnoses
      };
      setGenData(currentGenData);
      setGeneratorStep('config');
      setShowGeneratorModal(true);
      if (!savedData?.medicalReport && (initialSegus.length > 0 || linkedSurgery)) {
          setIsAiLoading(true);
          const codes = initialSegus.length > 0 ? initialSegus : await suggestSegusCodes(linkedSurgery?.procedure || "");
          const report = await generateWarrantyReportText(patient, codes, initialDiagnoses);
          setGenData(prev => ({ ...prev, segusCodes: codes, medicalReport: report }));
          setIsAiLoading(false);
      }
  };

  const handleAddDxByQuery = async () => {
      if (!newDxQuery.trim()) return;
      setIsSearchingDx(true);
      const result = await lookupDiagnosisInfo(newDxQuery, /^[a-zA-Z][0-9][0-9]/.test(newDxQuery) ? 'code' : 'text');
      if (result?.code && result?.name) {
          const updatedDx = [...(genData.selectedDiagnoses || []), { name: result.name, code: result.code }];
          setGenData(prev => ({ ...prev, selectedDiagnoses: updatedDx }));
          handleRefreshReport({ selectedDiagnoses: updatedDx });
          setNewDxQuery('');
      }
      setIsSearchingDx(false);
  };

  const handleEditDiagnosis = (index: number, field: 'name' | 'code', value: string) => {
      const updatedDx = [...(genData.selectedDiagnoses || [])];
      updatedDx[index] = { ...updatedDx[index], [field]: value };
      setGenData(prev => ({ ...prev, selectedDiagnoses: updatedDx }));
      if (field === 'name') {
          if (reportAutoUpdateTimer.current) clearTimeout(reportAutoUpdateTimer.current);
          reportAutoUpdateTimer.current = setTimeout(() => handleRefreshReport({ selectedDiagnoses: updatedDx }), 2000);
      }
  };

  const handleSelectSegus = (item: { code: string, description: string }) => {
      if (genData.segusCodes.some(c => c.code === item.code)) return;
      const updatedProcs = [...genData.segusCodes, { code: item.code, description: item.description }];
      setGenData(prev => ({ ...prev, segusCodes: updatedProcs }));
      setSegusSearch('');
      handleRefreshReport({ segusCodes: updatedProcs });
  };

  const handleEditProcedure = (index: number, value: string) => {
      const updated = [...genData.segusCodes];
      updated[index].description = value;
      setGenData(prev => ({ ...prev, segusCodes: updated }));
      if (reportAutoUpdateTimer.current) clearTimeout(reportAutoUpdateTimer.current);
      reportAutoUpdateTimer.current = setTimeout(() => handleRefreshReport({ segusCodes: updated }), 2000);
  };

  const handleRemoveSegus = (code: string) => {
      const updated = genData.segusCodes.filter(c => c.code !== code);
      setGenData(prev => ({ ...prev, segusCodes: updated }));
      handleRefreshReport({ segusCodes: updated });
  };

  const handleLetterAction = (id: string, action: 'send' | 'approve') => {
      const updatedLetters = patient.warrantyLetters.map(l => {
          if (l.id === id) {
              const today = new Date().toISOString().split('T')[0];
              return action === 'send' ? { ...l, status: 'sent' as const, receptionDate: today } : { ...l, status: 'approved' as const, responseDate: today };
          }
          return l;
      });
      onUpdate({ ...patient, warrantyLetters: updatedLetters });
  };

  const handleToggleSurgeryStatus = (surgeryId: string) => {
      if (isReadOnly) return;
      const surgery = patient.surgeries.find(s => s.id === surgeryId);
      if (!surgery) return;

      const newStatus = surgery.status === 'completed' ? 'scheduled' : 'completed';
      
      let updatedPendingTasks = [...patient.pendingTasks];
      
      // AUTO-COMPLETE NPO TASK if status becomes completed
      if (newStatus === 'completed') {
          updatedPendingTasks = updatedPendingTasks.map(t => {
              // Match NPO tasks related to this procedure name
              if (t.text.includes('NPO') && t.text.toLowerCase().includes(surgery.procedure.toLowerCase()) && !t.completed) {
                  return { ...t, completed: true, completedAt: Date.now() };
              }
              return t;
          });
      }

      const updatedSurgeries = patient.surgeries.map(s => 
          s.id === surgeryId ? { ...s, status: newStatus } : s
      );

      onUpdate({ 
          ...patient, 
          surgeries: updatedSurgeries,
          pendingTasks: updatedPendingTasks
      });
  };

  return (
    <div className="flex flex-col gap-2 pb-10">
      {showGeneratorModal && activeLetterForGenerator && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 overflow-y-auto">
              <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[98vh] overflow-hidden">
                  <div className="bg-primary-600 px-3 py-1.5 flex justify-between items-center text-white shrink-0">
                      <div className="flex items-center gap-2"><FileText size={16}/><h3 className="text-[10px] font-bold uppercase tracking-widest">Solicitud de Carta #{activeLetterForGenerator.number}</h3></div>
                      <button onClick={() => setShowGeneratorModal(false)}><X size={18}/></button>
                  </div>

                  {generatorStep === 'config' ? (
                      <div className="flex-1 overflow-y-auto p-2 bg-slate-50 space-y-2">
                           <div className="bg-indigo-50 border border-indigo-100 p-1.5 rounded-lg flex justify-between items-center">
                               <div className="flex items-center gap-2"><BrainCircuit size={14} className="text-indigo-600"/><div><h4 className="text-[9px] font-bold text-indigo-800 uppercase leading-none">IA Clínica</h4></div></div>
                               <button onClick={() => handleRefreshReport()} className="bg-white text-indigo-600 px-2 py-0.5 rounded border border-indigo-200 text-[9px] font-bold flex items-center gap-1" disabled={isAiLoading}>
                                   {isAiLoading ? <RefreshCw size={10} className="animate-spin"/> : <Sparkles size={10}/>} Autoredactar Informe
                               </button>
                           </div>

                           <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                               <div className="lg:col-span-5 space-y-2">
                                   <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                       <div className="flex justify-between items-center mb-1 border-b pb-1">
                                           <label className="text-[8px] font-bold text-slate-400 uppercase">Diagnósticos</label>
                                           <div className="flex gap-1">
                                               <input type="text" value={newDxQuery} onChange={e => setNewDxQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddDxByQuery()} placeholder="Nombre o CIE-10..." className="text-[9px] border rounded px-1.5 py-0.5 outline-none w-24 bg-slate-50" />
                                               <button onClick={handleAddDxByQuery} className="bg-slate-800 text-white p-0.5 rounded"><Plus size={10}/></button>
                                           </div>
                                       </div>
                                       <div className="space-y-1 max-h-32 overflow-y-auto">
                                           {genData.selectedDiagnoses?.map((dx, i) => (
                                               <div key={i} className="flex gap-1 items-center bg-slate-50 p-1 rounded-md border border-slate-100">
                                                   <input value={dx.name} onChange={e => handleEditDiagnosis(i, 'name', e.target.value)} className="flex-1 text-[9px] font-medium bg-transparent border-none focus:ring-0 outline-none h-5" />
                                                   <input value={dx.code} onChange={e => handleEditDiagnosis(i, 'code', e.target.value)} className="w-10 text-[9px] font-bold bg-white border rounded text-center h-5" />
                                                   <button onClick={() => setGenData(prev => ({ ...prev, selectedDiagnoses: prev.selectedDiagnoses?.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-500"><Trash2 size={10}/></button>
                                               </div>
                                           ))}
                                       </div>
                                   </div>

                                   <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                       <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1 border-b pb-1">Procedimientos vinculados a SEGUS</label>
                                       <div className="space-y-1 mb-2 max-h-40 overflow-y-auto pr-1">
                                            {genData.segusCodes.map((item, idx) => (
                                                <div key={idx} className="flex gap-1 items-center bg-blue-50/50 border border-blue-100 rounded px-1.5 py-0.5 group">
                                                    <span className="text-[9px] font-black text-blue-700 min-w-[50px]">{item.code}</span>
                                                    <input 
                                                        value={item.description}
                                                        onChange={(e) => handleEditProcedure(idx, e.target.value)}
                                                        className="flex-1 text-[9px] bg-transparent border-none focus:ring-0 outline-none h-6 font-medium text-slate-800"
                                                        placeholder="Procedimiento..."
                                                    />
                                                    <button onClick={() => handleRemoveSegus(item.code)} className="text-slate-300 hover:text-red-500"><Trash2 size={10}/></button>
                                                </div>
                                            ))}
                                            {genData.segusCodes.length === 0 && <div className="text-center py-4 text-[9px] text-slate-300 italic">Busque un código abajo...</div>}
                                       </div>
                                       <div className="relative">
                                           <input type="text" value={segusSearch} onChange={e => setSegusSearch(e.target.value)} className="w-full text-[9px] border rounded pl-6 pr-2 py-1 outline-none bg-white" placeholder="N° o Nombre de SEGUS..." />
                                           <Search size={10} className="absolute left-2 top-1.5 text-slate-400"/>
                                           {filteredSegusResults.length > 0 && (
                                               <div className="absolute bottom-full left-0 right-0 z-50 mb-1 bg-white border rounded shadow-xl max-h-40 overflow-y-auto">
                                                   {filteredSegusResults.map(item => (
                                                       <div key={item.code} onClick={() => handleSelectSegus(item)} className="p-1.5 hover:bg-primary-50 cursor-pointer text-[9px] border-b flex justify-between"><span className="font-bold text-slate-700">{item.code}</span><span className="text-slate-500 truncate ml-2">{item.description}</span></div>
                                                   ))}
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               </div>

                               <div className="lg:col-span-7 flex flex-col gap-2">
                                   <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex-1 min-h-[180px] flex flex-col">
                                       <label className="text-[8px] font-bold text-slate-400 uppercase border-b pb-1 mb-1">Informe / Justificación</label>
                                       <textarea value={genData.medicalReport} onChange={e => setGenData({...genData, medicalReport: e.target.value})} className="flex-1 w-full text-[10px] border-none rounded p-1 focus:ring-0 outline-none resize-none bg-white text-slate-900 leading-relaxed font-serif" />
                                   </div>
                                   <div className="grid grid-cols-4 gap-1.5">
                                       {['anesthesiaType', 'hospitalizationDays', 'illnessTime', 'auxExams'].map(k => (
                                           <div key={k} className="bg-white p-1 rounded border"><label className="text-[7px] font-bold text-slate-400 uppercase block leading-none mb-0.5">{k.replace(/([A-Z])/g, ' $1')}</label><input type="text" value={(genData as any)[k]} onChange={e => setGenData({...genData, [k]: e.target.value})} className="w-full text-[9px] border-none p-0 bg-transparent font-bold outline-none" /></div>
                                       ))}
                                       <div className="col-span-4 bg-white p-1 rounded border"><label className="text-[7px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Requerimientos / Materiales Especiales</label><input type="text" value={genData.requirements} onChange={e => setGenData({...genData, requirements: e.target.value})} className="w-full text-[9px] border-none p-0 bg-transparent font-bold outline-none" /></div>
                                   </div>
                               </div>
                           </div>
                      </div>
                  ) : (
                      <div className="flex-1 overflow-auto bg-slate-400 p-4 flex justify-center items-start">
                          <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-12 origin-top scale-[0.7] md:scale-100 rounded-sm" dangerouslySetInnerHTML={{ __html: generateWarrantyRequestDocument(patient, genData, patient.doctors[0] || 'Médico Staff') }}></div>
                      </div>
                  )}

                  <div className="p-2 bg-slate-100 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                      {generatorStep === 'config' ? (
                          <button onClick={() => setGeneratorStep('preview')} className="px-6 py-2 bg-primary-600 text-white text-[10px] font-bold rounded-lg shadow-lg uppercase">Previsualizar Documento <ArrowRight size={14} className="inline ml-1"/></button>
                      ) : (
                          <>
                              <button onClick={() => setGeneratorStep('config')} className="px-4 py-2 text-[10px] font-bold text-slate-600 hover:bg-white border rounded-lg">Edición</button>
                              <button onClick={() => { const win = window.open('', '_blank'); win?.document.write(generateWarrantyRequestDocument(patient, genData, patient.doctors[0] || 'Médico Staff')); win?.document.close(); win?.print(); }} className="px-4 py-2 bg-slate-800 text-white text-[10px] font-bold rounded-lg"><Printer size={12} className="inline mr-1"/> Imprimir</button>
                              <button onClick={() => { onUpdate({ ...patient, warrantyLetters: patient.warrantyLetters.map(l => l.id === activeLetterForGenerator.id ? { ...l, documentData: genData } : l) }); setShowGeneratorModal(false); }} className="px-6 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-lg shadow-lg">Guardar Todo</button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-2 py-1 flex justify-between items-center border-b">
              <h3 className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><FileText size={12}/> Cartas de Garantía</h3>
              <span className="text-[8px] bg-white border px-1 rounded text-slate-400 font-mono">{patient.warrantyLetters.length}/15</span>
          </div>
          <div className="p-1 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {patient.warrantyLetters.map(letter => (
                  <div key={letter.id} className={`rounded p-1.5 border flex flex-col gap-1 transition-all ${letter.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : (letter.status === 'sent' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200')}`}>
                      <div className="flex justify-between items-center"><span className="text-[8px] font-bold text-slate-400">#0{letter.number}</span><div className={`w-1.5 h-1.5 rounded-full ${letter.status === 'approved' ? 'bg-emerald-500' : (letter.status === 'sent' ? 'bg-blue-500' : 'bg-slate-300')}`}></div></div>
                      <button onClick={() => openGenerator(letter)} className="w-full text-[8px] font-bold bg-white text-primary-600 border border-primary-100 py-0.5 rounded shadow-sm">Formulario</button>
                      {letter.status === 'pending' && <button onClick={() => handleLetterAction(letter.id, 'send')} className="w-full text-[8px] font-bold bg-primary-600 text-white py-0.5 rounded">Tramitar</button>}
                      {letter.status === 'sent' && <button onClick={() => handleLetterAction(letter.id, 'approve')} className="w-full text-[8px] font-bold bg-emerald-600 text-white py-0.5 rounded">Aprobar</button>}
                  </div>
              ))}
              {patient.warrantyLetters.length === 0 && <div className="col-span-full py-2 text-center text-[8px] text-slate-300 italic">Sin solicitudes.</div>}
          </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="bg-slate-50 px-2 py-1 border-b flex justify-between items-center">
              <h3 className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Scissors size={12}/> Programación Quirúrgica</h3>
              {!isAdding && !isReadOnly && <button onClick={() => setIsAdding(true)} className="bg-primary-600 text-white px-2 py-0.5 rounded text-[8px] font-bold">+ Programar</button>}
          </div>

          <div className="p-2">
              {(isAdding || editingSurgeryId) && (
                  <div className="bg-slate-50 border border-primary-100 p-2 rounded-lg mb-2 animate-in slide-in-from-top-1">
                      <div className="grid grid-cols-12 gap-1.5 items-end">
                          <div className="col-span-4"><input type="date" value={isAdding ? newSurgery.date : tempEditSurgery?.date} onChange={e => isAdding ? setNewSurgery({...newSurgery, date: e.target.value}) : setTempEditSurgery({...tempEditSurgery!, date: e.target.value})} className="w-full h-6 text-[10px] border rounded px-1" /></div>
                          <div className="col-span-3"><select value={isAdding ? newSurgery.time : tempEditSurgery?.time} onChange={e => isAdding ? setNewSurgery({...newSurgery, time: e.target.value}) : setTempEditSurgery({...tempEditSurgery!, time: e.target.value})} className="w-full h-6 text-[10px] border rounded px-1">{timeSlots.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                          <div className="col-span-5"><input type="text" value={isAdding ? newSurgery.procedure : tempEditSurgery?.procedure} onChange={e => isAdding ? setNewSurgery({...newSurgery, procedure: e.target.value}) : setTempEditSurgery({...tempEditSurgery!, procedure: e.target.value})} placeholder="Procedimiento..." className="w-full h-6 text-[10px] border rounded px-2" /></div>
                          <div className="col-span-12 flex justify-end gap-1.5 pt-1">
                              <button onClick={() => { setIsAdding(false); setEditingSurgeryId(null); }} className="text-[9px] font-bold text-slate-400">X</button>
                              <button onClick={() => { if(isAdding) { if(!newSurgery.procedure) return; onUpdate({...patient, surgeries: [...patient.surgeries, {id: Date.now().toString(), ...newSurgery} as Surgery]}); setIsAdding(false); } else if(tempEditSurgery) { onUpdate({...patient, surgeries: patient.surgeries.map(s => s.id === tempEditSurgery.id ? tempEditSurgery : s)}); setEditingSurgeryId(null); } }} className="bg-primary-600 text-white px-4 h-6 rounded text-[9px] font-bold shadow-sm">Guardar</button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="space-y-1.5">
                  {patient.surgeries.map(s => (
                      <div key={s.id} className="flex items-center gap-2 bg-white border border-slate-100 p-1.5 rounded-lg hover:border-primary-200 transition-all">
                          {/* Surgery Status Toggle Button */}
                          <button 
                              onClick={() => handleToggleSurgeryStatus(s.id)}
                              disabled={isReadOnly}
                              className={`w-6 h-6 flex items-center justify-center rounded-full border transition-all ${s.status === 'completed' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-400'}`}
                              title={s.status === 'completed' ? 'Realizada (Click para revertir)' : 'Pendiente (Click para completar)'}
                          >
                              {s.status === 'completed' ? <CheckCircle size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current"></div>}
                          </button>
                          
                          <div className="min-w-0 flex-1">
                              <h4 className={`text-[10px] font-black uppercase truncate leading-none mb-0.5 ${s.status === 'completed' ? 'text-emerald-700 decoration-emerald-300 line-through decoration-2' : 'text-slate-700'}`}>{s.procedure}</h4>
                              <div className="flex gap-2 text-[8px] text-slate-400 font-mono"><span>{s.date}</span><span>{s.time}</span></div>
                          </div>
                          {!isReadOnly && <div className="flex gap-1"><button onClick={() => { setEditingSurgeryId(s.id); setTempEditSurgery({...s}); }} className="text-slate-300 hover:text-primary-600"><Edit2 size={12}/></button><button onClick={() => { if(confirm('¿Eliminar?')) onUpdate({...patient, surgeries: patient.surgeries.filter(sx => sx.id !== s.id)}); }} className="text-slate-300 hover:text-red-600"><Trash2 size={12}/></button></div>}
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};
