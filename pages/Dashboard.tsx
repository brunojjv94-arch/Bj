
import React from 'react';
import { ViewId } from '../types';
import { Rocket, Zap, Box, Activity } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: ViewId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const stats = [
    { label: 'Módulos Activos', value: '5', icon: Box, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Consultas IA Hoy', value: '128', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Estado del Sistema', value: 'Óptimo', icon: Activity, color: 'text-green-400', bg: 'bg-green-400/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Bienvenido a OmniBase</h1>
        <p className="text-slate-400">Plataforma centralizada y escalable para la gestión hospitalaria inteligente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center space-x-4">
            <div className={`p-3 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Acceso Rápido</h2>
          <div className="space-y-4">
            <div 
              onClick={() => onNavigate('idea-lab')}
              className="group cursor-pointer border border-slate-700 hover:border-primary-500/50 rounded-lg p-4 transition-all hover:bg-slate-750"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-500/10 p-2 rounded-md">
                    <Rocket className="w-5 h-5 text-primary-400" />
                  </div>
                  <h3 className="font-semibold text-slate-200 group-hover:text-primary-400 transition-colors">Laboratorio de Ideas</h3>
                </div>
                <span className="text-xs font-medium bg-primary-900 text-primary-300 px-2 py-1 rounded">Expansión</span>
              </div>
              <p className="text-sm text-slate-400 pl-12">
                Utiliza la IA de Gemini para analizar y refinar nuevas funcionalidades para el ecosistema hospitalario.
              </p>
            </div>

             <div className="border border-slate-700 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center py-8">
               <span className="text-slate-500 text-sm mb-2">Añade un nuevo módulo o vista personalizada</span>
               <button className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors">
                 + Crear Nueva Función
               </button>
             </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Arquitectura del Núcleo</h2>
          <div className="text-sm text-slate-300 space-y-4 leading-relaxed">
            <p>
              OmniBase utiliza un patrón <strong className="text-primary-400">Core/Shell</strong> diseñado para crecer sin límites técnicos. 
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 pl-2">
              <li>Módulos aislados y escalables en <code className="bg-slate-900 px-1 py-0.5 rounded text-xs font-mono">pages/modules</code></li>
              <li>Estado compartido y persistente vía <code className="bg-slate-900 px-1 py-0.5 rounded text-xs font-mono">localStorage</code></li>
              <li>Integración nativa con Modelos de Lenguaje (LLM) para automatización clínica.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
