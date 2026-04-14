
import React, { useState, useEffect } from 'react';
import { WorkLayout } from '../components/WorkLayout';
import { ModuleId, HospitalRole, User, StaffSelection, Doctor, AppNotification } from '../types';
import { LayoutGrid, Bell, Stethoscope, Activity, Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Settings } from './modules/Settings';
import { PatientFile } from './modules/PatientFile';
import { APP_MODULES } from '../moduleRegistry';
import { dbService } from '../services/dbService';

interface WorkspaceHubProps {
  onLogout: () => void;
  user: User;
}

export const WorkspaceHub: React.FC<WorkspaceHubProps> = ({ onLogout, user }) => {
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentViewRole, setCurrentViewRole] = useState<HospitalRole>(user?.role || 'ADMINISTRADOR');
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [staffIdentity, setStaffIdentity] = useState<StaffSelection | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Monitorizar conexión
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Suscripción Real-time de Notificaciones
  useEffect(() => {
    const roleToWatch = user?.role === 'ADMINISTRADOR' ? currentViewRole : user?.role;
    const unsubscribe = dbService.subscribeNotifications(
      roleToWatch, 
      staffIdentity?.doctorName, 
      (newNotifs) => setNotifications(newNotifs)
    );
    return () => unsubscribe();
  }, [currentViewRole, user, staffIdentity]);

  const visibleModules = APP_MODULES.filter(mod => !mod.allowedRoles || mod.allowedRoles.includes(currentViewRole));

  useEffect(() => {
    if (visibleModules.length > 0 && !activeModule && !selectedPatientId) {
      setActiveModule(visibleModules[0].id);
    }
  }, [currentViewRole, visibleModules, selectedPatientId]);

  const renderModuleContent = () => {
    if (selectedPatientId) {
        return <PatientFile 
                  patientId={selectedPatientId} 
                  onBack={() => setSelectedPatientId(null)} 
                  onDischarge={() => setSelectedPatientId(null)}
                  userRole={user?.role === 'ADMINISTRADOR' ? currentViewRole : user?.role}
               />;
    }
    const activeModuleDef = APP_MODULES.find(m => m.id === activeModule);
    if (activeModuleDef) {
        const Component = activeModuleDef.component;
        return <Component 
            user={user}
            viewRole={currentViewRole}
            onPatientClick={(id) => setSelectedPatientId(id)}
            filterByDoctor={staffIdentity?.doctorName}
        />;
    }
    return null;
  };

  const roles: HospitalRole[] = [
    'ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA', 'CARDIOLOGIA', 
    'FARMACIA', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 
    'MEDICOS DE PISO', 'MEDICO STAFF', 'MEDICO UCI', 'MEDICO UCE'
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden font-sans">
        {/* BARRA DE ESTADO DE SINCRONIZACIÓN */}
        <div className={`h-1 flex transition-colors duration-500 ${isOnline ? 'bg-emerald-500' : 'bg-orange-500'}`} title={isOnline ? 'Sincronizado con la nube' : 'Modo Offline: Cambios pendientes'}></div>

        <header className="h-12 border-b border-gray-200 bg-white shadow-sm flex items-center justify-between px-4 z-20 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-primary-600 text-white p-1 rounded-lg shadow-sm"><LayoutGrid size={18} /></div>
                <div>
                  <h1 className="text-sm font-black text-slate-800 tracking-tighter leading-none">
                    {staffIdentity?.doctorName || user?.role}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isOnline ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase">
                        <Wifi size={10} /> Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-orange-500 uppercase">
                        <WifiOff size={10} /> Local
                      </span>
                    )}
                  </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                 <div className="relative">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 relative">
                        <Bell size={20} />
                        {notifications.some(n => !n.read) && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                    </button>
                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase">Notificaciones Recientes</div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? <div className="p-8 text-center text-xs text-slate-400 italic">Sin novedades</div> : notifications.map(n => (
                                    <div key={n.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${!n.read ? 'bg-blue-50/50' : 'opacity-60'}`}>
                                        <h4 className="text-[11px] font-black text-slate-800 mb-1">{n.title}</h4>
                                        <p className="text-[10px] text-slate-600 leading-tight">{n.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>
                 {user?.role === 'ADMINISTRADOR' && <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-primary-600 transition-colors"><Activity size={20} /></button>}
                 <button onClick={onLogout} className="text-xs font-black text-red-500 hover:text-red-700 transition-colors uppercase tracking-tighter">Salir</button>
            </div>
        </header>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      
      {user?.role === 'ADMINISTRADOR' && (
        <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-center shrink-0 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vista:</span>
              <select value={currentViewRole} onChange={(e) => setCurrentViewRole(e.target.value as HospitalRole)} className="bg-slate-800 text-white text-[10px] font-black border border-slate-700 rounded-md py-1 px-4 outline-none hover:border-primary-500 transition-colors cursor-pointer">
                  {roles.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
        </div>
      )}

      {!selectedPatientId && (
          <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm overflow-hidden">
            <div className="flex gap-1 px-4 py-1.5 max-w-6xl mx-auto overflow-x-auto no-scrollbar">
              {visibleModules.map((module) => {
                const Icon = module.icon;
                const isActive = activeModule === module.id;
                return (
                  <button key={module.id} onClick={() => setActiveModule(module.id)} className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all border-2 whitespace-nowrap ${isActive ? 'bg-primary-600 border-primary-600 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                    <Icon size={14} />
                    <span className="font-black text-[10px] uppercase tracking-tighter">{module.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
      )}

      <div className="flex-1 overflow-hidden bg-slate-50">
        <div className="h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto h-full">
            {renderModuleContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
