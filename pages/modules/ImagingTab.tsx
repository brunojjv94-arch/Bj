
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Image as ImageIcon, Camera, Sun, Contrast, Eye, Sparkles, X, BrainCircuit, 
  ZoomIn, Download, Trash2, ArrowRight, ArrowLeft, CheckSquare, Layers, 
  ChevronDown, ChevronUp, FolderPlus, Folder, MoreVertical, Edit2, Save, FileText, 
  ChevronRight, Calendar, Search, Loader2, CheckCircle, Plus, Printer, Lock, Move, FolderInput, Menu
} from 'lucide-react';
import { PatientImage, ImageFolder, HospitalRole, Patient } from '../../types';
import { analyzeWithGemini } from '../../services/geminiService';

interface ImagingTabProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
  readOnly?: boolean;
}

export const ImagingTab: React.FC<ImagingTabProps> = ({ patient, onUpdate, userRole, readOnly = false }) => {
  const images = patient.images || [];
  const folders = patient.imageFolders || [];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- PERMISOS ---
  // La evaluación IA y su visualización para 'resioyt' Y 'ADMINISTRADOR'
  const canAnalyze = userRole === 'RESIDENTES TRAUMATO' || userRole === 'ADMINISTRADOR';
  
  // --- NAVEGACIÓN (EXPLORADOR) ---
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Control sidebar visibility on mobile
  
  // --- FILTRADO Y SELECCIÓN ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);

  // --- CARPETA MODAL STATE ---
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // --- VIEWER & AI ---
  const [selectedImage, setSelectedImage] = useState<PatientImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [zoom, setZoom] = useState(1);

  // --- FILTRAR CONTENIDO ACTUAL ---
  const currentImages = useMemo(() => {
    // Show images belonging to current folder (or root if null)
    let filtered = images.filter(img => img.folderId === (currentFolderId || undefined));
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(img => img.name.toLowerCase().includes(search) || img.date.includes(search));
    }
    return filtered;
  }, [currentFolderId, images, searchTerm]);

  const currentFolder = folders.find(f => f.id === currentFolderId);

  // --- ACCIONES DE CARPETAS ---
  const openCreateFolderModal = () => {
      setNewFolderName('');
      setIsCreatingFolder(true);
  };

  const confirmCreateFolder = () => {
    if (!newFolderName.trim()) return;
    
    // Regla: Nombradas con fecha y nombre
    const today = new Date().toISOString().split('T')[0];
    const finalName = `${today} - ${newFolderName.trim()}`;

    const newFolder: ImageFolder = {
      id: `folder-${Date.now()}`,
      name: finalName,
      createdAt: Date.now(),
      parentId: undefined // Flat structure for simplicity in sidebar, or could use currentFolderId for nesting
    };
    
    const updatedFolders = [...(patient.imageFolders || []), newFolder];
    onUpdate({ ...patient, imageFolders: updatedFolders });
    setIsCreatingFolder(false);
    
    // Auto switch to new folder
    setCurrentFolderId(newFolder.id);
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar carpeta? Las imágenes pasarán a la raíz (General).')) return;
    
    const updatedFolders = folders.filter(f => f.id !== folderId);
    // Move images to root (undefined folderId)
    const updatedImages = images.map(img => img.folderId === folderId ? { ...img, folderId: undefined } : img);
    
    onUpdate({ ...patient, imageFolders: updatedFolders, images: updatedImages });
    if (currentFolderId === folderId) setCurrentFolderId(null);
  };

  // --- ACCIONES DE IMÁGENES ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          const newImg: PatientImage = {
            id: `img-${Date.now()}-${Math.random()}`,
            data: base64,
            name: file.name.split('.')[0] || 'Imagen',
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            folderId: currentFolderId || undefined
          };
          onUpdate({ ...patient, images: [...images, newImg] });
        };
        reader.readAsDataURL(file);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRename = (id: string, oldName: string) => {
    setEditingId(id);
    setEditValue(oldName);
  };

  const saveRename = (id: string, isFolder: boolean) => {
    if (!editValue.trim()) return;
    if (isFolder) {
      onUpdate({ ...patient, imageFolders: folders.map(f => f.id === id ? { ...f, name: editValue } : f) });
    } else {
      onUpdate({ ...patient, images: images.map(img => img.id === id ? { ...img, name: editValue } : img) });
    }
    setEditingId(null);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
    if (newSet.size > 0) setSelectionMode(true);
  };

  const handleDeleteSelected = () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} imágenes permanentemente?`)) return;
    onUpdate({ ...patient, images: images.filter(img => !selectedIds.has(img.id)) });
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleMoveSelected = (targetFolderId: string | undefined) => {
      const updatedImages = images.map(img => {
          if (selectedIds.has(img.id)) {
              return { ...img, folderId: targetFolderId };
          }
          return img;
      });
      onUpdate({ ...patient, images: updatedImages });
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowMoveModal(false);
  };

  // --- AI ANALYSIS (GENERIC LABEL) ---
  const handleAiAnalysis = async () => {
    if (selectedIds.size === 0 || !canAnalyze) return;
    
    setIsProcessing(true);
    setProcessStep(`Analizando ${selectedIds.size} imágenes con IA Radiológica...`);
    
    const selectedImgs = images.filter(img => selectedIds.has(img.id));
    const base64List = selectedImgs.map(img => img.data);
    const context = `Paciente ${patient.name}, Edad ${patient.age}, Diagnósticos: ${patient.diagnoses.join(', ')}.`;
    
    const report = await analyzeWithGemini(base64List, context);
    
    // Guardar el informe en cada una de las imágenes seleccionadas
    const updatedImages = images.map(img => 
      selectedIds.has(img.id) ? { ...img, report } : img
    );
    
    onUpdate({ ...patient, images: updatedImages });
    setIsProcessing(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    
    if (selectedImgs.length > 0) {
      setSelectedImage({ ...selectedImgs[0], report });
    }
  };

  return (
    <div className="h-full flex bg-slate-50 relative overflow-hidden">
      {/* Input para Galería (Múltiple) */}
      <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* --- MODAL CREAR CARPETA --- */}
      {isCreatingFolder && (
          <div className="fixed inset-0 z-[170] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-xs rounded-xl shadow-2xl p-4 animate-in zoom-in-95">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><FolderPlus size={16} className="text-yellow-500"/> Nueva Carpeta</h3>
                  <div className="mb-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre (Se añade fecha autom.)</label>
                      <input 
                        autoFocus
                        type="text" 
                        value={newFolderName} 
                        onChange={e => setNewFolderName(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && confirmCreateFolder()}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                        placeholder="Ej: Ecografía abdominal"
                      />
                  </div>
                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsCreatingFolder(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                      <button onClick={confirmCreateFolder} className="px-3 py-1.5 text-xs font-bold bg-primary-600 text-white rounded hover:bg-primary-700 shadow-sm">Crear</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MOVE MODAL --- */}
      {showMoveModal && (
          <div className="fixed inset-0 z-[160] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-700 uppercase">Mover {selectedIds.size} elementos a...</h3>
                      <button onClick={() => setShowMoveModal(false)}><X size={16} className="text-slate-400"/></button>
                  </div>
                  <div className="p-2 max-h-60 overflow-y-auto">
                      <button onClick={() => handleMoveSelected(undefined)} className="w-full text-left p-2 hover:bg-blue-50 text-[11px] font-bold text-slate-700 border-b border-slate-100 flex items-center gap-2">
                          <Folder size={14} className="text-blue-400" /> / (General)
                      </button>
                      {folders.filter(f => f.id !== currentFolderId).map(f => (
                          <button key={f.id} onClick={() => handleMoveSelected(f.id)} className="w-full text-left p-2 hover:bg-yellow-50 text-[11px] font-medium text-slate-600 border-b border-slate-100 flex items-center gap-2">
                              <Folder size={14} className="text-yellow-500" /> {f.name}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- LEFT SIDEBAR (CARPETAS) --- */}
      <div className={`
          absolute md:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 shadow-lg md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-60'}
      `}>
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0 h-12">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2"><Layers size={14}/> Carpetas</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X size={16}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Root Folder Item */}
              <div 
                  onClick={() => { setCurrentFolderId(null); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs font-bold ${currentFolderId === null ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                  <Folder size={16} className={currentFolderId === null ? 'text-primary-500' : 'text-slate-400'} />
                  <span>General / Raíz</span>
                  <span className="ml-auto text-[9px] bg-slate-100 px-1.5 rounded-full text-slate-500">{images.filter(i => !i.folderId).length}</span>
              </div>

              {/* User Folders */}
              {folders.map(f => (
                  <div 
                      key={f.id} 
                      onClick={() => { setCurrentFolderId(f.id); setIsSidebarOpen(false); }}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs font-bold relative ${currentFolderId === f.id ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                      <Folder size={16} className={currentFolderId === f.id ? 'text-yellow-600' : 'text-yellow-400'} />
                      <div className="flex-1 truncate pr-6">{f.name}</div>
                      
                      {!readOnly && (
                          <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(e, f.id); }}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                  <Trash2 size={12}/>
                              </button>
                          </div>
                      )}
                  </div>
              ))}
          </div>

          {!readOnly && (
              <div className="p-3 border-t border-slate-100 bg-slate-50">
                  <button 
                    onClick={openCreateFolderModal}
                    className="w-full bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-slate-400 transition-all"
                  >
                      <FolderPlus size={14} className="text-yellow-500"/> Nueva Carpeta
                  </button>
              </div>
          )}
      </div>

      {/* --- MAIN CONTENT (IMÁGENES) --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full">
          
          {/* Top Bar */}
          <div className="bg-white border-b border-slate-200 p-2 shadow-sm shrink-0 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-md bg-slate-100 text-slate-600"><Menu size={16}/></button>
                      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 truncate">
                          {currentFolder ? <Folder size={16} className="text-yellow-500"/> : <Folder size={16} className="text-primary-500"/>}
                          {currentFolder ? currentFolder.name : 'General / Raíz'}
                      </h2>
                  </div>
                  
                  {!readOnly && (
                      <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 shadow-md transition-all">
                          <ImageIcon size={14}/> <span className="hidden sm:inline">Subir Imagen</span>
                      </button>
                  )}
              </div>

              <div className="flex gap-2">
                  <div className="relative flex-1">
                      <Search className="absolute left-2 top-2 text-slate-400" size={14}/>
                      <input 
                        type="text" 
                        placeholder="Buscar imágenes..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                  </div>
                  {selectionMode && (
                      <div className="flex gap-1 animate-in fade-in slide-in-from-right-4">
                          <button onClick={() => setShowMoveModal(true)} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-yellow-200"><Move size={14}/> Mover</button>
                          
                          {/* BOTÓN IA GENÉRICO */}
                          {canAnalyze && (
                              <button onClick={handleAiAnalysis} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-purple-700 shadow-sm"><BrainCircuit size={14}/> Evaluación IA</button>
                          )}
                          
                          <button onClick={handleDeleteSelected} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><Trash2 size={16}/></button>
                          <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900"><X size={16}/></button>
                      </div>
                  )}
              </div>
          </div>

          {/* Grid de Imágenes */}
          <div className="flex-1 overflow-y-auto p-4">
              {currentImages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <ImageIcon size={48} className="mb-2 opacity-50"/>
                      <p className="text-xs font-bold">Carpeta vacía</p>
                      <p className="text-[10px]">Sube imágenes desde la galería</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {currentImages.map(img => {
                          const isSelected = selectedIds.has(img.id);
                          return (
                              <div 
                                  key={img.id} 
                                  className={`group relative rounded-lg overflow-hidden border cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary-500 border-transparent shadow-lg' : 'border-slate-200 shadow-sm hover:shadow-md'}`}
                                  onClick={() => selectionMode ? toggleSelection(img.id) : setSelectedImage(img)}
                                  onContextMenu={(e) => { e.preventDefault(); toggleSelection(img.id); }}
                              >
                                  <div className="aspect-square bg-slate-100 relative">
                                      <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                                      {/* Selection Check */}
                                      {isSelected && <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center"><CheckCircle size={32} className="text-white drop-shadow-md"/></div>}
                                      {/* AI Indicator */}
                                      {img.report && canAnalyze && <div className="absolute top-1 right-1 bg-purple-600 text-white p-0.5 rounded shadow-sm"><BrainCircuit size={10}/></div>}
                                  </div>
                                  <div className="p-1.5 bg-white">
                                      {editingId === img.id ? (
                                          <input 
                                            autoFocus
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onBlur={() => saveRename(img.id, false)}
                                            onKeyDown={e => e.key === 'Enter' && saveRename(img.id, false)}
                                            onClick={e => e.stopPropagation()}
                                            className="w-full text-[10px] border rounded px-1 outline-none font-bold"
                                          />
                                      ) : (
                                          <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-700 truncate" onDoubleClick={(e) => { e.stopPropagation(); if(!readOnly) handleRename(img.id, img.name); }}>{img.name}</span>
                                              <span className="text-[8px] text-slate-400">{img.date}</span>
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

      {/* --- IMAGE VIEWER MODAL (FULLSCREEN) --- */}
      {selectedImage && (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col">
          <div className="flex items-center justify-between p-3 bg-black/60 absolute top-0 w-full z-20 backdrop-blur-md">
             <div className="text-white flex items-center gap-4">
                <button onClick={() => setSelectedImage(null)} className="text-white hover:text-slate-300"><ArrowLeft size={24} /></button>
                <div className="flex flex-col">
                  <p className="text-sm font-bold leading-none">{selectedImage.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{selectedImage.date}</p>
                </div>
             </div>
             <div className="flex items-center gap-4">
                 <button onClick={() => {
                   const link = document.createElement('a');
                   link.href = selectedImage.data;
                   link.download = `${selectedImage.name}.jpg`;
                   link.click();
                 }} className="text-white hover:text-primary-400"><Download size={20} /></button>
                 <button onClick={() => setSelectedImage(null)} className="bg-white/20 p-2 rounded-full text-white hover:bg-white/40"><X size={20} /></button>
             </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden pt-14 bg-slate-950">
             {/* IMAGE AREA */}
             <div className="flex-[3] flex items-center justify-center overflow-hidden relative p-4 bg-black">
                <div 
                  className="transition-transform duration-200 ease-out"
                  style={{ transform: `scale(${zoom})` }}
                >
                  <img src={selectedImage.data} alt="Full Size" className="max-w-full max-h-[85vh] object-contain shadow-2xl" />
                </div>
                <div className="absolute bottom-4 left-4 flex bg-white/10 backdrop-blur rounded-lg p-1 gap-1 border border-white/20">
                   <button onClick={() => setZoom(prev => Math.max(1, prev - 0.5))} className="p-2 text-white hover:bg-white/20 rounded"><X size={16} className="rotate-45"/></button>
                   <span className="text-xs text-white font-mono flex items-center px-2">{Math.round(zoom * 100)}%</span>
                   <button onClick={() => setZoom(prev => Math.min(5, prev + 0.5))} className="p-2 text-white hover:bg-white/20 rounded"><Plus size={16}/></button>
                </div>
             </div>

             {/* REPORT AREA (SOLO VISIBLE PARA RESIOYT / ADMIN) */}
             {canAnalyze && (
               <div className="flex-1 bg-white border-l border-slate-800 flex flex-col min-w-[320px] max-w-[450px]">
                  <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                     <BrainCircuit size={20} className="text-purple-600" />
                     <div>
                       <h4 className="text-sm font-black text-purple-800 uppercase tracking-widest">Informe Radiológico AI</h4>
                       <p className="text-[10px] text-purple-600">Análisis automático asistido</p>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 bg-white">
                     {selectedImage.report ? (
                       <div className="prose prose-sm max-w-none text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium text-justify">
                          {selectedImage.report}
                       </div>
                     ) : (
                       <div className="h-full flex flex-col items-center justify-center text-slate-300 italic p-6 text-center">
                          <Sparkles size={48} className="mb-4 opacity-20" />
                          <p className="text-xs font-medium text-slate-400 mb-4">No hay informe radiológico guardado para esta imagen.</p>
                          {!readOnly && (
                            <button 
                              onClick={() => {
                                setSelectedIds(new Set([selectedImage.id]));
                                handleAiAnalysis();
                              }}
                              className="bg-purple-600 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-purple-700 transition-all shadow-lg hover:shadow-purple-500/30 flex items-center gap-2"
                            >
                              <BrainCircuit size={14}/> Generar Análisis Ahora
                            </button>
                          )}
                       </div>
                     )}
                  </div>
                  <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                     <span className="text-[9px] text-slate-400">Modelo: AI Vision Pro</span>
                     {selectedImage.report && (
                       <button 
                        onClick={() => {
                          const win = window.open('', '_blank');
                          win?.document.write(`<html><head><title>Informe Radiológico</title></head><body style="font-family: sans-serif; padding: 20px;"><h1>Informe Radiológico</h1><hr/><pre style="white-space: pre-wrap; font-family: sans-serif; line-height: 1.5;">${selectedImage.report}</pre><br/><p style="font-size: 10px; color: #666;">Generado por Inteligencia Artificial Médica</p></body></html>`);
                          win?.document.close();
                          win?.print();
                        }}
                        className="p-2 bg-slate-800 text-white rounded-lg shadow hover:bg-slate-900 transition-all flex items-center gap-2 text-[10px] font-bold"
                       >
                         <Printer size={14} /> Imprimir Informe
                       </button>
                     )}
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* --- PROCESSING OVERLAY --- */}
      {isProcessing && (
          <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6">
              <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl flex flex-col items-center max-w-sm text-center">
                  <div className="relative mb-6">
                    <Sparkles size={64} className="text-purple-400 animate-pulse"/>
                    <Loader2 size={32} className="absolute inset-0 m-auto animate-spin text-white opacity-50"/>
                  </div>
                  <h3 className="text-lg font-bold mb-2">Procesando Imagen</h3>
                  <p className="text-sm font-medium animate-pulse text-slate-300 leading-relaxed">{processStep}</p>
                  <p className="text-[10px] text-slate-500 mt-6 uppercase tracking-widest font-black">Generando informe clínico...</p>
              </div>
          </div>
      )}
    </div>
  );
};
