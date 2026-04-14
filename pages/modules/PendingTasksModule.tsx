
import React, { useEffect, useState, useMemo } from 'react';
import { Patient, PendingTask, HospitalRole, Bed, Doctor } from '../../types';
import { ClipboardList, Clock, CheckCircle, Search, AlertCircle, Filter, LayoutGrid, ChevronRight } from 'lucide-react';

interface PendingTasksModuleProps {
    onPatientClick?: (id: string) => void;
    viewRole?: HospitalRole;
    filterByDoctor?: string;
}

export const PendingTasksModule: React.FC<PendingTasksModuleProps> = ({ onPatientClick, viewRole, filterByDoctor }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterByPending, setFilterByPending] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

    const loadData = () => {
        const allPatientsStr = localStorage.getItem('omni_patients');
        const allBedsStr = localStorage.getItem('omni_beds');
        const allDoctorsStr = localStorage.getItem('omni_doctors');
        
        if (allPatientsStr) {
            const allPatients: Patient[] = JSON.parse(allPatientsStr);
            const beds: Bed[] = allBedsStr ? JSON.parse(allBedsStr) : [];
            const docs: Doctor[] = allDoctorsStr ? JSON.parse(allDoctorsStr) : [];
            
            let filtered = allPatients.filter(p => !p.dischargeDate);

            // Filter by Doctor if Staff
            if (filterByDoctor) {
                const search = filterByDoctor.toLowerCase();
                filtered = filtered.filter(p => p.doctors.some(d => d.toLowerCase().includes(search)));
            }

            // Role based filtering logic
            if (viewRole) {
                switch (viewRole) {
                    case 'MEDICO UCI':
                        filtered = filtered.filter(p => {
                            const bed = beds.find(b => b.number === p.bedNumber);
                            return bed?.floor === 'UCI';
                        });
                        break;
                    case 'MEDICO UCE':
                        filtered = filtered.filter(p => {
                            const bed = beds.find(b => b.number === p.bedNumber);
                            return bed?.floor === 'UCE';
                        });
                        break;
                    case 'MEDICOS DE PISO':
                        filtered = filtered.filter(p => {
                            const bed = beds.find(b => b.number === p.bedNumber);
                            return bed && bed.floor !== 'UCI' && bed.floor !== 'UCE';
                        });
                        break;
                    case 'RESIDENTES TRAUMATO':
                        filtered = filtered.filter(p => {
                            const patientDocs = docs.filter(d => p.doctors.includes(d.name));
                            return patientDocs.some(d => (d.specialty || '').toUpperCase().includes('TRAUMATOLOGIA') || (d.specialty || '').toUpperCase().includes('ORTOPEDIA'));
                        });
                        break;
                    case 'RESIDENTES PEDIA':
                        filtered = filtered.filter(p => p.age < 15);
                        break;
                    case 'OBSTETRICIA':
                        const obsKeywords = ['embarazo', 'gesta', 'cesarea', 'parto', 'aborto', 'obito', 'fetal', 'placenta'];
                        filtered = filtered.filter(p => p.diagnoses.some(dx => obsKeywords.some(k => dx.toLowerCase().includes(k))));
                        break;
                    case 'CARDIOLOGIA':
                         filtered = filtered.filter(p => {
                            const patientDocs = docs.filter(d => p.doctors.includes(d.name));
                            return patientDocs.some(d => (d.specialty || '').toUpperCase().includes('CARDIOLOGIA'));
                         });
                         break;
                }
            }

            setPatients(filtered);
        }
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener('omni_db_update', handleUpdate);
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }, 20000);
        return () => {
            window.removeEventListener('omni_db_update', handleUpdate);
            clearInterval(timer);
        };
    }, [viewRole, filterByDoctor]);

    const toggleTask = (e: React.MouseEvent, patientId: string, taskId: string) => {
        e.stopPropagation();
        const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
        const updatedPatients = allPatients.map(p => {
            if (p.id === patientId) {
                const updatedTasks = p.pendingTasks.map(t => 
                    t.id === taskId ? { ...t, completed: !t.completed } : t
                );
                return { ...p, pendingTasks: updatedTasks };
            }
            return p;
        });
        localStorage.setItem('omni_patients', JSON.stringify(updatedPatients));
        window.dispatchEvent(new Event('omni_db_update'));
    };

    const isOverdue = (dueTime?: string) => {
        if (!dueTime) return false;
        return dueTime < currentTime;
    };

    const isNear = (dueTime?: string) => {
        if (!dueTime) return false;
        const [h, m] = dueTime.split(':').map(Number);
        const [ch, cm] = currentTime.split(':').map(Number);
        const diff = (h * 60 + m) - (ch * 60 + cm);
        return diff >= 0 && diff <= 30;
    };

    const sortedAndFilteredList = useMemo(() => {
        return patients.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.bedNumber.includes(searchTerm);
            const hasPending = (p.pendingTasks || []).some(t => !t.completed);
            return matchesSearch && (filterByPending ? hasPending : true);
        }).sort((a, b) => {
            const aOverdue = (a.pendingTasks || []).some(t => !t.completed && isOverdue(t.dueTime));
            const bOverdue = (b.pendingTasks || []).some(t => !t.completed && isOverdue(t.dueTime));
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            return a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true });
        });
    }, [patients, searchTerm, filterByPending, currentTime]);

    return (
        <div className="p-2 md:p-3 bg-slate-100 min-h-full space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 pl-1">
                    <div className="bg-yellow-500 p-1.5 rounded-lg shadow-sm">
                        <ClipboardList className="text-white" size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 leading-tight">Pendientes Clínicos</h2>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            <Clock size={10} /> {currentTime} • {sortedAndFilteredList.length} Pacientes ({viewRole || 'General'})
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 sm:w-48">
                        <Search className="absolute left-2 top-2 text-slate-400" size={12} />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                        />
                    </div>
                    <button 
                        onClick={() => setFilterByPending(!filterByPending)}
                        className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 ${filterByPending ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
                        title={filterByPending ? "Viendo solo pendientes" : "Viendo todos los pacientes"}
                    >
                        <Filter size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sortedAndFilteredList.map(p => {
                    const allTasks = p.pendingTasks || [];
                    const sortedTasks = [...allTasks].sort((a, b) => {
                        if (a.completed !== b.completed) return a.completed ? 1 : -1;
                        if (!a.completed) {
                            const aO = isOverdue(a.dueTime);
                            const bO = isOverdue(b.dueTime);
                            if (aO && !bO) return -1;
                            if (!aO && bO) return 1;
                            const aN = isNear(a.dueTime);
                            const bN = isNear(b.dueTime);
                            if (aN && !bN) return -1;
                            if (!aN && bN) return 1;
                            if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
                            if (a.dueTime) return -1;
                            if (b.dueTime) return 1;
                        }
                        return b.createdAt - a.createdAt;
                    });

                    const pendings = sortedTasks.filter(t => !t.completed);
                    const hasOverdue = pendings.some(t => isOverdue(t.dueTime));

                    return (
                        <div 
                            key={p.id} 
                            onClick={() => onPatientClick?.(p.id)}
                            className={`group bg-white rounded-xl border flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer ${hasOverdue ? 'border-red-200 ring-1 ring-red-50' : 'border-slate-200'}`}
                        >
                            <div className={`px-3 py-2 flex justify-between items-center transition-colors ${hasOverdue ? 'bg-red-50/50' : 'bg-slate-50/50 group-hover:bg-slate-100'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded font-mono shadow-sm ${hasOverdue ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
                                        {p.bedNumber}
                                    </span>
                                    <h3 className="text-[11px] font-bold text-slate-800 truncate">{p.name}</h3>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <span className={`text-[9px] font-black px-1.5 rounded-full border shadow-sm ${pendings.length > 0 ? 'bg-white border-yellow-200 text-yellow-700' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                        {pendings.length}
                                    </span>
                                    <ChevronRight size={12} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                                </div>
                            </div>

                            <div className="flex-1 p-2 space-y-1.5 bg-white">
                                {sortedTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 opacity-30">
                                        <CheckCircle size={24} className="text-slate-200" />
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Sin pendientes</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {sortedTasks.map(t => {
                                            const overdue = !t.completed && isOverdue(t.dueTime);
                                            const near = !t.completed && isNear(t.dueTime);
                                            
                                            return (
                                                <div 
                                                    key={t.id} 
                                                    className={`relative flex items-start gap-2 p-2 rounded-lg border transition-all ${t.completed ? 'bg-slate-50/50 border-transparent' : (overdue ? 'bg-white border-red-200 shadow-sm' : (near ? 'bg-white border-yellow-300 shadow-sm animate-pulse-slow' : 'bg-white border-slate-100 hover:border-slate-300'))}`}
                                                >
                                                    {!t.completed && (
                                                        <div className={`absolute left-0 top-1 bottom-1 w-1 rounded-r ${overdue ? 'bg-red-500' : (near ? 'bg-yellow-500' : 'bg-primary-400')}`} />
                                                    )}

                                                    <button 
                                                        onClick={(e) => toggleTask(e, p.id, t.id)}
                                                        className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${t.completed ? 'bg-emerald-500 border-emerald-500 text-white' : (overdue ? 'border-red-400 bg-white hover:bg-red-50' : 'border-slate-300 bg-white hover:border-primary-500')}`}
                                                    >
                                                        {t.completed && <CheckCircle size={10} strokeWidth={3} />}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[10px] leading-tight break-words font-medium ${t.completed ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                                                            {t.text}
                                                        </p>
                                                        {!t.completed && t.dueTime && (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${overdue ? 'bg-red-600 text-white border-red-600 shadow-sm' : (near ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100')}`}>
                                                                    {overdue ? <AlertCircle size={8} /> : <Clock size={8} />}
                                                                    {overdue ? 'VENCIDO ' : ''}{t.dueTime}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {sortedAndFilteredList.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-300">
                        <div className="bg-white p-6 rounded-full shadow-inner mb-4">
                            <LayoutGrid size={48} className="opacity-20" />
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No hay resultados</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">Ajusta los filtros o búsqueda</p>
                    </div>
                )}
            </div>
        </div>
    );
};
