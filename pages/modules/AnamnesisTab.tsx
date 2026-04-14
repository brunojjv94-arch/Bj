
import React, { useState, useEffect, useRef } from 'react';
import { Patient, HospitalRole, AnamnesisData } from '../../types';
import { FileText, Lock, Unlock, CheckCircle, XCircle, AlertTriangle, Save, Clock, Mic, Pause, Sparkles, RefreshCw } from 'lucide-react';
import { improveAnamnesisText } from '../../services/geminiService';

interface AnamnesisTabProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  userRole?: HospitalRole;
  onRequestUnlock: () => void; // Trigger notification to admin
}

export const AnamnesisTab: React.FC<AnamnesisTabProps> = ({ patient, onUpdate, userRole, onRequestUnlock }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  
  useEffect(() => {
    if (patient.anamnesis) {
      setText(patient.anamnesis.content || '');
    }
  }, [patient.anamnesis]);

  // --- PERMISSIONS ---
  const canView = [
    'ADMINISTRADOR', 'MEDICOS DE PISO', 'OBSTETRICIA', 
    'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 
    'CARDIOLOGIA', 'MEDICO STAFF'
  ].includes(userRole || '');

  const canEditRole = [
    'ADMINISTRADOR', 'MEDICOS DE PISO', 'OBSTETRICIA', 
    'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA'
  ].includes(userRole || '');

  const isAdmin = userRole === 'ADMINISTRADOR';

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <AlertTriangle size={32} className="mb-2 opacity-50" />
        <p className="text-xs">Sin acceso a este módulo.</p>
      </div>
    );
  }

  // --- LOGIC ---
  const anamnesis: AnamnesisData = patient.anamnesis || {
    content: '',
    lastUpdate: 0,
    locked: false
  };

  const isLocked = anamnesis.locked && anamnesis.content.length > 0;
  const unlockRequest = anamnesis.unlockRequest;
  const isPending = unlockRequest?.status === 'pending';
  const isApproved = unlockRequest?.status === 'approved';

  // State: Can current user type?
  const canType = canEditRole && (!isLocked || isApproved);

  // --- VOICE DICTATION ---
  const toggleRecording = () => {
      if (!canType) return;

      if (isRecording) {
          if (recognitionRef.current) recognitionRef.current.stop();
          setIsRecording(false);
          return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Navegador no compatible con dictado por voz.");
          return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true; 
      recognition.lang = 'es-ES';
      recognition.onresult = (event: any) => {
          let newContent = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) newContent += event.results[i][0].transcript;
          }
          if (newContent) setText(prev => (prev ? prev + ' ' : '') + newContent.trim());
      };
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      try { recognition.start(); setIsRecording(true); } catch (err) { setIsRecording(false); }
  };

  // --- AI IMPROVEMENT ---
  const handleImproveText = async () => {
      if (!text.trim()) return;
      setIsImproving(true);
      const improved = await improveAnamnesisText(text);
      setText(improved);
      setIsImproving(false);
  };

  const handleSave = () => {
    const newData: AnamnesisData = {
      content: text,
      lastUpdate: Date.now(),
      locked: true, // Always lock on save
      unlockRequest: undefined // Reset request on save
    };
    onUpdate({ ...patient, anamnesis: newData });
  };

  const handleRequestUnlock = () => {
    const updatedAnamnesis: AnamnesisData = {
      ...anamnesis,
      unlockRequest: {
        requestedBy: userRole || 'Unknown',
        timestamp: Date.now(),
        status: 'pending'
      }
    };
    onUpdate({ ...patient, anamnesis: updatedAnamnesis });
    onRequestUnlock(); // Notify Admin
  };

  const handleAdminAction = (approved: boolean) => {
    if (!unlockRequest) return;
    const updatedAnamnesis: AnamnesisData = {
      ...anamnesis,
      unlockRequest: {
        ...unlockRequest,
        status: approved ? 'approved' : 'rejected'
      }
    };
    onUpdate({ ...patient, anamnesis: updatedAnamnesis });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-2 gap-2">
      {/* HEADER & CONTROLS */}
      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
            <FileText size={14} /> Relato de la Enfermedad
          </h3>
          {anamnesis.lastUpdate > 0 && (
             <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
               <Clock size={10} /> Actualizado: {new Date(anamnesis.lastUpdate).toLocaleString()}
             </p>
          )}
        </div>

        {/* ACTIONS AREA */}
        <div className="flex items-center gap-2">
          
          {canType && (
              <>
                  {/* DICTATION BUTTON */}
                  <button 
                    onClick={toggleRecording} 
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} 
                    title="Dictar Relato"
                  >
                    {isRecording ? <Pause size={12} /> : <Mic size={14} />}
                  </button>

                  {/* AI IMPROVE BUTTON */}
                  <button 
                    onClick={handleImproveText} 
                    disabled={isImproving || !text.trim()}
                    className={`h-7 px-3 rounded-full flex items-center justify-center gap-1 transition-all text-[10px] font-bold ${isImproving ? 'bg-purple-100 text-purple-400' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'}`} 
                    title="Mejorar redacción con IA"
                  >
                    {isImproving ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span className="hidden sm:inline">Ampliar</span>
                  </button>
                  
                  <div className="h-4 w-px bg-slate-200 mx-1"></div>
              </>
          )}

          {/* CASE 1: LOCKED & NO REQUEST (Show "Request Unlock") */}
          {isLocked && !unlockRequest && canEditRole && (
            <button 
              onClick={handleRequestUnlock}
              className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-yellow-100 transition-colors"
            >
              <Lock size={12} /> Solicitar Edición
            </button>
          )}

          {/* CASE 2: LOCKED & PENDING (Show Status / Admin Actions) */}
          {isPending && (
            <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded border border-blue-100">
               {isAdmin ? (
                 <>
                   <span className="text-[9px] font-bold text-blue-700 mr-1">Solicitud de {unlockRequest.requestedBy}:</span>
                   <button onClick={() => handleAdminAction(true)} className="bg-green-600 text-white p-1 rounded hover:bg-green-700" title="Autorizar"><CheckCircle size={14}/></button>
                   <button onClick={() => handleAdminAction(false)} className="bg-red-600 text-white p-1 rounded hover:bg-red-700" title="Rechazar"><XCircle size={14}/></button>
                 </>
               ) : (
                 <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                    <Clock size={12} className="animate-pulse" /> Esperando autorización...
                 </span>
               )}
            </div>
          )}

          {/* CASE 3: REJECTED */}
          {unlockRequest?.status === 'rejected' && (
             <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                <XCircle size={12} /> <span className="text-[10px] font-bold">Solicitud Rechazada</span>
                {canEditRole && !isPending && (
                  <button onClick={handleRequestUnlock} className="ml-2 text-[9px] underline hover:text-red-800">Reintentar</button>
                )}
             </div>
          )}

          {/* CASE 4: APPROVED / FRESH (Show Save) */}
          {canType && (
            <button 
              onClick={handleSave}
              disabled={!text.trim()}
              className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Save size={12} /> Guardar
            </button>
          )}

           {/* STATUS INDICATOR */}
           {isLocked && !isApproved && <Lock size={16} className="text-slate-400" />}
           {isApproved && <Unlock size={16} className="text-green-500 animate-pulse" />}
        </div>
      </div>

      {/* TEXT EDITOR AREA */}
      <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-1 relative">
         <textarea
           className={`w-full h-full resize-none outline-none text-xs leading-relaxed p-4 font-medium transition-colors ${canType ? 'bg-white text-slate-900' : 'bg-slate-50 text-slate-700'}`}
           placeholder={canType ? "Describa el relato cronológico de la enfermedad (TE, Inicio, Curso)... Puede usar el micrófono." : "Sin información registrada."}
           value={text}
           onChange={(e) => setText(e.target.value)}
           readOnly={!canType}
         />
         {isRecording && (
             <div className="absolute bottom-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg animate-pulse">
                 <Mic size={12} /> Grabando...
             </div>
         )}
         {isImproving && (
             <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                 <RefreshCw size={24} className="text-purple-600 animate-spin mb-2" />
                 <span className="text-xs font-bold text-purple-700">Reescribiendo con terminología médica...</span>
             </div>
         )}
      </div>
    </div>
  );
};
