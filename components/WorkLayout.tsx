import React from 'react';
import { LogOut, ArrowLeft, Grid, Settings } from 'lucide-react';

interface WorkLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  onSettingsClick?: () => void; // Nueva prop para el engranaje
}

export const WorkLayout: React.FC<WorkLayoutProps> = ({ 
  children, 
  onLogout, 
  title = "Espacio de Trabajo",
  showBackButton = false,
  onBack,
  onSettingsClick
}) => {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Barra superior */}
      <header className="h-16 border-b border-gray-200 bg-white shadow-sm flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full text-slate-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          
          <div className="flex items-center gap-2">
            {!showBackButton && <Grid className="text-primary-600" size={24} />}
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de Configuración (Engranaje) */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors mr-2"
              title="Configuración"
            >
              <Settings size={20} />
            </button>
          )}

          <div className="h-6 w-px bg-slate-200 mx-2"></div>

          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Cerrar Sesión"
          >
            <span className="hidden sm:inline">Salir</span>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Area de Trabajo */}
      <main className="flex-1 overflow-auto relative">
        {children}
      </main>
    </div>
  );
};