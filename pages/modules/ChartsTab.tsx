
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Patient, ShiftRecord, DrainEntry, HospitalRole } from '../../types';
import { Activity, Thermometer, Heart, Wind, Droplets, Trash2, Calendar, Clock, Scale, Ruler, Printer, Check, Zap, AlertCircle, X, Edit2, ArrowRight } from 'lucide-react';

interface ChartsTabProps {
  patient: Patient;
  onUpdate?: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
}

// --- HELPER FUNCTIONS ---
const getShiftFromTime = (time: string): 'Mañana' | 'Tarde' | 'Noche' => {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour >= 7 && hour < 13) return 'Mañana';
    if (hour >= 13 && hour < 19) return 'Tarde';
    return 'Noche';
};

const getShiftColor = (shift: string) => {
    switch(shift) {
        case 'Mañana': return '#fefce8'; // yellow-50
        case 'Tarde': return '#fff7ed'; // orange-50
        case 'Noche': return '#eef2ff'; // indigo-50
        default: return '#f8fafc';
    }
};

// --- SMART INPUT COMPONENT (Auto-Save & Clear) ---
const SmartInput = ({ 
    id,
    value, 
    onChange, 
    onCommit, 
    placeholder, 
    label, 
    className = "",
    type = "number",
    suffix,
    colorClass = "text-slate-700",
    disabled = false
}: { 
    id: string,
    value: string, 
    onChange: (val: string) => void, 
    onCommit: (id: string, val: string) => void, 
    placeholder?: string, 
    label: string, 
    className?: string, 
    type?: string,
    suffix?: string,
    colorClass?: string,
    disabled?: boolean
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    const handleBlur = () => {
        onCommit(id, value);
    };

    return (
        <div className={`flex flex-col relative ${className}`}>
            <label className={`text-[8px] font-bold uppercase mb-0.5 truncate ${colorClass.replace('text-', 'text-opacity-80 text-')}`}>{label}</label>
            <div className="relative">
                <input 
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`w-full h-7 text-xs font-bold border border-slate-200 rounded px-1 outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all bg-white text-center ${colorClass} ${disabled ? 'bg-slate-100 text-slate-400' : ''}`}
                />
                {suffix && <span className="absolute right-1 top-1.5 text-[8px] text-slate-400 pointer-events-none">{suffix}</span>}
            </div>
        </div>
    );
};

