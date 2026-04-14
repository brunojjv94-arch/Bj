
import React, { useState, useEffect, useMemo } from 'react';
import { Patient, LabResult, HospitalRole } from '../../types';
import { Plus, Trash2, Activity, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface LabTabProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
}

// Common lab tests for autocomplete suggestions
const COMMON_LABS = [
  'Hemoglobina', 'Leucocitos', 'Plaquetas', 'Glucosa', 'Urea', 'Creatinina', 
  'PCR', 'Sodio', 'Potasio', 'TP', 'TTP', 'INR', 'Bilirrubina Total', 
  'Bilirrubina Directa', 'TGO', 'TGP', 'Amilasa', 'Lipasa', 'Gases - pH', 
  'Gases - pO2', 'Gases - pCO2', 'Lactato'
];

export const LabTab: React.FC<LabTabProps> = ({ patient, onUpdate, userRole }) => {
  const [newResult, setNewResult] = useState<Partial<LabResult>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    testName: '',
    value: undefined,
    unit: '' // Keep internal but remove input
  });

  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const canEdit = userRole !== 'MEDICO STAFF' && 
                  userRole !== 'ADMISION HOSPITALARIA' && 
                  userRole !== 'CARTAS DE GARANTIA' &&
                  !['ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE'].includes(userRole || '');

  // --- HANDLERS ---
  const handleAddResult = () => {
    if (!newResult.testName || newResult.value === undefined || !newResult.date || !newResult.time) return;

    const result: LabResult = {
      id: Date.now().toString(),
      date: newResult.date,
      time: newResult.time,
      testName: newResult.testName,
      value: Number(newResult.value),
      unit: newResult.unit || ''
    };

    const updatedLabs = [...patient.labResults, result];
    // Sort all labs by date/time
    updatedLabs.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

    onUpdate({ ...patient, labResults: updatedLabs });
    
    // Auto-expand the test we just added to see the change
    setExpandedTest(newResult.testName);

    // Reset form but keep date/time current
    setNewResult({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      testName: '',
      value: undefined,
      unit: ''
    });
  };

  const handleDeleteResult = (id: string) => {
    if(!canEdit) return;
    const updatedLabs = patient.labResults.filter(l => l.id !== id);
    onUpdate({ ...patient, labResults: updatedLabs });
  };

  const toggleExpand = (testName: string) => {
      setExpandedTest(prev => prev === testName ? null : testName);
  };

  // --- GROUPING & CHART DATA PREP ---
  const groupedResults = useMemo(() => {
    const groups: Record<string, LabResult[]> = {};
    patient.labResults.forEach(r => {
      const name = r.testName.trim();
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    });
    return groups;
  }, [patient.labResults]);

  const suggestions = useMemo(() => {
     const patientHistory = Array.from(new Set(patient.labResults.map(r => r.testName)));
     return Array.from(new Set([...patientHistory, ...COMMON_LABS])).sort();
  }, [patient.labResults]);

  // --- SVG CHART COMPONENT ---
  const Sparkline = ({ data }: { data: LabResult[] }) => {
    if (data.length < 2) return null;

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // SVG Dimensions
    const width = 100;
    const height = 35;
    const paddingX = 5;
    const paddingY = 10; 

    // Create points string
    const points = data.map((d, i) => {
      const x = paddingX + (i / (data.length - 1)) * (width - 2 * paddingX);
      const normalizedVal = (d.value - min) / range;
      const y = (height - paddingY) - (normalizedVal * (height - (2 * paddingY)));
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points & Labels */}
        {data.map((d, i) => {
           const x = paddingX + (i / (data.length - 1)) * (width - 2 * paddingX);
           const normalizedVal = (d.value - min) / range;
           const y = (height - paddingY) - (normalizedVal * (height - (2 * paddingY)));
           
           return (
             <g key={i}>
                 <circle cx={x} cy={y} r="1.5" fill="white" stroke="#3b82f6" strokeWidth="1" />
                 {/* Value Label */}
                 <text 
                    x={x} 
                    y={y - 4} 
                    textAnchor="middle" 
                    fill="#475569" 
                    fontSize="5" 
                    fontWeight="bold"
                    fontFamily="sans-serif"
                 >
                     {d.value}
                 </text>
             </g>
           );
        })}
      </svg>
    );
  };

  const getTrendIcon = (data: LabResult[]) => {
      if (data.length < 2) return null;
      const last = data[data.length - 1].value;
      const prev = data[data.length - 2].value;
      if (last > prev) return <TrendingUp size={12} className="text-red-500" />; 
      if (last < prev) return <TrendingDown size={12} className="text-emerald-500" />;
      return <Minus size={12} className="text-slate-400" />;
  };

  return (
    <div className="flex flex-col gap-2 pb-10 h-full">
      {/* --- FORMULARIO DE INGRESO COMPACTO --- */}
      {canEdit && (
        <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0 flex items-center gap-1.5">
            <input type="date" value={newResult.date} onChange={e => setNewResult({...newResult, date: e.target.value})} className="w-20 h-6 bg-white text-slate-900 border border-slate-300 rounded px-1 text-[9px] outline-none" />
            <input type="time" value={newResult.time} onChange={e => setNewResult({...newResult, time: e.target.value})} className="w-14 h-6 bg-white text-slate-900 border border-slate-300 rounded px-1 text-[9px] outline-none" />
            
            <div className="flex-1 min-w-[80px] relative">
               <input 
                  list="lab-suggestions"
                  type="text" 
                  value={newResult.testName} 
                  onChange={e => setNewResult({...newResult, testName: e.target.value})} 
                  className="w-full h-6 bg-white text-slate-900 border border-slate-300 rounded px-2 text-[9px] outline-none placeholder-slate-400" 
                  placeholder="Examen..."
               />
               <datalist id="lab-suggestions">
                   {suggestions.map(s => <option key={s} value={s} />)}
               </datalist>
            </div>
            
            <input 
                type="number" 
                step="0.01"
                value={newResult.value === undefined ? '' : newResult.value} 
                onChange={e => setNewResult({...newResult, value: e.target.value === '' ? undefined : Number(e.target.value)})} 
                className="w-14 h-6 bg-white text-slate-900 border border-slate-300 rounded px-2 text-[9px] outline-none" 
                placeholder="Valor"
            />
            
            <button 
                onClick={handleAddResult}
                disabled={!newResult.testName || newResult.value === undefined}
                className="h-6 w-7 bg-primary-600 hover:bg-primary-700 text-white rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
            >
                <Plus size={14} />
            </button>
        </div>
      )}

      {/* --- LISTA EVOLUTIVA --- */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
          {Object.keys(groupedResults).length === 0 ? (
              <div className="text-center py-4 text-[10px] text-slate-400 flex flex-col items-center">
                  <Activity size={20} className="mb-1 opacity-50" />
                  Sin resultados.
              </div>
          ) : (
              Object.entries(groupedResults).sort().map(([testName, data]) => {
                  const results = data as LabResult[];
                  const latest = results[results.length - 1];
                  const isExpanded = expandedTest === testName;
                  
                  return (
                      <div key={testName} className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm transition-all group">
                          {/* SUMMARY CARD */}
                          <div 
                             className="flex justify-between items-center cursor-pointer gap-2"
                             onClick={() => toggleExpand(testName)}
                          >
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center">
                                      <h4 className="text-[10px] font-bold text-slate-700 truncate">{testName}</h4>
                                      <div className="text-[8px] text-slate-400 font-mono">
                                        {latest.date.substring(5)} {latest.time}
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-base font-bold text-primary-700 leading-none">{latest.value}</span>
                                      {getTrendIcon(results)}
                                      {isExpanded ? <ChevronUp size={10} className="text-slate-300 ml-auto"/> : <ChevronDown size={10} className="text-slate-300 ml-auto"/>}
                                  </div>
                              </div>
                              
                              <div className="w-24 h-8 flex items-end justify-end shrink-0">
                                  {results.length > 1 ? (
                                      <Sparkline data={results} />
                                  ) : (
                                      <span className="text-[8px] text-slate-300 italic">1 dato</span>
                                  )}
                              </div>
                          </div>
                          
                          {/* HISTORY TABLE */}
                          {isExpanded && (
                              <div className="mt-1.5 pt-1 border-t border-slate-100">
                                 <div className="bg-white rounded border border-slate-100 overflow-hidden">
                                     <table className="w-full text-[8px] text-left">
                                         <tbody className="divide-y divide-slate-100">
                                             {[...results].reverse().map(r => (
                                                 <tr key={r.id} className="bg-white">
                                                     <td className="px-1.5 py-0.5 text-slate-600">
                                                        {r.date} <span className="text-slate-400">{r.time}</span>
                                                     </td>
                                                     <td className={`px-1.5 py-0.5 text-right font-bold text-slate-700 ${r.id === latest.id ? 'text-primary-700' : ''}`}>{r.value}</td>
                                                     {canEdit && (
                                                         <td className="px-1.5 py-0.5 text-right w-5">
                                                             <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteResult(r.id); }} 
                                                                className="text-slate-300 hover:text-red-500"
                                                             >
                                                                <Trash2 size={10} />
                                                             </button>
                                                         </td>
                                                     )}
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 </div>
                              </div>
                          )}
                      </div>
                  );
              })
          )}
      </div>
    </div>
  );
};
