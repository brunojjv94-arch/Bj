
import React from 'react';
import { Activity, LayoutGrid, Archive, FileText, FileCheck, ClipboardList } from 'lucide-react';
import { ModuleDefinition, ModuleContextProps } from './types';

// Importación de componentes de módulos
import { ActivePatients } from './pages/modules/ActivePatients';
import { BedMap } from './pages/modules/BedMap';
import { PatientHistory } from './pages/modules/PatientHistory';
import { ObstetricReportModule } from './pages/modules/ObstetricReportModule';
import { WarrantyModule } from './pages/modules/WarrantyModule';
import { PendingTasksModule } from './pages/modules/PendingTasksModule';

/**
 * REGISTRO CENTRAL DE MÓDULOS
 */
export const APP_MODULES: ModuleDefinition[] = [
  {
    id: 'active-patients',
    title: 'Pacientes',
    description: 'Hospitalización Activa',
    icon: Activity,
    component: (props: ModuleContextProps) => (
      <ActivePatients 
        filterByDoctor={props.filterByDoctor} 
        viewRole={props.viewRole} 
        onPatientClick={props.onPatientClick} 
      />
    ),
    allowedRoles: [
      'ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA', 
      'CARDIOLOGIA', 'FARMACIA', 'RESIDENTES TRAUMATO', 
      'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO', 'MEDICO STAFF',
      'MEDICO UCI', 'MEDICO UCE'
    ]
  },
  {
    id: 'pending-tasks',
    title: 'Pendientes',
    description: 'Control de Tareas y Horarios',
    icon: ClipboardList,
    component: (props: ModuleContextProps) => (
      <PendingTasksModule 
        onPatientClick={props.onPatientClick} 
        viewRole={props.viewRole}
        filterByDoctor={props.filterByDoctor}
      />
    ),
    allowedRoles: [
      'ADMINISTRADOR', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 
      'MEDICOS DE PISO', 'OBSTETRICIA', 'CARDIOLOGIA', 
      'MEDICO STAFF', 'MEDICO UCI', 'MEDICO UCE'
    ]
  },
  {
    id: 'bed-map',
    title: 'Mapa de Camas',
    description: 'Gestión de Pisos y Áreas',
    icon: LayoutGrid,
    component: (props: ModuleContextProps) => (
      <BedMap 
        user={props.user} 
        viewRole={props.viewRole} 
        onPatientClick={props.onPatientClick} 
        sessionUser={props.sessionUser}
      />
    ),
    allowedRoles: [
      'ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA', 
      'CARDIOLOGIA', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 
      'OBSTETRICIA', 'MEDICOS DE PISO', 'MEDICO STAFF',
      'MEDICO UCI', 'MEDICO UCE'
    ]
  },
  {
    id: 'warranty-management',
    title: 'Garantías Asegurados',
    description: 'Cartas y Trámites de Seguros',
    icon: FileCheck,
    component: (props: ModuleContextProps) => (
      <WarrantyModule sessionUser={props.sessionUser || 'usuario'} />
    ),
    allowedRoles: [
      'ADMINISTRADOR', 'ADMISION HOSPITALARIA', 'CARTAS DE GARANTIA'
    ]
  },
  {
    id: 'history',
    title: 'Historial',
    description: 'Archivo de Altas Médicas',
    icon: Archive,
    component: () => <PatientHistory />,
    allowedRoles: [
      'ADMINISTRADOR', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'MEDICOS DE PISO',
      'MEDICO UCI', 'MEDICO UCE'
    ]
  },
  {
    id: 'obstetric-report',
    title: 'Reporte Obstétrico',
    description: 'Censo y Guardia Ginecológica',
    icon: FileText,
    component: () => <ObstetricReportModule />,
    allowedRoles: [
      'ADMINISTRADOR', 'OBSTETRICIA'
    ]
  }
];
