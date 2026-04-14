
import React, { useState } from 'react';
import { Patient, EvolutionRecord, HospitalRole, AppNotification } from '../../types';
import { MessageCircle, Lock, Unlock, Edit2, Trash2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface EvolutionsTabProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
}

export const EvolutionsTab: React.FC<EvolutionsTabProps> = ({ patient, onUpdate, userRole }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  const isAdmin = userRole === 'ADMINISTRADOR';
  const isNurse = ['ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE'].includes(userRole || '');

  // --- ACTIONS ---
  const handleWhatsApp = (evo: EvolutionRecord) => {
      const vitalsText = `PA:${evo.vitals.pa} FC:${evo.vitals.fc} FR:${evo.vitals.fr} T:${evo.vitals.temp} Sat:${evo.vitals.sat} FiO2:${evo.vitals.fio2}`;
      const text = `*PACIENTE:* ${patient.name}\n*FECHA:* ${evo.date} ${evo.time}\n\n*FUNCIONES VITALES:*\n${vitalsText}\n\n*EVOLUCIÓN:*\n${evo.note}`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handleRequestAction = (evoId: string, type: 'edit' | 'delete') => {
      const updatedEvolutions = patient.evolutions.map(e => {
          if (e.id === evoId) {
              return {
                  ...e,
                  unlockRequest: {
                      type,
                      requestedBy: userRole || 'Unknown',
                      timestamp: Date.now(),
                      status: 'pending' as const
                  }
              };
          }
          return e;
      });
      
      // Notify Admin (Simulated via storage for now, real app would push to DB)
      const notifs: AppNotification[] = JSON.parse(localStorage.getItem('omni_notifications') || '[]');
      notifs.push({
          id: `req-${Date.now()}`,
          toRole: 'ADMINISTRADOR',
          title: `Solicitud: ${type === 'edit' ? 'Editar' : 'Eliminar'} Evolución`,
          message: `${userRole} solicita ${type === 'edit' ? 'editar' : 'eliminar'} una evolución de ${patient.name}.`,
          timestamp: Date.now(),
          read: false,
          relatedPatientId: patient.id
      });
      localStorage.setItem('omni_notifications', JSON.stringify(notifs));
      window.dispatchEvent(new Event('omni_db_update'));

      onUpdate({ ...patient, evolutions: updatedEvolutions });
  };

  const handleAdminResponse = (evoId: string, approved: boolean) => {
      const updatedEvolutions = patient.evolutions.map(e => {
          if (e.id === evoId && e.unlockRequest) {
              return {
                  ...e,
                  unlockRequest: {
                      ...e.unlockRequest,
                      status: approved ? 'approved' as const : 'rejected' as const
                  }
              };
          }
          return e;
      });
      onUpdate({ ...patient, evolutions: updatedEvolutions });
  };

  const startEdit = (evo: EvolutionRecord) => {
      setEditingId(evo.id);
      setEditNote(evo.note);
  };

  const saveEdit = (evoId: string) => {
      const updatedEvolutions = patient.evolutions.map(e => {
          if (e.id === evoId) {
              return {
                  ...e,
                  note: editNote,
                  locked: true, // Re-lock after edit
                  unlockRequest: undefined // Clear request
              };
          }
          return e;
      });
      onUpdate({ ...patient, evolutions: updatedEvolutions });
      setEditingId(null);
  };

  const executeDelete = (evoId: string) => {
      if (!confirm('¿Seguro que desea eliminar esta evolución permanentemente?')) return;
      const updatedEvolutions = patient.evolutions.filter(e => e.id !== evoId);
      onUpdate({ ...patient, evolutions: updatedEvolutions });
  };

  if (patient.evolutions.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Clock size={32} className="mb-2 opacity-50"/>
              <p className="text-xs">No hay evoluciones registradas.</p>
          </div>
      );
  }

  return (
    <div className="space-y-3 pb-10">
       {patient.evolutions.map((evo) => {
           const isLocked = evo.locked;
           const request = evo.unlockRequest;
           const isPending = request?.status === 'pending';
           const isApproved = request?.status === 'approved';
           const canAct = (isAdmin || isApproved) && !isNurse; // Nurses cannot edit/delete
           const isEditing = editingId === evo.id;

           return (
               <div key={evo.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm relative group">
                   {/* HEADER */}
                   <div className="flex justify-between items-start mb-2 border-b border-slate-50 pb-2">
                       <div>
                           <div className="flex items-center gap-2">
                               <span className="text-xs font-bold text-slate-700">{evo.date}</span>
                               <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">{evo.time}</span>
                           </div>
                           <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{evo.author}</span>
                       </div>
                       
                       <div className="flex items-center gap-1">
                           <button onClick={() => handleWhatsApp(evo)} className="text-green-500 hover:text-green-600 bg-green-50 p-1.5 rounded-full transition-colors" title="Enviar por WhatsApp">
                               <MessageCircle size={14} />
                           </button>
                           
                           {/* ACTIONS / LOCK STATE */}
                           {isEditing ? (
                               <button onClick={() => setEditingId(null)} className="text-slate-400 text-[10px]">Cancelar</button>
                           ) : (
                               <>
                                   {isPending ? (
                                       isAdmin ? (
                                           <div className="flex gap-1 bg-blue-50 px-1 py-0.5 rounded">
                                               <button onClick={() => handleAdminResponse(evo.id, true)} className="text-green-600"><CheckCircle size={14}/></button>
                                               <button onClick={() => handleAdminResponse(evo.id, false)} className="text-red-600"><XCircle size={14}/></button>
                                           </div>
                                       ) : (
                                           <div title="Esperando autorización...">
                                              <Clock size={14} className="text-blue-400 animate-pulse" />
                                           </div>
                                       )
                                   ) : (
                                       <>
                                           {canAct ? (
                                               <div className="flex gap-1">
                                                   <button onClick={() => startEdit(evo)} className="text-primary-600 hover:text-primary-800 p-1"><Edit2 size={14}/></button>
                                                   <button onClick={() => executeDelete(evo.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                                               </div>
                                           ) : (
                                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                   {!isNurse && <button onClick={() => handleRequestAction(evo.id, 'edit')} className="text-slate-300 hover:text-yellow-500"><Lock size={14}/></button>}
                                               </div>
                                           )}
                                       </>
                                   )}
                               </>
                           )}
                       </div>
                   </div>

                   {/* VITALS STRIP */}
                   <div className="flex flex-wrap gap-2 mb-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                       {Object.entries(evo.vitals).map(([key, val]) => (
                           val && (
                               <div key={key} className="flex flex-col items-center min-w-[30px]">
                                   <span className="text-[8px] font-bold text-slate-400 uppercase">{key}</span>
                                   <span className="text-[10px] font-bold text-slate-700">{val}</span>
                               </div>
                           )
                       ))}
                   </div>

                   {/* NOTE */}
                   {isEditing ? (
                       <div className="flex flex-col gap-2">
                           <textarea 
                               value={editNote} 
                               onChange={e => setEditNote(e.target.value)} 
                               className="w-full text-xs p-2 bg-white border border-primary-300 rounded focus:ring-1 focus:ring-primary-500 outline-none" 
                               rows={4}
                           />
                           <button onClick={() => saveEdit(evo.id)} className="bg-primary-600 text-white text-[10px] font-bold py-1 px-3 rounded self-end">Guardar Cambios</button>
                       </div>
                   ) : (
                       <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{evo.note}</p>
                   )}
               </div>
           );
       })}
    </div>
  );
};
