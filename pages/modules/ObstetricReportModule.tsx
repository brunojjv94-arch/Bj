
import React, { useEffect, useState } from 'react';
import { Patient } from '../../types';
import { Printer, RefreshCw, Baby, FileSpreadsheet } from 'lucide-react';

export const ObstetricReportModule: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatients = () => {
    setLoading(true);
    const allPatientsStr = localStorage.getItem('omni_patients');
    if (allPatientsStr) {
      const allPatients: Patient[] = JSON.parse(allPatientsStr);
      
      // OBSTETRIC KEYWORDS FILTER
      const obsKeywords = [
        'embarazo', 'gesta', 'gestación', 'puerperio', 'cesarea', 'cesárea', 
        'parto', 'aborto', 'obito', 'fetal', 'placenta', 'preclamsia', 
        'eclampsia', 'hellp', 'hiperemesis', 'amenaza', 'útero', 'utero', 'anexial'
      ];

      // Filter: Active OR Discharged (History) that matches Obstetric Criteria
      const obsPatients = allPatients.filter(p => {
        const hasObsData = p.obstetricData && Object.keys(p.obstetricData).length > 0;
        const hasObsDiagnosis = p.diagnoses.some(dx => obsKeywords.some(k => dx.toLowerCase().includes(k)));
        return hasObsData || hasObsDiagnosis;
      });
      
      // Sort: Active first, then by discharge date (recent first)
      obsPatients.sort((a, b) => {
          if (!a.dischargeDate && b.dischargeDate) return -1;
          if (a.dischargeDate && !b.dischargeDate) return 1;
          if (!a.dischargeDate && !b.dischargeDate) return a.bedNumber.localeCompare(b.bedNumber);
          return new Date(b.dischargeDate!).getTime() - new Date(a.dischargeDate!).getTime();
      });

      setPatients(obsPatients);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPatients();
    const handleUpdate = () => loadPatients();
    window.addEventListener('omni_db_update', handleUpdate);
    return () => window.removeEventListener('omni_db_update', handleUpdate);
  }, []);

  const calculateStayDays = (start: string, end?: string) => {
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : new Date();
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days;
  };

  const handleExportExcel = () => {
      const headers = [
          'Fecha Ingreso',
          'Fecha Egreso',
          'Dias Estadia',
          'HC',
          'Paciente', 
          'Edad',
          'Seguro',
          'Dx Ingreso',
          'Complicaciones',
          'Dx Alta',
          'Medico Cargo',
          'Obs Ingreso',
          'Obs Alta'
      ];

      const rows = patients.map(p => {
          const obs = p.obstetricData || {};
          const days = calculateStayDays(p.admissionDate, p.dischargeDate);
          
          const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

          return [
              p.admissionDate,
              p.dischargeDate || '',
              days,
              escape(p.hc),
              escape(p.name),
              p.age,
              escape(p.insurance),
              escape(p.admissionDiagnosis || p.diagnoses[0] || ''),
              escape(obs.pregnancyComplications || ''),
              escape(p.dischargeDiagnosis || ''),
              escape(p.doctors.join('; ')),
              escape(p.admittingActor || ''),
              escape(p.dischargingActor || '')
          ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Reporte_Obstetrico_Completo_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handlePrintReport = () => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
          const date = new Date().toLocaleDateString();
          let rowsHtml = '';
          
          patients.forEach(p => {
              const obs = p.obstetricData || {};
              const days = calculateStayDays(p.admissionDate, p.dischargeDate);
              
              rowsHtml += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td>${p.admissionDate}</td>
                    <td>${p.dischargeDate || '-'}</td>
                    <td>${days}</td>
                    <td>${p.hc}</td>
                    <td>${p.name} (${p.age}a)</td>
                    <td>${p.insurance}</td>
                    <td>${p.admissionDiagnosis || '-'}</td>
                    <td>${obs.pregnancyComplications || '-'}</td>
                    <td>${p.dischargeDiagnosis || '-'}</td>
                </tr>
              `;
          });

          printWindow.document.write(`
            <html>
              <head>
                <title>Reporte Obstétrico</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 10px; font-size: 10px; }
                  table { width: 100%; border-collapse: collapse; }
                  th { text-align: left; background: #ffffff; padding: 5px; border-bottom: 1px solid #000; font-weight: bold; }
                  td { padding: 5px; background: #ffffff; }
                  h1 { font-size: 16px; text-align: center; }
                </style>
              </head>
              <body>
                <h1>REPORTE DE OBSTETRICIA - ${date}</h1>
                <table>
                    <thead>
                        <tr>
                            <th>Ingreso</th>
                            <th>Egreso</th>
                            <th>Días</th>
                            <th>HC</th>
                            <th>Paciente</th>
                            <th>Seguro</th>
                            <th>Dx Ingreso</th>
                            <th>Complicaciones</th>
                            <th>Dx Alta</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
              </body>
            </html>
          `);
          printWindow.document.close();
      }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando reporte...</div>;

  return (
    <div className="p-4 bg-slate-50 min-h-full">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="bg-pink-100 text-pink-600 p-2 rounded-lg">
                    <Baby size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Reporte Obstétrico Integral</h2>
                    <p className="text-xs text-slate-500">Histórico y Activos ({patients.length} registros)</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={loadPatients} className="p-2 text-slate-500 hover:bg-white rounded-full transition-colors"><RefreshCw size={18}/></button>
                <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-green-700 shadow-md transition-colors">
                    <FileSpreadsheet size={16} /> Excel
                </button>
                <button onClick={handlePrintReport} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700 shadow-md transition-colors">
                    <Printer size={16} /> Imprimir
                </button>
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-left min-w-[1200px]">
                <thead className="bg-white border-b border-slate-200">
                    <tr>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">F. Ingreso</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">F. Egreso</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">Días</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">Paciente / HC</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">Seguro</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">Dx Ingreso</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-pink-600 uppercase bg-white">Complicaciones</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">Dx Alta</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase bg-white">Responsables</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {patients.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm bg-white">No hay registros obstétricos.</td></tr>
                    ) : (
                        patients.map(p => {
                            const obs = p.obstetricData || {};
                            const days = calculateStayDays(p.admissionDate, p.dischargeDate);
                            const isActive = !p.dischargeDate;

                            return (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors bg-white">
                                    <td className="px-3 py-2 text-[10px] text-slate-700 bg-white">{p.admissionDate}</td>
                                    <td className="px-3 py-2 text-[10px] font-bold text-slate-700 bg-white">{p.dischargeDate || <span className="text-green-600">Activo</span>}</td>
                                    <td className="px-3 py-2 text-[10px] text-slate-700 bg-white">{days}</td>
                                    <td className="px-3 py-2 bg-white">
                                        <div className="text-[10px] font-bold text-slate-800">{p.name} <span className="text-slate-500 font-normal">({p.age}a)</span></div>
                                        <div className="text-[9px] text-slate-400 font-mono">HC: {p.hc}</div>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 bg-white">{p.insurance}</td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 max-w-[150px] truncate bg-white" title={p.admissionDiagnosis || p.diagnoses[0]}>
                                        {p.admissionDiagnosis || p.diagnoses[0]}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-pink-700 font-medium bg-white max-w-[150px] truncate" title={obs.pregnancyComplications}>
                                        {obs.pregnancyComplications || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 max-w-[150px] truncate bg-white" title={p.dischargeDiagnosis}>
                                        {p.dischargeDiagnosis || '-'}
                                    </td>
                                    <td className="px-3 py-2 bg-white">
                                        <div className="text-[9px] text-slate-500"><span className="font-bold">Ing:</span> {p.admittingActor || '-'}</div>
                                        <div className="text-[9px] text-slate-500"><span className="font-bold">Alt:</span> {p.dischargingActor || '-'}</div>
                                        <div className="text-[9px] text-slate-500"><span className="font-bold">Dr:</span> {p.doctors[0] || '-'}</div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
