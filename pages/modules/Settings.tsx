
import React, { useState, useEffect, useMemo } from 'react';
import { User, Stethoscope, Bed, Database, Plus, Trash2, Edit2, Save, X, Phone, Wrench, ShieldCheck, Hash, Users, Baby, Activity, FileText, Briefcase, Search, ChevronRight, ChevronDown, Eye, EyeOff, Heart, AlertCircle, Syringe } from 'lucide-react';
import { Doctor, Bed as BedType, FloorName, User as UserType, Patient, HospitalRole, Insurance } from '../../types';

interface SettingsProps {
  onClose: () => void;
}

type SettingsTab = 'users' | 'doctors' | 'beds' | 'database' | 'insurances';

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  const [users, setUsers] = useState<UserType[]>(() => {
    const saved = localStorage.getItem('omni_users');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'u1', username: 'admin', password: '1212', role: 'ADMINISTRADOR' },
      { id: 'u2', username: 'adminhosp', password: '1234', role: 'ADMISION HOSPITALARIA' },
      { id: 'u3', username: 'cartas', password: '1234', role: 'CARTAS DE GARANTIA' },
      { id: 'u4', username: 'cardiologia', password: '1234', role: 'CARDIOLOGIA' },
      { id: 'u5', username: 'farmacia', password: '1234', role: 'FARMACIA' },
      { id: 'u6', username: 'resioyt', password: '1234', role: 'RESIDENTES TRAUMATO' },
      { id: 'u7', username: 'resiped', password: '1234', role: 'RESIDENTES PEDIA' },
      { id: 'u8', username: 'obste', password: '1234', role: 'OBSTETRICIA' },
      { id: 'u9', username: 'medpiso', password: '1234', role: 'MEDICOS DE PISO' },
      { id: 'u10', username: 'medstaff', password: '1234', role: 'MEDICO STAFF' },
      { id: 'u11', username: 'meduci', password: '1234', role: 'MEDICO UCI' },
      { id: 'u12', username: 'meduce', password: '1234', role: 'MEDICO UCE' },
      { id: 'u13', username: 'enfpiso', password: '1234', role: 'ENFERMERIA PISO' },
      { id: 'u14', username: 'enfuci', password: '1234', role: 'ENFERMERIA UCI' },
      { id: 'u15', username: 'enfuce', password: '1234', role: 'ENFERMERIA UCE' },
    ];
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => {
    const saved = localStorage.getItem('omni_doctors');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [beds, setBeds] = useState<BedType[]>(() => {
    const saved = localStorage.getItem('omni_beds');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [dbPatients, setDbPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('omni_patients');
    return saved ? JSON.parse(saved) : [];
  });

  // Updated Insurance State with Migration Logic
  const [insurances, setInsurances] = useState<Insurance[]>(() => {
    const saved = localStorage.getItem('omni_insurances');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Migration check: if array of strings, convert to objects
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
                return parsed.map((s: string) => ({ 
                    name: s, 
                    type: s === 'PARTICULAR' ? 'PARTICULAR' : 'EPS' // Default migration type
                }));
            }
            return parsed;
        } catch(e) { return []; }
    }
    return [
        { name: 'RIMAC', type: 'EPS' },
        { name: 'PACIFICO', type: 'EPS' },
        { name: 'MAPFRE', type: 'EPS' },
        { name: 'LA POSITIVA', type: 'EPS' },
        { name: 'PARTICULAR', type: 'PARTICULAR' }
    ];
  });

  useEffect(() => localStorage.setItem('omni_users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('omni_doctors', JSON.stringify(doctors)), [doctors]);
  useEffect(() => localStorage.setItem('omni_beds', JSON.stringify(beds)), [beds]);
  useEffect(() => localStorage.setItem('omni_patients', JSON.stringify(dbPatients)), [dbPatients]);
  useEffect(() => localStorage.setItem('omni_insurances', JSON.stringify(insurances)), [insurances]);

  const [userSearch, setUserSearch] = useState('');
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [tempUser, setTempUser] = useState<UserType | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'MEDICO STAFF' as any });

  const [newDoctor, setNewDoctor] = useState({ name: '', specialty: '', phone: '', cmp: '' });
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [tempDoctor, setTempDoctor] = useState<Doctor | null>(null);

  const [newBed, setNewBed] = useState({ number: '', floor: 'Piso 2' as FloorName });
  
  // Updated New Insurance State
  const [newInsuranceName, setNewInsuranceName] = useState('');
  const [newInsuranceType, setNewInsuranceType] = useState<Insurance['type']>('EPS');

  const handleAddUser = () => {
    if (newUser.username && newUser.password) {
      setUsers([...users, { id: Date.now().toString(), ...newUser }]);
      setNewUser({ username: '', password: '', role: 'MEDICO STAFF' });
      setExpandedRoles(prev => new Set(prev).add(newUser.role));
    }
  };
  const startEditUser = (user: UserType) => { setEditingUserId(user.id); setTempUser({ ...user }); };
  const saveEditUser = () => { if (tempUser) { setUsers(users.map(u => u.id === tempUser.id ? tempUser : u)); setEditingUserId(null); setTempUser(null); } };
  const handleDeleteUser = (id: string) => { if (users.find(u => u.id === id)?.username === 'admin') return; setUsers(users.filter(u => u.id !== id)); };
  
  const toggleRoleExpand = (role: string) => {
      const newSet = new Set(expandedRoles);
      if (newSet.has(role)) newSet.delete(role);
      else newSet.add(role);
      setExpandedRoles(newSet);
  };

  const togglePasswordVisibility = (userId: string) => {
      const newSet = new Set(visiblePasswords);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      setVisiblePasswords(newSet);
  };

  const handleAddDoctor = () => { if (newDoctor.name) { setDoctors([...doctors, { id: Date.now().toString(), ...newDoctor }]); setNewDoctor({ name: '', specialty: '', phone: '', cmp: '' }); } };
  const startEditDoctor = (doc: Doctor) => { setEditingDoctorId(doc.id); setTempDoctor({ ...doc }); };
  const saveEditDoctor = () => { if (tempDoctor) { setDoctors(doctors.map(d => d.id === tempDoctor.id ? tempDoctor : d)); setEditingDoctorId(null); setTempDoctor(null); } };
  const handleDeleteDoctor = (id: string) => { setDoctors(doctors.filter(d => d.id !== id)); };

  const handleAddBed = () => {
    if (!newBed.number) return;
    const bed: BedType = { id: Date.now().toString(), number: newBed.number, floor: newBed.floor, status: 'available' };
    setBeds([...beds, bed]);
    setNewBed({ number: '', floor: 'Piso 2' });
  };
  const handleDeleteBed = (id: string) => { if (!beds.find(b => b.id === id)?.patientId) setBeds(beds.filter(b => b.id !== id)); };
  const toggleMaintenance = (id: string) => {
      setBeds(beds.map(b => {
          if (b.id === id) {
              if (b.status === 'available') return { ...b, status: 'maintenance' };
              if (b.status === 'maintenance') return { ...b, status: 'available' };
          }
          return b;
      }));
  };

  const handleAddInsurance = () => { 
      if (newInsuranceName && !insurances.some(i => i.name === newInsuranceName)) { 
          setInsurances([...insurances, { name: newInsuranceName, type: newInsuranceType }]); 
          setNewInsuranceName(''); 
          setNewInsuranceType('EPS');
      } 
  };
  const handleDeleteInsurance = (name: string) => { setInsurances(insurances.filter(i => i.name !== name)); };

  const handleDeletePatient = (id: string) => {
      if(!confirm("¿Eliminar permanentemente del historial?")) return;
      setDbPatients(dbPatients.filter(p => p.id !== id));
  };

  const groupedUsers = useMemo(() => {
      const filtered = users.filter(u => 
          u.username.toLowerCase().includes(userSearch.toLowerCase()) || 
          u.role.toLowerCase().includes(userSearch.toLowerCase())
      );

      const groups: Record<string, UserType[]> = {};
      filtered.forEach(u => {
          if (!groups[u.role]) groups[u.role] = [];
          groups[u.role].push(u);
      });
      return groups;
  }, [users, userSearch]);

  const getRoleMetadata = (role: string) => {
      switch(role) {
          case 'ADMINISTRADOR': return { icon: ShieldCheck, color: 'bg-slate-800 text-white', label: 'Administración' };
          case 'MEDICO STAFF': return { icon: Stethoscope, color: 'bg-indigo-100 text-indigo-700', label: 'Médicos de Staff (Titulares)' };
          case 'OBSTETRICIA': return { icon: Baby, color: 'bg-pink-100 text-pink-700', label: 'Equipo Obstetricia' };
          case 'RESIDENTES TRAUMATO': return { icon: Wrench, color: 'bg-emerald-100 text-emerald-700', label: 'Residencia Traumatología' };
          case 'RESIDENTES PEDIA': return { icon: Baby, color: 'bg-blue-100 text-blue-700', label: 'Residencia Pediatría' };
          case 'MEDICOS DE PISO': return { icon: Activity, color: 'bg-cyan-100 text-cyan-700', label: 'Médicos de Piso / Guardia' };
          case 'MEDICO UCI': return { icon: Heart, color: 'bg-red-100 text-red-700', label: 'Médicos UCI' };
          case 'MEDICO UCE': return { icon: Activity, color: 'bg-blue-100 text-blue-700', label: 'Médicos UCE' };
          case 'ADMISION HOSPITALARIA': return { icon: FileText, color: 'bg-orange-100 text-orange-700', label: 'Admisión' };
          case 'CARTAS DE GARANTIA': return { icon: FileText, color: 'bg-yellow-100 text-yellow-700', label: 'Seguros y Cartas' };
          case 'CARDIOLOGIA': return { icon: Heart, color: 'bg-rose-100 text-rose-700', label: 'Cardiología' };
          case 'FARMACIA': return { icon: Activity, color: 'bg-teal-100 text-teal-700', label: 'Farmacia' };
          case 'ENFERMERIA PISO': return { icon: Syringe, color: 'bg-purple-100 text-purple-700', label: 'Enfermería Hospitalización' };
          case 'ENFERMERIA UCI': return { icon: Syringe, color: 'bg-red-50 text-red-600', label: 'Enfermería UCI' };
          case 'ENFERMERIA UCE': return { icon: Syringe, color: 'bg-blue-50 text-blue-600', label: 'Enfermería UCE' };
          default: return { icon: Users, color: 'bg-slate-100 text-slate-700', label: role };
      }
  };

  const hospitalRoles: HospitalRole[] = [
      'ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA', 'CARDIOLOGIA', 
      'FARMACIA', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 
      'MEDICOS DE PISO', 'MEDICO STAFF', 'MEDICO UCI', 'MEDICO UCE',
      'ENFERMERIA PISO', 'ENFERMERIA UCI', 'ENFERMERIA UCE'
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wrench className="text-primary-600" /> Configuración del Sistema</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex bg-white border-b border-slate-200 px-4 overflow-x-auto">
          {[
            { id: 'users', label: 'Equipos & Accesos', icon: Users },
            { id: 'doctors', label: 'Directorio Médico', icon: Briefcase },
            { id: 'beds', label: 'Camas', icon: Bed },
            { id: 'insurances', label: 'Seguros', icon: ShieldCheck },
            { id: 'database', label: 'Base de Datos', icon: Database },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-700 bg-primary-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 space-y-3 sticky top-0 z-20">
                  <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar usuario o equipo..." 
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                      />
                  </div>
                  <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-slate-100">
                    <div className="flex-1 min-w-[120px]"><label className="text-[10px] font-bold text-slate-400 uppercase">Nuevo Usuario</label><input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-white text-slate-900" placeholder="usuario.nombre" /></div>
                    <div className="flex-1 min-w-[120px]"><label className="text-[10px] font-bold text-slate-400 uppercase">Contraseña</label><input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-white text-slate-900" placeholder="1234" /></div>
                    <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase">Asignar a Equipo</label>
                      <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full h-8 text-xs border rounded px-2 bg-white text-slate-900">
                        {hospitalRoles.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </div>
                    <button onClick={handleAddUser} className="h-8 bg-primary-600 text-white px-4 rounded text-xs font-bold flex items-center gap-1 hover:bg-primary-700 shadow-sm"><Plus size={14}/> Crear</button>
                  </div>
              </div>

              <div className="space-y-2">
                  {Object.entries(groupedUsers).length === 0 ? (
                      <div className="text-center text-slate-400 text-xs py-8">No se encontraron usuarios.</div>
                  ) : (
                      Object.entries(groupedUsers).map(([role, roleUsers]) => {
                          const users = roleUsers as UserType[];
                          const meta = getRoleMetadata(role);
                          const isExpanded = expandedRoles.has(role);

                          return (
                              <div key={role} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm transition-all duration-200">
                                  <div 
                                    className={`px-3 py-2 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-colors ${meta.color}`}
                                    onClick={() => toggleRoleExpand(role)}
                                  >
                                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                      <meta.icon size={16} />
                                      <span className="text-xs font-bold uppercase tracking-wide flex-1">{meta.label}</span>
                                      <span className="bg-white/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">{users.length}</span>
                                  </div>

                                  {isExpanded && (
                                      <div className="divide-y divide-slate-100 bg-white">
                                          {users.map(u => (
                                              <div key={u.id} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                                  {editingUserId === u.id ? (
                                                      <div className="flex gap-2 w-full items-center animate-in fade-in">
                                                          <div className="flex-1 space-y-1">
                                                              <input className="block w-full border rounded px-2 py-1 text-xs bg-white" value={tempUser!.username} onChange={e => setTempUser({...tempUser!, username: e.target.value})} placeholder="Usuario" />
                                                              <input className="block w-full border rounded px-2 py-1 text-xs bg-white" value={tempUser!.password} onChange={e => setTempUser({...tempUser!, password: e.target.value})} placeholder="Clave" />
                                                          </div>
                                                          <div className="flex flex-col gap-1 ml-2">
                                                              <button onClick={saveEditUser} className="bg-green-100 text-green-700 p-1.5 rounded hover:bg-green-200"><Save size={14}/></button>
                                                              <button onClick={() => setEditingUserId(null)} className="bg-slate-100 text-slate-500 p-1.5 rounded hover:bg-slate-200"><X size={14}/></button>
                                                          </div>
                                                      </div>
                                                  ) : (
                                                      <>
                                                          <div className="flex items-center gap-3">
                                                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                                  {u.username.substring(0,2)}
                                                              </div>
                                                              <div className="flex flex-col">
                                                                  <span className="text-xs font-bold text-slate-700">{u.username}</span>
                                                                  <div className="flex items-center gap-2 mt-0.5">
                                                                      <span className="text-[10px] text-slate-400 font-mono tracking-wider bg-slate-50 px-1.5 rounded border border-slate-100">
                                                                          {visiblePasswords.has(u.id) ? u.password : '••••••••'}
                                                                      </span>
                                                                      <button 
                                                                        onClick={() => togglePasswordVisibility(u.id)} 
                                                                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                                                        title={visiblePasswords.has(u.id) ? "Ocultar" : "Mostrar"}
                                                                      >
                                                                          {visiblePasswords.has(u.id) ? <EyeOff size={10} /> : <Eye size={10} />}
                                                                      </button>
                                                                  </div>
                                                              </div>
                                                          </div>
                                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                              <button onClick={() => startEditUser(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Edit2 size={14}/></button>
                                                              {u.username !== 'admin' && (
                                                                  <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors" title="Eliminar"><Trash2 size={14}/></button>
                                                              )}
                                                          </div>
                                                      </>
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          );
                      })
                  )}
              </div>
            </div>
          )}
          
          {/* ... Rest of tabs remain similar ... */}
          {activeTab === 'doctors' && (
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b border-slate-100 pb-1">Registrar Nuevo Médico</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                  <div className="md:col-span-2 lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nombre Completo</label>
                    <input type="text" value={newDoctor.name} onChange={e => setNewDoctor({...newDoctor, name: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-white" placeholder="Dr. Ejemplo" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Especialidad</label>
                    <input type="text" value={newDoctor.specialty} onChange={e => setNewDoctor({...newDoctor, specialty: e.target.value.toUpperCase()})} className="w-full h-8 text-xs border rounded px-2 bg-white" placeholder="CARDIOLOGÍA" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CMP</label>
                    <input type="text" value={newDoctor.cmp} onChange={e => setNewDoctor({...newDoctor, cmp: e.target.value})} className="w-full h-8 text-xs border rounded px-2 font-mono bg-white" placeholder="00000" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Celular</label>
                    <input type="text" value={newDoctor.phone} onChange={e => setNewDoctor({...newDoctor, phone: e.target.value})} className="w-full h-8 text-xs border rounded px-2 font-mono bg-white" placeholder="9..." />
                  </div>
                  <button onClick={handleAddDoctor} className="h-8 bg-primary-600 text-white px-4 rounded text-xs font-bold hover:bg-primary-700">Añadir</button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-white text-[10px] text-slate-500 font-bold uppercase border-b border-slate-200">
                    <tr><th className="px-4 py-2 bg-white">Médico</th><th className="px-4 py-2 bg-white">Especialidad</th><th className="px-4 py-2 bg-white">CMP</th><th className="px-4 py-2 bg-white">Contacto</th><th className="px-4 py-2 text-right bg-white">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctors.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        {editingDoctorId === doc.id ? (
                          <td colSpan={5} className="p-2 bg-white">
                             <div className="flex gap-2 items-center bg-white border border-slate-200 p-2 rounded shadow-sm">
                               <input className="flex-1 border rounded px-2 py-1 text-xs bg-white" value={tempDoctor!.name} onChange={e => setTempDoctor({...tempDoctor!, name: e.target.value})} />
                               <input className="w-32 border rounded px-2 py-1 text-xs bg-white" value={tempDoctor!.specialty} onChange={e => setTempDoctor({...tempDoctor!, specialty: e.target.value})} />
                               <input className="w-20 border rounded px-2 py-1 text-xs bg-white" value={tempDoctor!.cmp} onChange={e => setTempDoctor({...tempDoctor!, cmp: e.target.value})} />
                               <input className="w-24 border rounded px-2 py-1 text-xs bg-white" value={tempDoctor!.phone} onChange={e => setTempDoctor({...tempDoctor!, phone: e.target.value})} />
                               <button onClick={saveEditDoctor} className="bg-green-600 text-white p-1 rounded"><Save size={14}/></button>
                               <button onClick={() => setEditingDoctorId(null)} className="bg-slate-400 text-white p-1 rounded"><X size={14}/></button>
                             </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-2 font-bold text-slate-700 text-xs bg-white">{doc.name}</td>
                            <td className="px-4 py-2 text-primary-600 font-bold text-[10px] bg-white">{doc.specialty}</td>
                            <td className="px-4 py-2 font-mono text-[10px] bg-white">{doc.cmp}</td>
                            <td className="px-4 py-2 font-mono text-[10px] bg-white">{doc.phone}</td>
                            <td className="px-4 py-2 text-right bg-white">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => startEditDoctor(doc)} className="p-1 text-slate-400 hover:text-blue-600"><Edit2 size={14}/></button>
                                <button onClick={() => handleDeleteDoctor(doc.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'beds' && (
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nro Cama</label>
                  <input type="text" value={newBed.number} onChange={e => setNewBed({...newBed, number: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-white" placeholder="Ej: 201" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Área / Piso</label>
                  <select value={newBed.floor} onChange={e => setNewBed({...newBed, floor: e.target.value as any})} className="w-full h-8 text-xs border rounded px-2 bg-white">
                    <option value="Piso 2">Piso 2</option><option value="Piso 3">Piso 3</option><option value="UCI">UCI</option><option value="UCE">UCE</option><option value="DILA">DILA</option>
                  </select>
                </div>
                <button onClick={handleAddBed} className="h-8 bg-primary-600 text-white px-6 rounded text-xs font-bold hover:bg-primary-700 shadow-sm"><Plus size={14}/> Crear Cama</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {beds.map(bed => (
                  <div key={bed.id} className={`p-2 rounded-lg border flex flex-col items-center justify-between gap-2 relative ${bed.status === 'occupied' ? 'bg-blue-50 border-blue-200' : (bed.status === 'maintenance' ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 shadow-sm')}`}>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-black text-slate-700">{bed.number}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{bed.floor}</span>
                    </div>
                    <div className="flex gap-1 w-full">
                       <button onClick={() => toggleMaintenance(bed.id)} className={`flex-1 p-1 rounded text-white flex items-center justify-center ${bed.status === 'maintenance' ? 'bg-orange-500' : 'bg-slate-300 hover:bg-orange-400'}`} title="Mantenimiento"><Wrench size={10}/></button>
                       {!bed.patientId && <button onClick={() => handleDeleteBed(bed.id)} className="flex-1 p-1 rounded bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><Trash2 size={10}/></button>}
                    </div>
                    {bed.status === 'occupied' && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'insurances' && (
            <div className="space-y-4 max-w-lg">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Configuración de Seguros</h4>
                    <div className="flex gap-2 items-end">
                        <div className="flex-[2]">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nombre Aseguradora</label>
                            <input type="text" value={newInsuranceName} onChange={e => setNewInsuranceName(e.target.value.toUpperCase())} className="w-full h-8 text-xs border rounded px-2 bg-white" placeholder="PACIFICO, RIMAC..." />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modalidad</label>
                            <select value={newInsuranceType} onChange={e => setNewInsuranceType(e.target.value as any)} className="w-full h-8 text-xs border rounded px-2 font-bold text-slate-700 bg-white">
                                <option value="EPS">EPS</option>
                                <option value="SCTR">SCTR</option>
                                <option value="SOAT">SOAT</option>
                                <option value="FOLA">FOLA</option>
                                <option value="PARTICULAR">PARTICULAR</option>
                                <option value="CONVENIO">CONVENIO</option>
                                <option value="OTRO">OTRO</option>
                            </select>
                        </div>
                        <button onClick={handleAddInsurance} className="h-8 bg-primary-600 text-white px-4 rounded text-xs font-bold flex items-center gap-1"><Plus size={14}/> Agregar</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {insurances.map(ins => (
                        <div key={ins.name + ins.type} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${ins.type === 'PARTICULAR' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ins.type === 'SOAT' || ins.type === 'SCTR' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    {ins.type}
                                </span>
                                <span className="text-xs font-bold text-slate-700">{ins.name}</span>
                            </div>
                            <button onClick={() => handleDeleteInsurance(ins.name)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">Esta sección permite gestionar el archivo histórico del sistema. Tenga cuidado al eliminar registros, ya que esta acción no se puede deshacer.</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase">Archivo Histórico ({dbPatients.length})</h4>
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-left">
                    <thead className="bg-white text-[10px] text-slate-500 font-bold uppercase border-b border-slate-200">
                        <tr><th className="px-4 py-2 bg-white">Paciente</th><th className="px-4 py-2 bg-white">DNI</th><th className="px-4 py-2 bg-white">Ingreso</th><th className="px-4 py-2 bg-white">Egreso</th><th className="px-4 py-2 text-right bg-white">Acción</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {dbPatients.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 text-xs">
                            <td className="px-4 py-2 font-bold text-slate-700 bg-white">{p.name}</td>
                            <td className="px-4 py-2 font-mono bg-white">{p.dni}</td>
                            <td className="px-4 py-2 bg-white">{p.admissionDate}</td>
                            <td className="px-4 py-2 font-bold text-slate-600 bg-white">{p.dischargeDate || 'ACTIVO'}</td>
                            <td className="px-4 py-2 text-right bg-white"><button onClick={() => handleDeletePatient(p.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button></td>
                        </tr>
                        ))}
                        {dbPatients.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic bg-white">No hay registros en la base de datos.</td></tr>}
                    </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
