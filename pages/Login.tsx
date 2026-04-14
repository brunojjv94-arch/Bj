
import React, { useState } from 'react';
import { Lock, User as UserIcon } from 'lucide-react';
import { HospitalRole, User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim().toLowerCase();
    
    const savedUsersStr = localStorage.getItem('omni_users');
    let allUsers: User[] = [];

    if (savedUsersStr) {
      allUsers = JSON.parse(savedUsersStr);
    } else {
      // Default Initial Users
      allUsers = [
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
      localStorage.setItem('omni_users', JSON.stringify(allUsers));
    }

    const foundUser = allUsers.find(
      u => u.username.toLowerCase() === cleanUser && u.password === password
    );

    if (foundUser) {
      onLoginSuccess(foundUser);
    } else {
      setError('Credenciales incorrectas.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
      <div className="w-full max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white tracking-tight">Acceso Corporativo</h1>
          <p className="text-slate-400 text-xs mt-1">Hospital Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Usuario</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon size={16} className="text-slate-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder-slate-600"
                placeholder="Ej: adminhosp"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder-slate-600"
                placeholder="••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-600 mt-2"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
};