// --- SEPARATE CHART COMPONENT ---
const SingleMetricChart = ({ 
    records,
    title, 
    dataKey, 
    color, 
    unit, 
    minY, 
    maxY, 
    hLines = [] 
}: { 
    records: ShiftRecord[],
    title: string, 
    dataKey: string, 
    color: string, 
    unit: string, 
    minY: number, 
    maxY: number,
    hLines?: number[]
}) => {
    if (records.length === 0) return null;

    const height = 110; 
    const width = Math.max(600, records.length * 50);
    const paddingX = 40;
    const paddingY = 15;

    const mapY = (val: number) => {
        const norm = (val - minY) / (maxY - minY);
        return (height - paddingY) - (norm * (height - 2 * paddingY));
    };

    const points = records.map((r, i) => {
        let val: number | undefined;
        if (dataKey === 'pa') {
            return null; 
        } else {
            val = (r.vitals as any)[dataKey];
        }
        if (val === undefined) return null;
        const x = paddingX + (i / (Math.max(records.length - 1, 1))) * (width - 2 * paddingX);
        return `${x},${mapY(val)}`;
    }).filter(Boolean).join(' ');

    const paData = dataKey === 'pa' ? records.map((r, i) => {
        if (!r.vitals.paSys || !r.vitals.paDia) return null;
        const x = paddingX + (i / (Math.max(records.length - 1, 1))) * (width - 2 * paddingX);
        return { x, ySys: mapY(r.vitals.paSys), yDia: mapY(r.vitals.paDia), sys: r.vitals.paSys, dia: r.vitals.paDia, shift: r.shift, time: r.time };
    }) : [];

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm mb-3 overflow-x-auto">
            <div className="px-2 py-1 border-b border-slate-100 flex justify-between items-center sticky left-0 bg-white z-10">
                <h4 className="text-[10px] font-bold uppercase flex items-center gap-2" style={{ color }}>
                    {dataKey === 'fc' ? <Heart size={12}/> : dataKey === 'temp' ? <Thermometer size={12}/> : dataKey === 'sat' ? <Droplets size={12}/> : dataKey === 'fr' ? <Wind size={12}/> : <Activity size={12}/>}
                    {title} <span className="opacity-60 font-medium">({unit})</span>
                </h4>
            </div>
            <div className="relative">
                <svg width={width} height={height} className="block">
                    {hLines.map(y => (
                        <line key={y} x1={paddingX} y1={mapY(y)} x2={width - paddingX} y2={mapY(y)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                    ))}
                    
                    {records.map((r, i) => {
                        if (i === 0) return null;
                        const xPrev = paddingX + ((i - 1) / (Math.max(records.length - 1, 1))) * (width - 2 * paddingX);
                        const xCurr = paddingX + (i / (Math.max(records.length - 1, 1))) * (width - 2 * paddingX);
                        return <rect key={`bg-${i}`} x={xPrev} y={paddingY} width={xCurr - xPrev} height={height - 2*paddingY} fill={getShiftColor(r.shift)} opacity="0.5" />;
                    })}

                    {dataKey !== 'pa' ? (
                        <>
                            <polyline points={points || ''} fill="none" stroke={color} strokeWidth="1.5" />
                            {records.map((r, i) => {
                                const val = (r.vitals as any)[dataKey];
                                if (val === undefined) return null;
                                const x = paddingX + (i / (Math.max(records.length - 1, 1))) * (width - 2 * paddingX);
                                const y = mapY(val);
                                return (
                                    <g key={i}>
                                        <circle cx={x} cy={y} r="2.5" fill="white" stroke={color} strokeWidth="1.5" />
                                        <text x={x} y={y - 6} textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">{val}</text>
                                        <text x={x} y={height - 2} textAnchor="middle" fontSize="7" fill="#94a3b8">{r.time}</text>
                                    </g>
                                );
                            })}
                        </>
                    ) : (
                        paData.map((d, i) => d && (
                            <g key={i}>
                                <line x1={d.x} y1={d.ySys} x2={d.x} y2={d.yDia} stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
                                <circle cx={d.x} cy={d.ySys} r="1.5" fill={color} />
                                <circle cx={d.x} cy={d.yDia} r="1.5" fill={color} />
                                <text x={d.x} y={d.ySys - 4} textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">{d.sys}</text>
                                <text x={d.x} y={d.yDia + 8} textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">{d.dia}</text>
                                <text x={d.x} y={height - 2} textAnchor="middle" fontSize="7" fill="#94a3b8">{d.time}</text>
                            </g>
                        ))
                    )}
                </svg>
            </div>
        </div>
    );
};

