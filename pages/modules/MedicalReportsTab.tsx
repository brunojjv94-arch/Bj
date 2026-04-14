import React, { useState, useEffect } from 'react';
import { Patient, HospitalRole, MedicalReport } from '../../types';
import { FileText, Sparkles, AlertCircle, Save, History, Eye, X, ArrowRight, CheckSquare, Square, Printer, User, Calendar, Folder, FileDown } from 'lucide-react';
import { generateMedicalReport } from '../../services/geminiService';

interface MedicalReportsTabProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  userRole?: HospitalRole;
  fixedType?: string; // New prop to lock the report type (e.g. "Epicrisis")
}

const REPORT_TYPES = [
  'Epicrisis',
  'Informe Médico',
  'Alta Médica',
  'Constancia de Hospitalización',
  'Referencia / Contrareferencia',
  'Descanso Médico'
];

const DISCHARGE_TYPES = [
    'Ninguna',
    'Alta Médica',
    'Alta Voluntaria',
    'Traslado',
    'Fallecimiento',
    'Fuga'
];

export const MedicalReportsTab: React.FC<MedicalReportsTabProps> = ({ patient, onUpdate, userRole, fixedType }) => {
  const [reportType, setReportType] = useState('Informe Médico');
  const [dischargeType, setDischargeType] = useState('Ninguna');
  const [instructions, setInstructions] = useState('');
  
  // Referral Specific State
  const [referralData, setReferralData] = useState({
      destination: '',
      specialty: '',
      motive: '',
      priority: 'Normal'
  });

  // Leave Specific State
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveStartDate, setLeaveStartDate] = useState(''); // New: Custom start date
  const [signingDoctor, setSigningDoctor] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);

  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // History Viewer State
  const [viewingReport, setViewingReport] = useState<MedicalReport | null>(null);

  useEffect(() => {
    if (fixedType) {
        setReportType(fixedType);
    }
  }, [fixedType]);

  // Set default signing doctor when patient changes
  useEffect(() => {
      if (patient.doctors.length > 0) {
          setSigningDoctor(patient.doctors[0]);
      }
      // Reset selected diagnoses to all patient diagnoses by default
      setSelectedDiagnoses(patient.diagnoses);
      // Reset start date
      setLeaveStartDate('');
  }, [patient]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const content = await generateMedicalReport(
        patient, 
        reportType, 
        instructions, 
        dischargeType, 
        referralData, 
        leaveDays, 
        signingDoctor, 
        selectedDiagnoses, // Pass selected diagnoses
        leaveStartDate // Pass custom start date
    );
    setGeneratedContent(content);
    setIsGenerating(false);
  };

  const handlePrint = (content: string, type: string) => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
          // Determine Page Size based on Report Type
          const pageSize = type === 'Descanso Médico' ? 'A5' : 'A4';

          printWindow.document.write(`
            <html>
              <head>
                <title>${type} - ${patient.name}</title>
                <style>
                  @page {
                    size: ${pageSize};
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: white;
                    color: #000000 !important; /* Force Black */
                    -webkit-print-color-adjust: exact;
                  }
                  * {
                    color: #000000 !important; /* Force Black Elements */
                  }
                  .container {
                     margin: 0 auto;
                     width: 100%;
                  }
                </style>
              </head>
              <body>
                <div class="container">${content}</div>
                <script>
                  window.onload = function() { window.print(); }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
      }
  };

  const handleDownloadDoc = () => {
    if (!generatedContent) return;

    // Basic HTML wrapper for Word
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + generatedContent + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${reportType} - ${patient.name}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleSaveToHistory = () => {
    if (!generatedContent) return;

    // Calculate Correlative Number
    const existingReports = patient.medicalReports || [];
    const sameTypeCount = existingReports.filter(r => r.type === reportType).length;
    const nextNumber = sameTypeCount + 1;

    const newReport: MedicalReport = {
        id: Date.now().toString(),
        type: reportType,
        reportNumber: nextNumber,
        content: generatedContent,
        createdAt: Date.now(),
        createdByRole: userRole
    };
    
    const updatedReports = [newReport, ...existingReports];
    onUpdate({ ...patient, medicalReports: updatedReports });
    
    setGeneratedContent(''); // Clear editor
    setInstructions('');
  };

  // Diagnosis Selection Handler
  const toggleDiagnosis = (dx: string) => {
      if (selectedDiagnoses.includes(dx)) {
          setSelectedDiagnoses(selectedDiagnoses.filter(d => d !== dx));
      } else {
          setSelectedDiagnoses([...selectedDiagnoses, dx]);
      }
  };

  // Permissions
  const canGenerate = ['ADMINISTRADOR', 'MEDICO STAFF', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO'].includes(userRole || '');
  const canViewHistory = ['ADMINISTRADOR', 'RESIDENTES TRAUMATO', 'RESIDENTES PEDIA', 'OBSTETRICIA', 'MEDICOS DE PISO'].includes(userRole || '');

  if (!canGenerate && !canViewHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <AlertCircle size={32} className="mb-2 opacity-50" />
        <p className="text-xs text-center">Sin permisos para este módulo.</p>
      </div>
    );
  }

  // Filter history based on type if fixedType is set
  const visibleReports: MedicalReport[] = fixedType 
    ? (patient.medicalReports || []).filter(r => r.type === fixedType)
    : (patient.medicalReports || []);

  // Group reports by Type for display
  const groupedReports = visibleReports.reduce((acc: Record<string, MedicalReport[]>, report) => {
      const type = report.type || 'Sin Tipo';
      if (!acc[type]) acc[type] = [];
      acc[type].push(report);
      return acc;
  }, {} as Record<string, MedicalReport[]>);

  const isReferral = reportType.includes('Referencia');
  const isLeave = reportType.includes('Descanso');

  return (
    <div className="flex flex-col h-full bg-slate-50 gap-2 pb-10">
      
      {/* VIEWER MODAL */}
      {viewingReport && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
                      <div>
                          <h3 className="text-sm font-bold text-slate-800">{viewingReport.type} #{viewingReport.reportNumber}</h3>
                          <p className="text-[10px] text-slate-500">Generado: {new Date(viewingReport.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                          {viewingReport.type !== 'Descanso Médico' && (
                              <button onClick={() => {
                                  // Reuse basic doc download logic for history item
                                  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
                                  const footer = "</body></html>";
                                  const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(header + viewingReport.content + footer);
                                  const link = document.createElement("a");
                                  document.body.appendChild(link);
                                  link.href = source;
                                  link.download = `${viewingReport.type} - ${patient.name}.doc`;
                                  link.click();
                                  document.body.removeChild(link);
                              }} className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-xs font-bold border border-blue-200 flex items-center gap-1 hover:bg-blue-100">
                                  <FileDown size={14} /> DOC
                              </button>
                          )}
                          <button onClick={() => handlePrint(viewingReport.content, viewingReport.type)} className="bg-slate-100 text-slate-700 px-3 py-1 rounded text-xs font-bold border border-slate-300 flex items-center gap-1 hover:bg-slate-200">
                              <Printer size={14} /> Imprimir / PDF
                          </button>
                          <button onClick={() => setViewingReport(null)} className="text-slate-400 hover:text-slate-600">
                              <X size={20} />
                          </button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 bg-white">
                      <div 
                        className="prose prose-sm max-w-none text-xs text-black leading-relaxed font-serif"
                        dangerouslySetInnerHTML={{ __html: viewingReport.content }}
                      />
                  </div>
              </div>
          </div>
      )}

      {/* GENERATOR (Top Half) */}
      {canGenerate && (
        <>
          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-end">
                  {fixedType ? (
                      <div className="flex-1 bg-slate-100 border border-slate-200 rounded px-2 py-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Documento</span>
                          <span className="text-sm font-bold text-slate-800">{fixedType.toUpperCase()}</span>
                      </div>
                  ) : (
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Tipo de Documento</label>
                        <select 
                            value={reportType} 
                            onChange={(e) => setReportType(e.target.value)}
                            className="w-full h-6 text-xs border border-slate-300 rounded px-2 bg-white text-slate-900 outline-none focus:border-primary-500"
                        >
                            {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                  )}
                  
                  {/* GENERATE BUTTON */}
                  <div className="w-auto">
                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="w-20 h-6 bg-purple-600 text-white rounded flex items-center justify-center text-[10px] font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm mb-[1px]"
                    >
                        {isGenerating ? '...' : 'Generar'}
                    </button>
                  </div>
              </div>

              {/* DISCHARGE TYPE SELECTOR */}
              {!isLeave && (
                  <div className="flex gap-2">
                      <div className="flex-1">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Condición de Alta</label>
                          <select 
                              value={dischargeType} 
                              onChange={(e) => setDischargeType(e.target.value)}
                              className="w-full h-6 text-xs border border-slate-300 rounded px-2 bg-white text-slate-900 outline-none focus:border-primary-500"
                          >
                              {DISCHARGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                  </div>
              )}

              {/* LEAVE FORM - CONDITIONAL */}
              {isLeave && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 animate-in slide-in-from-top-2 space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><ArrowRight size={10}/> Descanso Médico</h4>
                      <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Médico que firma</label>
                              <div className="relative">
                                  <select 
                                    value={signingDoctor} 
                                    onChange={e => setSigningDoctor(e.target.value)}
                                    className="w-full h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 outline-none pr-6"
                                  >
                                      {patient.doctors.map(doc => <option key={doc} value={doc}>{doc}</option>)}
                                  </select>
                                  <div className="absolute right-1 top-1 text-slate-400 pointer-events-none"><User size={12} /></div>
                              </div>
                          </div>
                          <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Inicio (Opcional)</label>
                              <div className="relative">
                                  <input 
                                    type="date" 
                                    value={leaveStartDate}
                                    onChange={e => setLeaveStartDate(e.target.value)}
                                    className="h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 w-full"
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Días de Descanso</label>
                              <input 
                                type="number" 
                                min="1"
                                placeholder="Días" 
                                value={leaveDays}
                                onChange={e => setLeaveDays(e.target.value)}
                                className="h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 w-full"
                              />
                          </div>
                      </div>
                      
                      {/* DIAGNOSIS SELECTION CHECKLIST */}
                      <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-1">Diagnósticos a incluir:</label>
                          <div className="bg-white border border-slate-200 rounded p-1.5 space-y-1">
                              {patient.diagnoses.map((dx, i) => (
                                  <div key={i} onClick={() => toggleDiagnosis(dx)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded">
                                      {selectedDiagnoses.includes(dx) 
                                        ? <CheckSquare size={12} className="text-primary-600" /> 
                                        : <Square size={12} className="text-slate-400" />
                                      }
                                      <span className={`text-[10px] ${selectedDiagnoses.includes(dx) ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{dx}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* REFERRAL FORM - CONDITIONAL */}
              {isReferral && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 animate-in slide-in-from-top-2">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><ArrowRight size={10}/> Datos de Referencia</h4>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                          <input 
                            type="text" 
                            placeholder="Establecimiento Destino" 
                            value={referralData.destination}
                            onChange={e => setReferralData({...referralData, destination: e.target.value})}
                            className="h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 w-full"
                          />
                          <input 
                            type="text" 
                            placeholder="Especialidad" 
                            value={referralData.specialty}
                            onChange={e => setReferralData({...referralData, specialty: e.target.value})}
                            className="h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 w-full"
                          />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            placeholder="Motivo de Referencia" 
                            value={referralData.motive}
                            onChange={e => setReferralData({...referralData, motive: e.target.value})}
                            className="col-span-2 h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 w-full"
                          />
                          <select 
                            value={referralData.priority}
                            onChange={e => setReferralData({...referralData, priority: e.target.value})}
                            className="h-6 text-[10px] border border-slate-300 rounded px-1 bg-white text-slate-900 w-full"
                          >
                              <option value="Normal">Normal</option>
                              <option value="Urgencia">Urgencia</option>
                              <option value="Emergencia">Emergencia</option>
                          </select>
                      </div>
                  </div>
              )}
              
              <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Instrucciones Adicionales (Opcional)</label>
                  <input 
                    type="text" 
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full h-7 text-xs border border-slate-300 rounded px-2 bg-white text-slate-900 outline-none focus:border-primary-500"
                    placeholder="Ej: Mencionar evolución favorable, alta voluntaria..."
                  />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden relative h-64 shrink-0">
              <div className="bg-slate-50 border-b border-slate-100 px-3 py-1.5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-700 uppercase">Vista Previa</span>
                </div>
                {generatedContent && (
                    <div className="flex gap-1">
                        {!isLeave && (
                            <button 
                              onClick={handleDownloadDoc}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-colors bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              title="Descargar Word"
                            >
                              <FileDown size={12} /> DOC
                            </button>
                        )}

                        <button 
                          onClick={() => handlePrint(generatedContent, reportType)}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-colors bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                          title="Imprimir"
                        >
                          <Printer size={12} /> Imprimir / PDF
                        </button>

                        <div className="h-4 w-px bg-slate-300 mx-1"></div>

                        <button 
                          onClick={handleSaveToHistory} 
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 hover:border-emerald-300 transition-colors"
                        >
                          <Save size={12} /> Guardar
                        </button>
                    </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                {generatedContent ? (
                    <div 
                      className="prose prose-sm max-w-none text-xs text-black leading-relaxed font-serif"
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: generatedContent }}
                      onBlur={(e) => setGeneratedContent(e.currentTarget.innerHTML)}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                      <Sparkles size={32} className="mb-2" />
                      <p className="text-[10px] text-center px-8">El informe generado aparecerá aquí.</p>
                    </div>
                )}
              </div>
          </div>
        </>
      )}

      {/* HISTORY SECTION */}
      {canViewHistory && (
          <div className="flex-1 overflow-y-auto">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1 flex items-center gap-1">
                  <History size={12} /> Historial {fixedType ? `de ${fixedType}` : ''}
              </h3>
              
              {visibleReports.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-slate-400 bg-slate-100/50 rounded border border-dashed border-slate-200">
                      No hay informes guardados.
                  </div>
              ) : (
                  <div className="space-y-4">
                      {/* GROUP BY TYPE */}
                      {Object.entries(groupedReports).map(([type, reports]) => (
                          <div key={type} className="bg-slate-50/50 rounded-lg p-2 border border-slate-100">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1 px-1">
                                  <Folder size={12} className="text-slate-400"/> {type}
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {[...reports].reverse().map(report => (
                                      <div key={report.id} onClick={() => setViewingReport(report)} className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors group shadow-sm">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                              <div className="bg-blue-50 p-1.5 rounded text-blue-600 group-hover:text-blue-700">
                                                  <FileText size={16} />
                                              </div>
                                              <div className="min-w-0">
                                                  <div className="text-[10px] font-bold text-slate-800 truncate">
                                                      {report.type} #{report.reportNumber || 1}
                                                  </div>
                                                  <div className="text-[9px] text-slate-400">
                                                      {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                  </div>
                                              </div>
                                          </div>
                                          <button className="text-slate-300 hover:text-blue-500">
                                              <Eye size={16} />
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

    </div>
  );
};