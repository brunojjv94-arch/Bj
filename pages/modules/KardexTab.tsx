
import React, { useState, useEffect } from 'react';
import { Patient, KardexData, HospitalRole } from '../../types';
import { ClipboardList, Save, Check, Droplet, Utensils, Syringe, Clock } from 'lucide-react';

interface KardexTabProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
}

export const KardexTab: React.FC<KardexTabProps> = ({ patient, onUpdate, userRole }) => {
  const [diet, setDiet] = useState('');
  const [ivFluids, setIvFluids] = useState('');
  const [carePlan, setCarePlan] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Initialize from patient data
  useEffect(() => {
      if (patient.kardex) {
          setDiet(patient.kardex.diet || '');
          setIvFluids(patient.kardex.ivFluids || '');
          setCarePlan(patient.kardex.carePlan || '');
      }
  }, [patient.id]); // Reload when patient changes

  const canEdit = [
      'ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE', 
      'MEDICO STAFF', 'ADMINISTRADOR', 'MEDICO UCI', 'MEDICO UCE', 'MEDICOS DE PISO'
  ].includes(userRole || '');

  const handleSave = () => {
      const newKardex: KardexData = {
          diet,
          ivFluids,
          carePlan,
          lastUpdate: Date.now(),
          updatedBy: userRole || 'Desconocido'
      };
      
      onUpdate({ ...patient, kardex: newKardex });
      setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 gap-3 pb-10 p-2">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                <ClipboardList size={16} className="text-teal-600"/> Kardex de Enfermería
            </h3>
            {canEdit && (
                !isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold hover:bg-slate-200 transition-colors">
                        Editar
                    </button>
                ) : (
                    <button onClick={handleSave} className="text-[10px] bg-teal-600 text-white px-3 py-1 rounded-full font-bold hover:bg-teal-700 transition-colors flex items-center gap-1">
                        <Save size={12}/> Guardar
                    </button>
                )
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 overflow-y-auto">
            {/* DIET SECTION */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="bg-orange-100 p-1.5 rounded-full text-orange-600"><Utensils size={14}/></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Dieta / Nutrición</span>
                </div>
                {isEditing ? (
                    <textarea 
                        className="flex-1 w-full text-xs p-2 border border-slate-200 rounded resize-none focus:ring-1 focus:ring-teal-500 outline-none bg-slate-50"
                        value={diet}
                        onChange={e => setDiet(e.target.value)}
                        placeholder="Ej: Dieta blanda, hiposódica..."
                    />
                ) : (
                    <div className="flex-1 text-xs text-slate-700 whitespace-pre-wrap font-medium">
                        {diet || <span className="text-slate-400 italic">Sin indicaciones dietéticas.</span>}
                    </div>
                )}
            </div>

            {/* FLUIDS SECTION */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="bg-blue-100 p-1.5 rounded-full text-blue-600"><Droplet size={14}/></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Hidratación / Endovenosos</span>
                </div>
                {isEditing ? (
                    <textarea 
                        className="flex-1 w-full text-xs p-2 border border-slate-200 rounded resize-none focus:ring-1 focus:ring-teal-500 outline-none bg-slate-50"
                        value={ivFluids}
                        onChange={e => setIvFluids(e.target.value)}
                        placeholder="Ej: Cloruro de Sodio 9% 1000cc a 30 gotas/min..."
                    />
                ) : (
                    <div className="flex-1 text-xs text-slate-700 whitespace-pre-wrap font-medium">
                        {ivFluids || <span className="text-slate-400 italic">Sin hidratación activa.</span>}
                    </div>
                )}
            </div>

            {/* NURSING CARE PLAN SECTION */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:col-span-2">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="bg-purple-100 p-1.5 rounded-full text-purple-600"><Syringe size={14}/></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Plan de Cuidados / Medicación / Observaciones</span>
                </div>
                {isEditing ? (
                    <textarea 
                        className="flex-1 w-full h-32 text-xs p-2 border border-slate-200 rounded resize-none focus:ring-1 focus:ring-teal-500 outline-none bg-slate-50"
                        value={carePlan}
                        onChange={e => setCarePlan(e.target.value)}
                        placeholder="Ej: Control de funciones vitales c/6h, cambio de posición, curación de herida..."
                    />
                ) : (
                    <div className="flex-1 text-xs text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">
                        {carePlan || <span className="text-slate-400 italic">Sin plan de cuidados registrado.</span>}
                    </div>
                )}
            </div>
        </div>
        
        {patient.kardex && (
            <div className="text-[9px] text-slate-400 text-right px-2">
                Última actualización: {new Date(patient.kardex.lastUpdate).toLocaleString()} por {patient.kardex.updatedBy}
            </div>
        )}
    </div>
  );
};