export const ChartsTab: React.FC<ChartsTabProps> = ({ patient, onUpdate, userRole }) => {
  // --- STATE ---
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  
  // Patient Anthropometry
  const [currentWeight, setCurrentWeight] = useState(patient.weight || '');
  const [currentHeight, setCurrentHeight] = useState(patient.height || '');

  // Vitals State
  const [fc, setFc] = useState('');
  const [fr, setFr] = useState('');
  const [temp, setTemp] = useState('');
  const [sat, setSat] = useState('');
  const [paSys, setPaSys] = useState('');
  const [paDia, setPaDia] = useState('');

  // Fluid Balance State
  const [oral, setOral] = useState('');
  const [parenteral, setParenteral] = useState('');
  const [oxidation, setOxidation] = useState(''); // Auto
  
  const [urine, setUrine] = useState('');
  const [stool, setStool] = useState('');
  const [vomit, setVomit] = useState('');
  const [insensible, setInsensible] = useState(''); // Auto
  
  // Drains
  const [tempDrains, setTempDrains] = useState<DrainEntry[]>([]);
  const [newDrainName, setNewDrainName] = useState('');
  const [newDrainAmount, setNewDrainAmount] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  // --- DERIVED STATE ---
  
  // Check Kardex for Fluid Balance Indication
  const showBalance = useMemo(() => {
      const carePlan = patient.kardex?.carePlan || '';
      return /\b(BH|BHE|BALANCE|HIDRICO)\b/i.test(carePlan);
  }, [patient.kardex]);

  // --- SMART TIME GROUPING ---
  useEffect(() => {
      if (editingId) return; 

      if (patient.shiftRecords && patient.shiftRecords.length > 0) {
          const sorted = [...patient.shiftRecords].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
          const lastRecord = sorted[sorted.length - 1];
          if (lastRecord.date === entryDate) {
              const lastTime = new Date(`${entryDate}T${lastRecord.time}`);
              const now = new Date();
              const diffMins = (now.getTime() - lastTime.getTime()) / 60000;
              
              if (diffMins <= 5 && diffMins >= 0) {
                  setEntryTime(lastRecord.time);
              } else {
                  setEntryTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
              }
          }
      }
  }, [patient.shiftRecords, editingId, entryDate]);

  useEffect(() => {
      const w = parseFloat(currentWeight);
      if (!isNaN(w) && w > 0 && showBalance && !editingId) {
          const oxCalc = Math.round((w * 5) / 4); 
          const insensCalc = Math.round(w * 0.5 * 6); 
          setOxidation(oxCalc.toString());
          setInsensible(insensCalc.toString());
      }
  }, [currentWeight, showBalance, editingId]);

  // --- DATA PROCESSING ---
  const records = useMemo(() => {
      return (patient.shiftRecords || []).sort((a, b) => {
          const dtA = new Date(`${a.date}T${a.time}`).getTime();
          const dtB = new Date(`${b.date}T${b.time}`).getTime();
          return dtA - dtB;
      });
  }, [patient.shiftRecords]);

  // Group Records by Date for the Table Header
  const groupedRecordsByDate = useMemo(() => {
      const groups: Record<string, ShiftRecord[]> = {};
      records.forEach(r => {
          if (!groups[r.date]) groups[r.date] = [];
          groups[r.date].push(r);
      });
      return groups; // { "2023-10-27": [rec1, rec2], ... }
  }, [records]);

  const dailyBalances = useMemo(() => {
      if (!showBalance) return [];
      const groups: Record<string, any> = {};
      
      records.forEach(r => {
          if (!groups[r.date]) {
              groups[r.date] = { date: r.date, input: 0, output: 0, balance: 0 };
          }
          const b = r.balance;
          const input = (b.oral||0) + (b.parenteral||0) + (b.oxidation||0);
          const output = (b.urine||0) + (b.stool||0) + (b.vomit||0) + (b.insensible||0) + (b.drains?.reduce((a,v)=>a+v.amount,0)||0);
          groups[r.date].input += input;
          groups[r.date].output += output;
      });

      return Object.values(groups).map(g => ({ ...g, balance: g.input - g.output })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, showBalance]);

  // --- ACTIONS ---

  const handleFieldCommit = (fieldId: string, value: string) => {
      if (!value && fieldId !== 'drains') return; 

      if (fieldId === 'weight' || fieldId === 'height') {
          if (onUpdate) onUpdate({ ...patient, [fieldId]: value });
          return;
      }

      const updatedRecords = [...(patient.shiftRecords || [])];
      let targetRecordId = editingId;

      if (!targetRecordId) {
          const existingIdx = updatedRecords.findIndex(r => r.date === entryDate && r.time === entryTime);
          if (existingIdx >= 0) targetRecordId = updatedRecords[existingIdx].id;
      }

      const numVal = parseFloat(value);
      const safeVal = isNaN(numVal) ? undefined : numVal;

      if (targetRecordId) {
          updatedRecords.map(r => {
              if (r.id === targetRecordId) {
                  const newVitals = { ...r.vitals };
                  const newBalance = { ...r.balance };
                  
                  if (['fc','fr','temp','sat','paSys','paDia'].includes(fieldId)) (newVitals as any)[fieldId] = safeVal;
                  if (['oral','parenteral','oxidation','urine','stool','vomit','insensible'].includes(fieldId)) (newBalance as any)[fieldId] = safeVal;
                  
                  r.vitals = newVitals;
                  r.balance = newBalance;
                  r.timestamp = Date.now();
                  return r;
              }
              return r;
          });
      } else {
          const newRecord: ShiftRecord = {
              id: Date.now().toString(),
              date: entryDate,
              time: entryTime,
              shift: getShiftFromTime(entryTime),
              vitals: {},
              balance: { drains: [] },
              author: userRole || 'Usuario',
              timestamp: Date.now()
          };
          if (['fc','fr','temp','sat','paSys','paDia'].includes(fieldId)) (newRecord.vitals as any)[fieldId] = safeVal;
          if (['oral','parenteral','oxidation','urine','stool','vomit','insensible'].includes(fieldId)) (newRecord.balance as any)[fieldId] = safeVal;
          
          updatedRecords.push(newRecord);
      }

      if (onUpdate) onUpdate({ ...patient, shiftRecords: updatedRecords });
      setLastSaveTime(Date.now());

      if (!editingId) {
          switch(fieldId) {
              case 'fc': setFc(''); break;
              case 'fr': setFr(''); break;
              case 'temp': setTemp(''); break;
              case 'sat': setSat(''); break;
              case 'paSys': setPaSys(''); break;
              case 'paDia': setPaDia(''); break;
              case 'oral': setOral(''); break;
              case 'parenteral': setParenteral(''); break;
              case 'oxidation': setOxidation(''); break;
              case 'urine': setUrine(''); break;
              case 'stool': setStool(''); break;
              case 'vomit': setVomit(''); break;
              case 'insensible': setInsensible(''); break;
          }
      }
  };

  const handleAddTempDrain = () => {
      if (!newDrainName || !newDrainAmount) return;
      const amount = parseFloat(newDrainAmount);
      
      const updatedRecords = [...(patient.shiftRecords || [])];
      let targetIdx = editingId ? updatedRecords.findIndex(r => r.id === editingId) : updatedRecords.findIndex(r => r.date === entryDate && r.time === entryTime);
      
      const newDrain = { id: Date.now().toString(), name: newDrainName, amount };

      if (targetIdx >= 0) {
          const r = updatedRecords[targetIdx];
          r.balance.drains = [...(r.balance.drains || []), newDrain];
      } else {
          updatedRecords.push({
              id: Date.now().toString(),
              date: entryDate,
              time: entryTime,
              shift: getShiftFromTime(entryTime),
              vitals: {},
              balance: { drains: [newDrain] },
              author: userRole || 'Usuario',
              timestamp: Date.now()
          });
      }

      if (onUpdate) onUpdate({ ...patient, shiftRecords: updatedRecords });
      
      setNewDrainName('');
      setNewDrainAmount('');
      setLastSaveTime(Date.now());
  };

  const handleRemoveDrain = (recordId: string, drainId: string) => {
      const updatedRecords = (patient.shiftRecords || []).map(r => {
          if (r.id === recordId) {
              return { ...r, balance: { ...r.balance, drains: r.balance.drains.filter(d => d.id !== drainId) } };
          }
          return r;
      });
      if (onUpdate) onUpdate({ ...patient, shiftRecords: updatedRecords });
  };

  const handleEditRecord = (rec: ShiftRecord) => {
      setEditingId(rec.id);
      setEntryDate(rec.date);
      setEntryTime(rec.time);
      
      setFc(rec.vitals.fc?.toString() || '');
      setFr(rec.vitals.fr?.toString() || '');
      setTemp(rec.vitals.temp?.toString() || '');
      setSat(rec.vitals.sat?.toString() || '');
      setPaSys(rec.vitals.paSys?.toString() || '');
      setPaDia(rec.vitals.paDia?.toString() || '');

      setOral(rec.balance.oral?.toString() || '');
      setParenteral(rec.balance.parenteral?.toString() || '');
      setOxidation(rec.balance.oxidation?.toString() || '');
      setUrine(rec.balance.urine?.toString() || '');
      setStool(rec.balance.stool?.toString() || '');
      setVomit(rec.balance.vomit?.toString() || '');
      setInsensible(rec.balance.insensible?.toString() || '');
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setFc(''); setFr(''); setTemp(''); setSat(''); setPaSys(''); setPaDia('');
      setOral(''); setParenteral(''); setUrine(''); setStool(''); setVomit('');
      setEntryTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      
      const w = parseFloat(currentWeight);
      if (!isNaN(w) && w > 0) {
          setOxidation(Math.round((w * 5) / 4).toString());
          setInsensible(Math.round(w * 0.5 * 6).toString());
      } else {
          setOxidation(''); setInsensible('');
      }
  };

  const handleDeleteRecord = (id: string) => {
      if (!confirm("¿Eliminar este registro?")) return;
      const updated = (patient.shiftRecords || []).filter(r => r.id !== id);
      if (onUpdate) onUpdate({ ...patient, shiftRecords: updated });
      if (editingId === id) handleCancelEdit();
  };

  const handlePrint = () => {
      const w = window.open('', '_blank');
      if (w) {
          w.document.write(`
            <html>
                <head>
                    <title>Gráfica Vital - ${patient.name}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body class="p-8 bg-white">
                    <div class="border-b-2 border-black mb-4 pb-2">
                        <h1 class="text-2xl font-bold">${patient.name}</h1>
                        <p class="text-sm">HC: ${patient.hc} | Edad: ${patient.age}</p>
                    </div>
                    ${document.getElementById('charts-container')?.innerHTML}
                    <script>setTimeout(() => window.print(), 500);</script>
                </body>
            </html>
          `);
          w.document.close();
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-10 overflow-hidden font-sans">
        
        {/* --- 1. DATA ENTRY HEADER --- */}
        <div className={`border-b shadow-md z-30 shrink-0 transition-colors ${editingId ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-wrap justify-between items-center p-2 border-b border-slate-100/50 gap-2">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded border bg-white border-slate-200 shadow-sm">
                        <Calendar size={12} className="text-slate-400"/>
                        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="text-xs font-bold text-slate-700 bg-transparent outline-none w-24"/>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded border bg-white border-slate-200 shadow-sm">
                        <Clock size={12} className="text-slate-400"/>
                        <input type="time" value={entryTime} onChange={e => setEntryTime(e.target.value)} className="text-xs font-bold text-slate-700 bg-transparent outline-none w-16"/>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <SmartInput id="weight" label="Peso" value={currentWeight} onChange={setCurrentWeight} onCommit={handleFieldCommit} placeholder="Kg" className="w-12" colorClass="text-blue-600" suffix="kg" />
                    <SmartInput id="height" label="Talla" value={currentHeight} onChange={setCurrentHeight} onCommit={handleFieldCommit} placeholder="cm" className="w-12" colorClass="text-blue-600" suffix="cm" />
                </div>

                <div className="flex gap-2 items-center">
                    {editingId && (
                        <button onClick={handleCancelEdit} className="text-[10px] bg-white border border-slate-300 px-2 py-1 rounded text-slate-600 font-bold hover:bg-slate-100">
                            Cancelar Edición
                        </button>
                    )}
                    {lastSaveTime && (
                        <span className="text-[9px] font-bold text-green-600 flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                            <Check size={10} strokeWidth={4} /> Guardado
                        </span>
                    )}
                    <button onClick={handlePrint} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors" title="Imprimir Gráficas">
                        <Printer size={16} />
                    </button>
                </div>
            </div>

            <div className="p-2 overflow-x-auto">
                <div className="flex gap-3 min-w-max pb-1">
                    <div className="flex gap-1 p-1.5 bg-slate-50/50 rounded-lg border border-slate-100 items-end">
                        <SmartInput id="fc" label="FC" value={fc} onChange={setFc} onCommit={handleFieldCommit} colorClass="text-red-500" className="w-12" />
                        <SmartInput id="paSys" label="PAS" value={paSys} onChange={setPaSys} onCommit={handleFieldCommit} colorClass="text-blue-600" className="w-12" placeholder="Sys" />
                        <SmartInput id="paDia" label="PAD" value={paDia} onChange={setPaDia} onCommit={handleFieldCommit} colorClass="text-blue-600" className="w-12" placeholder="Dia" />
                        <SmartInput id="temp" label="Temp" value={temp} onChange={setTemp} onCommit={handleFieldCommit} colorClass="text-orange-500" className="w-12" placeholder="°C" />
                        <SmartInput id="sat" label="Sat%" value={sat} onChange={setSat} onCommit={handleFieldCommit} colorClass="text-purple-600" className="w-12" placeholder="%" />
                        <SmartInput id="fr" label="FR" value={fr} onChange={setFr} onCommit={handleFieldCommit} colorClass="text-green-600" className="w-10" />
                    </div>

                    {showBalance && (
                        <>
                            <div className="flex gap-1 p-1.5 bg-emerald-50/30 rounded-lg border border-emerald-100 items-end">
                                <SmartInput id="oral" label="Oral" value={oral} onChange={setOral} onCommit={handleFieldCommit} colorClass="text-emerald-700" className="w-12" placeholder="cc" />
                                <SmartInput id="parenteral" label="Endov" value={parenteral} onChange={setParenteral} onCommit={handleFieldCommit} colorClass="text-emerald-700" className="w-12" placeholder="cc" />
                                <div className="relative">
                                    <SmartInput id="oxidation" label="Oxid." value={oxidation} onChange={setOxidation} onCommit={handleFieldCommit} colorClass="text-emerald-700 bg-emerald-50" className="w-12" placeholder="Auto" />
                                    <Zap size={8} className="absolute top-0 right-0 text-emerald-400" />
                                </div>
                            </div>

                            <div className="flex gap-1 p-1.5 bg-amber-50/30 rounded-lg border border-amber-100 items-end">
                                <SmartInput id="urine" label="Orina" value={urine} onChange={setUrine} onCommit={handleFieldCommit} colorClass="text-amber-700" className="w-12" placeholder="cc" />
                                <SmartInput id="stool" label="Heces" value={stool} onChange={setStool} onCommit={handleFieldCommit} colorClass="text-amber-700" className="w-12" placeholder="g/cc" />
                                <SmartInput id="vomit" label="Vóm" value={vomit} onChange={setVomit} onCommit={handleFieldCommit} colorClass="text-amber-700" className="w-12" placeholder="cc" />
                                <div className="relative">
                                    <SmartInput id="insensible" label="P.Ins." value={insensible} onChange={setInsensible} onCommit={handleFieldCommit} colorClass="text-amber-700 bg-amber-50" className="w-12" placeholder="Auto" />
                                    <Zap size={8} className="absolute top-0 right-0 text-amber-400" />
                                </div>
                                
                                <div className="flex flex-col w-24">
                                    <label className="text-[8px] font-bold text-amber-600 text-center uppercase">Drenajes</label>
                                    <div className="flex gap-1">
                                        <input type="text" placeholder="Nom" value={newDrainName} onChange={e => setNewDrainName(e.target.value)} className="w-12 h-7 text-[9px] border border-amber-200 rounded px-1 outline-none"/>
                                        <input type="number" placeholder="cc" value={newDrainAmount} onChange={e => setNewDrainAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTempDrain()} className="w-10 h-7 text-[9px] border border-amber-200 rounded px-1 outline-none"/>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* --- 2. MAIN CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3" id="charts-container">
            
            {/* GRAPHS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SingleMetricChart records={records} title="Frecuencia Cardíaca" dataKey="fc" color="#ef4444" unit="lpm" minY={40} maxY={160} hLines={[60, 100]} />
                <SingleMetricChart records={records} title="Presión Arterial" dataKey="pa" color="#2563eb" unit="mmHg" minY={40} maxY={200} hLines={[80, 120]} />
                <SingleMetricChart records={records} title="Temperatura" dataKey="temp" color="#f97316" unit="°C" minY={35} maxY={41} hLines={[37]} />
                <div className="grid grid-cols-1 gap-3">
                    <SingleMetricChart records={records} title="Saturación O2" dataKey="sat" color="#9333ea" unit="%" minY={80} maxY={100} hLines={[90, 95]} />
                    <SingleMetricChart records={records} title="Frecuencia Resp." dataKey="fr" color="#16a34a" unit="rpm" minY={10} maxY={40} hLines={[12, 20]} />
                </div>
            </div>

            {/* DAILY BALANCE SUMMARY */}
            {showBalance && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2"><Droplets size={14} className="text-blue-300"/> Balance Hídrico Diario</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                    <th className="p-2 border-r">FECHA</th>
                                    <th className="p-2 border-r text-right">INGRESOS (cc)</th>
                                    <th className="p-2 border-r text-right">EGRESOS (cc)</th>
                                    <th className="p-2 text-right">BALANCE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                                {dailyBalances.map((day, idx) => (
                                    <tr key={day.date} className={idx === 0 ? 'bg-blue-50/30' : ''}>
                                        <td className="p-2 border-r font-bold">{day.date}</td>
                                        <td className="p-2 border-r text-right text-emerald-600 font-bold">{day.input}</td>
                                        <td className="p-2 border-r text-right text-amber-600 font-bold">{day.output}</td>
                                        <td className={`p-2 text-right font-black ${day.balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                            {day.balance > 0 ? '+' : ''}{day.balance}
                                        </td>
                                    </tr>
                                ))}
                                {dailyBalances.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">No hay registros de balance.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DETAILED HISTORY TABLE MATRIX */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Activity size={12}/> Registro Detallado (Hoja Gráfica)</h4>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse min-w-max">
                        <thead>
                            {/* DATE HEADER ROW */}
                            <tr className="bg-slate-100 text-slate-500 border-b border-slate-200">
                                <th className="sticky left-0 bg-slate-100 z-20 border-r border-slate-200 p-2 w-32 min-w-[120px]">FECHA / HORA</th>
                                {Object.entries(groupedRecordsByDate).map(([date, recs]) => (
                                    <th key={date} colSpan={recs.length} className="border-r border-slate-200 p-1 text-center font-bold bg-slate-100 uppercase text-[9px]">
                                        {date}
                                    </th>
                                ))}
                            </tr>
                            {/* TIME HEADER ROW */}
                            <tr className="bg-white text-slate-700 border-b border-slate-200">
                                <th className="sticky left-0 bg-white z-20 border-r border-slate-200 p-1 text-right text-[9px] text-slate-400 font-medium italic pr-2">Turno / Hora</th>
                                {Object.entries(groupedRecordsByDate).flatMap(([date, recs]) => 
                                    recs.map(r => (
                                        <th key={r.id} className="border-r border-slate-100 p-1 text-center min-w-[50px] relative group">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-[9px] font-bold px-1 rounded ${r.shift === 'Noche' ? 'bg-indigo-50 text-indigo-700' : 'bg-yellow-50 text-yellow-700'}`}>{r.time}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleEditRecord(r)}
                                                className="absolute top-0 right-0 p-0.5 text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Editar columna"
                                            >
                                                <Edit2 size={10} />
                                            </button>
                                        </th>
                                    ))
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                            {/* VITALS ROWS */}
                            <tr>
                                <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 p-2 font-bold text-red-600 text-xs text-right">F. Cardíaca</td>
                                {records.map(r => <td key={`fc-${r.id}`} className="border-r border-slate-100 p-1 text-center">{r.vitals.fc || '-'}</td>)}
                            </tr>
                            <tr>
                                <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 p-2 font-bold text-green-600 text-xs text-right">F. Respiratoria</td>
                                {records.map(r => <td key={`fr-${r.id}`} className="border-r border-slate-100 p-1 text-center">{r.vitals.fr || '-'}</td>)}
                            </tr>
                            <tr>
                                <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 p-2 font-bold text-blue-600 text-xs text-right">P. Arterial</td>
                                {records.map(r => <td key={`pa-${r.id}`} className="border-r border-slate-100 p-1 text-center font-bold text-[9px]">{r.vitals.paSys ? `${r.vitals.paSys}/${r.vitals.paDia}` : '-'}</td>)}
                            </tr>
                            <tr>
                                <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 p-2 font-bold text-orange-500 text-xs text-right">Temperatura</td>
                                {records.map(r => <td key={`t-${r.id}`} className="border-r border-slate-100 p-1 text-center">{r.vitals.temp || '-'}</td>)}
                            </tr>
                            <tr>
                                <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 p-2 font-bold text-purple-600 text-xs text-right">Sat O2</td>
                                {records.map(r => <td key={`sat-${r.id}`} className="border-r border-slate-100 p-1 text-center">{r.vitals.sat ? `${r.vitals.sat}%` : '-'}</td>)}
                            </tr>
                            
                            {/* BALANCE ROWS */}
                            {showBalance && (
                                <>
                                    <tr className="bg-emerald-50/30">
                                        <td className="sticky left-0 bg-emerald-50 z-10 border-r border-emerald-200 p-2 font-bold text-emerald-700 text-[10px] text-right uppercase border-t border-emerald-100">INGRESOS</td>
                                        {records.map(r => <td key={`ing-h-${r.id}`} className="border-r border-emerald-100 bg-emerald-50/10 p-1"></td>)}
                                    </tr>
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right">Oral</td>
                                        {records.map(r => <td key={`oral-${r.id}`} className="border-r border-slate-100 p-1 text-center text-emerald-600">{r.balance.oral || ''}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right">Parenteral</td>
                                        {records.map(r => <td key={`par-${r.id}`} className="border-r border-slate-100 p-1 text-center text-emerald-600">{r.balance.parenteral || ''}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right">Oxidación</td>
                                        {records.map(r => <td key={`oxi-${r.id}`} className="border-r border-slate-100 p-1 text-center text-emerald-600 text-[9px]">{r.balance.oxidation || ''}</td>)}
                                    </tr>

                                    <tr className="bg-amber-50/30">
                                        <td className="sticky left-0 bg-amber-50 z-10 border-r border-amber-200 p-2 font-bold text-amber-700 text-[10px] text-right uppercase border-t border-amber-100">EGRESOS</td>
                                        {records.map(r => <td key={`egr-h-${r.id}`} className="border-r border-amber-100 bg-amber-50/10 p-1"></td>)}
                                    </tr>
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right">Orina</td>
                                        {records.map(r => <td key={`uri-${r.id}`} className="border-r border-slate-100 p-1 text-center text-amber-600">{r.balance.urine || ''}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right">Heces</td>
                                        {records.map(r => <td key={`stool-${r.id}`} className="border-r border-slate-100 p-1 text-center text-amber-600">{r.balance.stool || ''}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right">P. Insens.</td>
                                        {records.map(r => <td key={`ins-${r.id}`} className="border-r border-slate-100 p-1 text-center text-amber-600 text-[9px]">{r.balance.insensible || ''}</td>)}
                                    </tr>
                                    {/* Drains Row (Aggregated for simplicity in table view) */}
                                    <tr>
                                        <td className="sticky left-0 bg-white z-10 border-r border-slate-200 p-1.5 text-slate-500 text-[10px] text-right italic">Drenajes (Total)</td>
                                        {records.map(r => {
                                            const totalDrain = r.balance.drains?.reduce((acc, d) => acc + d.amount, 0);
                                            return <td key={`drain-${r.id}`} className="border-r border-slate-100 p-1 text-center text-amber-600 font-bold" title={r.balance.drains?.map(d=>`${d.name}: ${d.amount}`).join(', ')}>{totalDrain || ''}</td>
                                        })}
                                    </tr>
                                </>
                            )}
                            
                            {/* DELETE ACTION ROW */}
                            <tr className="bg-slate-50 border-t border-slate-200">
                                <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 p-1"></td>
                                {records.map(r => (
                                    <td key={`del-${r.id}`} className="border-r border-slate-100 p-1 text-center">
                                        <button onClick={() => handleDeleteRecord(r.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={10}/></button>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};
