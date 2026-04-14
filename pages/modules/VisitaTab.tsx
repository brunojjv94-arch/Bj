
import React, { useState, useEffect, useRef } from 'react';
import { Patient, EvolutionRecord, VitalSigns, HospitalRole, PendingTask, Surgery, LabResult, MedicalReport, Bed, VoiceCommandData, EvolutionType, ObstetricData, Doctor, ClinicalData } from '../../types';
import { Save, Activity, Thermometer, Wind, Heart, Percent, Baby, AlertTriangle, Trash2, CheckSquare, Square, Plus, Zap, Mic, Pause, ChevronDown, ChevronUp, FileText, RefreshCw, HelpCircle, Send, BrainCircuit, Sparkles, X, Clock, MessageSquare, TestTube, Scissors, CalendarCheck, UserPlus, UserMinus, ShieldAlert, Wallet, Phone, CheckCircle, FileInput, Calendar, Check, Search, AlertCircle } from 'lucide-react';
import { generateEvolutionAnalysis, generateClinicalSummary, answerPatientQuery, lookupDiagnosisInfo } from '../../services/geminiService';

interface VisitaTabProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  userRole?: HospitalRole;
  onNotify: (title: string, message: string) => void;
  initialVoiceData?: VoiceCommandData | null; 
}

interface ActionSelection {
    pendings: boolean[];
    surgeries: boolean[];
    labs: boolean[];
    diagnoses: boolean[];
    doctorChanges: boolean[];
    clinicalDataUpdates: boolean;
    contactUpdates: boolean;
    bedChange: boolean;
    insuranceChange: boolean;
    interconsultation: boolean;
    completedTasks: boolean[];
}

// Helper to check for recent exams (< 3 months)
const checkRecentExams = (patient: Patient) => {
    const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    
    // Check Labs (looking for keywords like "Perfil", "Hemograma", "Quirurgico")
    const recentLabs = patient.labResults.filter(l => {
        const d = new Date(`${l.date}T${l.time}`).getTime();
        return d > threeMonthsAgo && (
            l.testName.toLowerCase().includes('perfil') || 
            l.testName.toLowerCase().includes('pre') ||
            l.testName.toLowerCase().includes('hemograma') ||
            l.testName.toLowerCase().includes('coagulacion')
        );
    });

    // Check Risk Qx (Medical Reports or specific text)
    const recentRisk = patient.medicalReports.filter(r => {
        return r.createdAt > threeMonthsAgo && (
            r.type.toLowerCase().includes('riesgo') || 
            r.content.toLowerCase().includes('riesgo quirurgico') ||
            r.content.toLowerCase().includes('cardio')
        );
    });

    return {
        hasRecentLabs: recentLabs.length > 0,
        lastLabDate: recentLabs.length > 0 ? recentLabs[recentLabs.length-1].date : null,
        hasRecentRisk: recentRisk.length > 0,
        lastRiskDate: recentRisk.length > 0 ? new Date(recentRisk[0].createdAt).toLocaleDateString() : null
    };
};

export const VisitaTab: React.FC<VisitaTabProps> = ({ patient, onUpdate, userRole, onNotify, initialVoiceData }) => {
  const [note, setNote] = useState('');
  const [vitals, setVitals] = useState<VitalSigns>({
    pa: '', fc: '', fr: '', temp: '', sat: '', fio2: ''
  });
  
  // --- VISIBILITY STATES ---
  const [showSummary, setShowSummary] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showManualTaskForm, setShowManualTaskForm] = useState(false);
  
  // --- DATA STATES ---
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [qaInput, setQaInput] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);

  // --- MANUAL TASK STATE ---
  const [manualTaskText, setManualTaskText] = useState('');
  const [manualTaskDate, setManualTaskDate] = useState('');
  const [manualTaskTime, setManualTaskTime] = useState('');

  const [detectedType, setDetectedType] = useState<string>('Evolución'); 
  const [obstetricData, setObstetricData] = useState<ObstetricData>(patient.obstetricData || {});
  const [availableDocs, setAvailableDocs] = useState<Doctor[]>([]);

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // --- Q&A VOICE STATE ---
  const [isQARecording, setIsQARecording] = useState(false);
  const qaRecognitionRef = useRef<any>(null);

  // --- MANUAL DIAGNOSIS ADDITION STATE ---
  const [manualDxText, setManualDxText] = useState('');
  const [manualDxCode, setManualDxCode] = useState('');
  const [isSearchingManualDx, setIsSearchingManualDx] = useState(false);
  const [activeManualInput, setActiveManualInput] = useState<'text' | 'code' | null>(null);

  // --- ROW EDITING STATE (For existing/suggested diagnoses) ---
  const [editingDxRow, setEditingDxRow] = useState<{ index: number, field: 'dx' | 'cie10' } | null>(null);
  const [isSearchingRowDx, setIsSearchingRowDx] = useState(false);

  const [aiSuggestions, setAiSuggestions] = useState<{ 
      suggestedText: string; 
      detectedType: string;
      extractedVitals: VitalSigns;
      detectedActions: {
          newPendings: string[];
          completedTaskIds?: string[];
          dataWarnings?: string[];
          newSurgeries: { procedure: string, date: string, time?: string }[];
          newLabs: { testName: string, value: number, date: string }[];
          newDiagnoses: { dx: string, cie10: string }[];
          doctorChanges: { action: 'add' | 'remove', name: string }[];
          clinicalDataUpdates?: Partial<ClinicalData>;
          contactUpdates?: { phone?: string, familyPhone?: string };
          bedChange: string | null;
          insuranceChange: string | null;
          interconsultationResult?: { detected: boolean; specialty: string; doctorName: string; text: string; };
      };
  } | null>(null);

  const [actionSelection, setActionSelection] = useState<ActionSelection>({
      pendings: [], surgeries: [], labs: [], diagnoses: [], doctorChanges: [], 
      clinicalDataUpdates: true, contactUpdates: true, bedChange: true, insuranceChange: true, interconsultation: true,
      completedTasks: []
  });

  // --- INITIALIZATION ---
  useEffect(() => {
      const checkSummaryUpdate = async () => {
          const now = new Date();
          const currentHour = now.getHours();
          let shiftStartHour = 7; // Default 7 AM

          // Determine current shift start (07:00, 13:00, 19:00, 01:00)
          if (currentHour >= 7 && currentHour < 13) shiftStartHour = 7;
          else if (currentHour >= 13 && currentHour < 19) shiftStartHour = 13;
          else if (currentHour >= 19) shiftStartHour = 19;
          else shiftStartHour = 1; // 01:00 AM

          const shiftStartTime = new Date();
          shiftStartTime.setHours(shiftStartHour, 0, 0, 0);

          if (currentHour < 1) {
              shiftStartTime.setDate(shiftStartTime.getDate() - 1);
              shiftStartTime.setHours(19, 0, 0, 0);
          } else if (currentHour >= 1 && currentHour < 7) {
              shiftStartTime.setHours(1, 0, 0, 0);
          }

          const lastUpdate = patient.summaryLastUpdate || 0;
          
          if (!patient.clinicalSummary || lastUpdate < shiftStartTime.getTime()) {
              handleUpdateSummary();
          }
      };
      checkSummaryUpdate();
      
      const storedDocs = localStorage.getItem('omni_doctors');
      if (storedDocs) setAvailableDocs(JSON.parse(storedDocs));

  }, [patient.id]);

  useEffect(() => {
      if (initialVoiceData) {
          setNote(initialVoiceData.clinicalText);
          handleGenerateAI(initialVoiceData.clinicalText);
      }
  }, [initialVoiceData]);

  // --- AUTO-COMPLETE MANUAL ADDITION EFFECTS ---
  useEffect(() => {
      const timer = setTimeout(async () => {
          if (activeManualInput === 'text' && manualDxText.length > 3) {
              setIsSearchingManualDx(true);
              const result = await lookupDiagnosisInfo(manualDxText, 'text');
              if (result && result.code) {
                  setManualDxCode(result.code);
              }
              setIsSearchingManualDx(false);
          }
      }, 800);
      return () => clearTimeout(timer);
  }, [manualDxText, activeManualInput]);

  useEffect(() => {
      const timer = setTimeout(async () => {
          if (activeManualInput === 'code' && manualDxCode.length >= 3) {
              setIsSearchingManualDx(true);
              const result = await lookupDiagnosisInfo(manualDxCode, 'code');
              if (result && result.name) {
                  setManualDxText(result.name);
              }
              setIsSearchingManualDx(false);
          }
      }, 800);
      return () => clearTimeout(timer);
  }, [manualDxCode, activeManualInput]);

  // --- AUTO-COMPLETE ROW EDITING EFFECTS (Bidirectional) ---
  useEffect(() => {
      if (!editingDxRow || !aiSuggestions) return;
      
      const { index, field } = editingDxRow;
      const diagnoses = aiSuggestions.detectedActions.newDiagnoses;
      if (!diagnoses[index]) return;

      const currentVal = field === 'dx' ? diagnoses[index].dx : diagnoses[index].cie10;
      if (!currentVal || currentVal.length < 3) return;

      const timer = setTimeout(async () => {
          setIsSearchingRowDx(true);
          const type = field === 'dx' ? 'text' : 'code';
          const result = await lookupDiagnosisInfo(currentVal, type);
          
          if (result && aiSuggestions) {
              setAiSuggestions(prev => {
                  if (!prev) return null;
                  const newDxList = [...prev.detectedActions.newDiagnoses];
                  // If we are editing name, update code. If editing code, update name.
                  if (field === 'dx' && result.code) {
                      newDxList[index] = { ...newDxList[index], cie10: result.code };
                  } else if (field === 'cie10' && result.name) {
                      newDxList[index] = { ...newDxList[index], dx: result.name };
                  }
                  return {
                      ...prev,
                      detectedActions: {
                          ...prev.detectedActions,
                          newDiagnoses: newDxList
                      }
                  };
              });
          }
          setIsSearchingRowDx(false);
          setEditingDxRow(null); // Stop listening
      }, 800);

      return () => clearTimeout(timer);
  }, [aiSuggestions, editingDxRow]);


  // --- VOICE (MAIN EVOLUTION) ---
  const toggleRecording = () => {
      if (isRecording) {
          if (recognitionRef.current) recognitionRef.current.stop();
          setIsRecording(false);
          return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true; 
      recognition.lang = 'es-ES';
      recognition.onresult = (event: any) => {
          let newContent = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) newContent += event.results[i][0].transcript;
          }
          if (newContent) setNote(prev => (prev ? prev + ' ' : '') + newContent.trim());
      };
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      try { recognition.start(); setIsRecording(true); } catch (err) { setIsRecording(false); }
  };

  // --- VOICE (Q&A) ---
  const toggleQARecording = () => {
      if (isQARecording) {
          if (qaRecognitionRef.current) qaRecognitionRef.current.stop();
          setIsQARecording(false);
          return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Single query usually
      recognition.lang = 'es-ES';
      recognition.onresult = (event: any) => {
          let newContent = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) newContent += event.results[i][0].transcript;
          }
          if (newContent) setQaInput(prev => (prev ? prev + ' ' : '') + newContent.trim());
      };
      recognition.onend = () => setIsQARecording(false);
      qaRecognitionRef.current = recognition;
      try { recognition.start(); setIsQARecording(true); } catch (err) { setIsQARecording(false); }
  };

  // --- PENDING TASKS MANAGEMENT ---
  const handleToggleTask = (taskId: string) => {
      const updatedTasks = patient.pendingTasks.map(t => 
          t.id === taskId ? { 
              ...t, 
              completed: !t.completed,
              completedAt: !t.completed ? Date.now() : undefined 
          } : t
      );
      onUpdate({ ...patient, pendingTasks: updatedTasks });
  };

  const handleDeleteTask = (taskId: string) => {
      if(!confirm("¿Eliminar tarea de la lista?")) return;
      const updatedTasks = patient.pendingTasks.filter(t => t.id !== taskId);
      onUpdate({ ...patient, pendingTasks: updatedTasks });
  };

  const handleAddManualTask = () => {
      if (!manualTaskText.trim()) return;
      const newTask: PendingTask = {
          id: `task-man-${Date.now()}`,
          text: manualTaskText,
          completed: false,
          createdAt: Date.now(),
          dueTime: manualTaskTime || undefined
      };
      if (manualTaskDate) {
          newTask.text = `[${manualTaskDate}] ${newTask.text}`;
      }
      
      const updatedTasks = [newTask, ...patient.pendingTasks];
      onUpdate({ ...patient, pendingTasks: updatedTasks });
      setManualTaskText('');
      setManualTaskDate('');
      setManualTaskTime('');
      setShowManualTaskForm(false);
  };

  // --- AI HANDLERS ---
  const handleUpdateSummary = async () => {
      setSummaryLoading(true);
      const summary = await generateClinicalSummary(patient);
      onUpdate({ ...patient, clinicalSummary: summary, summaryLastUpdate: Date.now() });
      setSummaryLoading(false);
  };

  const handleAskQuestion = async () => {
      if (!qaInput.trim()) return;
      setQaLoading(true);
      setQaAnswer(''); // Clear previous
      const answer = await answerPatientQuery(patient, qaInput);
      setQaAnswer(answer);
      setQaLoading(false);
  };

  const handleGenerateAI = async (forcedNote?: string, overrideType?: string) => {
      const textToAnalyze = forcedNote || note;
      if (!textToAnalyze.trim()) return;
      
      setIsProcessingAI(true);
      
      const allBeds: Bed[] = JSON.parse(localStorage.getItem('omni_beds') || '[]');
      const availBeds = allBeds.filter(b => b.status === 'available').map(b => b.number);
      
      // Load and Map Insurances for AI Context
      const rawInsurances = JSON.parse(localStorage.getItem('omni_insurances') || '[]');
      const availInsurances = rawInsurances.length > 0
        ? rawInsurances.map((i: any) => typeof i === 'string' ? i : i.name)
        : ["RIMAC", "PARTICULAR", "PACIFICO", "MAPFRE", "LA POSITIVA"];
      
      const analysis = await generateEvolutionAnalysis(
          patient, 
          textToAnalyze, 
          vitals, 
          availBeds, 
          availInsurances, 
          overrideType || null, 
          obstetricData,
          availableDocs,
          patient.pendingTasks
      );
      
      const actions = analysis.detectedActions || {};
      const { hasRecentLabs, lastLabDate, hasRecentRisk, lastRiskDate } = checkRecentExams(patient);
      
      // --- AUTO-GENERATE SURGICAL TASKS FOR SELECTION ---
      const generatedPendings = [...(actions.newPendings || [])];
      
      if (actions.newSurgeries && actions.newSurgeries.length > 0) {
          actions.newSurgeries.forEach((s: any) => {
              // 1. Pre-quirúrgicos with Alert Check
              const labAlert = hasRecentLabs ? `:::WARN_LAB:${lastLabDate}:::` : '';
              generatedPendings.push(`Verificar Exámenes Pre-quirúrgicos - ${s.procedure}${labAlert}`);
              
              // 2. Riesgo Qx with Alert Check
              const riskAlert = hasRecentRisk ? `:::WARN_RISK:${lastRiskDate}:::` : '';
              generatedPendings.push(`Verificar Riesgo Quirúrgico (RQCV) - ${s.procedure}${riskAlert}`);
              
              // 3. NPO Logic
              if (s.date && s.time) {
                  try {
                      const sxDate = new Date(`${s.date}T${s.time}`);
                      const npoDate = new Date(sxDate.getTime() - (6 * 60 * 60 * 1000));
                      const npoTimeStr = npoDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                      generatedPendings.push(`Iniciar NPO (Ayuno) a las ${npoTimeStr} para ${s.procedure}`);
                  } catch (e) {
                      generatedPendings.push(`Iniciar NPO para ${s.procedure}`);
                  }
              }
          });
      }

      setAiSuggestions({
          suggestedText: analysis.suggestedText || '', 
          detectedType: analysis.detectedType || (overrideType || 'Evolución'),
          extractedVitals: analysis.extractedVitals || vitals,
          detectedActions: {
              newPendings: generatedPendings, // Use the enhanced list
              completedTaskIds: actions.completedTaskIds || [], 
              dataWarnings: actions.dataWarnings || [], 
              newSurgeries: actions.newSurgeries || [],
              newLabs: actions.newLabs || [],
              newDiagnoses: actions.newDiagnoses || [],
              doctorChanges: actions.doctorChanges || [],
              clinicalDataUpdates: actions.clinicalDataUpdates, 
              contactUpdates: actions.contactUpdates, 
              bedChange: actions.bedChange || null,
              insuranceChange: actions.insuranceChange || null,
              interconsultationResult: actions.interconsultationResult
          }
      });
      
      setActionSelection({ 
          pendings: new Array(generatedPendings.length).fill(true), 
          surgeries: new Array((actions.newSurgeries || []).length).fill(true), 
          labs: new Array((actions.newLabs || []).length).fill(true), 
          diagnoses: new Array((actions.newDiagnoses || []).length).fill(true), 
          doctorChanges: new Array((actions.doctorChanges || []).length).fill(true), 
          clinicalDataUpdates: true,
          contactUpdates: true,
          bedChange: true, 
          insuranceChange: true,
          interconsultation: true,
          completedTasks: new Array((actions.completedTaskIds || []).length).fill(true)
      });

      setDetectedType(analysis.detectedType || (overrideType || 'Evolución'));
      setIsProcessingAI(false);
      setShowAIPreview(true);
  };

  const handleTypeChangeInModal = (newType: string) => {
      setDetectedType(newType);
      handleGenerateAI(note, newType);
  };

  // --- MANUAL DIAGNOSIS HANDLERS (Inside Modal) ---
  const handleAddManualDiagnosis = () => {
      if (!aiSuggestions) return;
      if (manualDxText && manualDxCode) {
          const newDx = { dx: manualDxText, cie10: manualDxCode };
          setAiSuggestions({
              ...aiSuggestions,
              detectedActions: {
                  ...aiSuggestions.detectedActions,
                  newDiagnoses: [...aiSuggestions.detectedActions.newDiagnoses, newDx]
              }
          });
          // Add true to selection array
          setActionSelection(prev => ({
              ...prev,
              diagnoses: [...prev.diagnoses, true]
          }));
          setManualDxText('');
          setManualDxCode('');
      }
  };

  const handleUpdateDiagnosisItem = (index: number, field: 'dx' | 'cie10', value: string) => {
      if (!aiSuggestions) return;
      const updatedDiagnoses = [...aiSuggestions.detectedActions.newDiagnoses];
      updatedDiagnoses[index] = { ...updatedDiagnoses[index], [field]: value };
      setAiSuggestions({
          ...aiSuggestions,
          detectedActions: {
              ...aiSuggestions.detectedActions,
              newDiagnoses: updatedDiagnoses
          }
      });
      setEditingDxRow({ index, field }); // Trigger bidirectional effect
  };

  // --- SURGERY EDITING HANDLER ---
  const handleUpdateSurgeryItem = (index: number, field: 'procedure' | 'date' | 'time', value: string) => {
      if (!aiSuggestions) return;
      const oldSurgery = aiSuggestions.detectedActions.newSurgeries[index];
      const oldProc = oldSurgery.procedure || 'Por definir';
      
      const updatedSurgeries = [...aiSuggestions.detectedActions.newSurgeries];
      updatedSurgeries[index] = { ...updatedSurgeries[index], [field]: value };
      
      // SYNC PENDINGS LOGIC
      const newProc = field === 'procedure' ? value : oldProc;
      const updatedPendings = aiSuggestions.detectedActions.newPendings.map(task => {
          let newTask = task;
          
          // 1. Sync Procedure Name Change
          if (field === 'procedure' && newTask.includes(oldProc)) {
              newTask = newTask.replace(oldProc, newProc);
          }

          // 2. Sync NPO Time Change
          // Only if this task is an NPO task and it looks like it belongs to this surgery
          if (newTask.includes('NPO') && (field === 'date' || field === 'time')) {
              // Only update if the task matches the surgery procedure to avoid mixing multiple surgeries
              if (newTask.includes(oldProc) || newTask.includes(newProc)) {
                  const dateToUse = field === 'date' ? value : (oldSurgery.date || new Date().toISOString().split('T')[0]);
                  const timeToUse = field === 'time' ? value : (oldSurgery.time || '08:00');
                  
                  try {
                      const sxDate = new Date(`${dateToUse}T${timeToUse}`);
                      const npoDate = new Date(sxDate.getTime() - (6 * 60 * 60 * 1000));
                      const npoTimeStr = npoDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                      
                      // Replace time pattern in string "a las HH:MM"
                      newTask = newTask.replace(/a las \d{2}:\d{2}/, `a las ${npoTimeStr}`);
                  } catch (e) {
                      console.error("Error recalculating NPO", e);
                  }
              }
          }
          return newTask;
      });

      setAiSuggestions({
          ...aiSuggestions,
          detectedActions: {
              ...aiSuggestions.detectedActions,
              newSurgeries: updatedSurgeries,
              newPendings: updatedPendings
          }
      });
  };

  // Helper to clear placeholder text on click
  const handleProcedureFocus = (index: number, value: string) => {
      if (['Por definir', 'Cirugía por definir', 'Procedimiento'].includes(value)) {
          handleUpdateSurgeryItem(index, 'procedure', '');
      }
  };

  const handleSave = () => {
    if (!aiSuggestions) return;

    let updatedPatient = { ...patient };
    const timestamp = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const newEvolutions: EvolutionRecord[] = [];

    // 1. ADD MAIN EVOLUTION NOTE
    if (aiSuggestions.suggestedText.trim()) {
        newEvolutions.push({ 
            id: timestamp.toString(), 
            date: today, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            note: `[${detectedType.toUpperCase()}] ${aiSuggestions.suggestedText}`, 
            vitals: aiSuggestions.extractedVitals, 
            author: userRole || 'Desconocido', 
            timestamp: timestamp, 
            locked: true 
        });
    }

    // 2. PROCESS INTERCONSULTATION
    const inter = aiSuggestions.detectedActions.interconsultationResult;
    if (inter && inter.detected && actionSelection.interconsultation) {
        newEvolutions.push({
            id: (timestamp + 1).toString(),
            date: today,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: `[INTERCONSULTA] ${inter.text}`,
            vitals: { pa:'', fc:'', fr:'', temp:'', sat:'', fio2:'' }, 
            author: `${inter.specialty} - ${inter.doctorName || 'Guardia'}`,
            timestamp: timestamp + 1,
            locked: true
        });
    }

    updatedPatient.evolutions = [...newEvolutions, ...updatedPatient.evolutions];

    // 3. PROCESS ACTIONS
    const { detectedActions } = aiSuggestions;

    // AUTO-COMPLETE TASKS
    if (detectedActions.completedTaskIds && detectedActions.completedTaskIds.length > 0) {
        updatedPatient.pendingTasks = updatedPatient.pendingTasks.map(t => {
            const index = detectedActions.completedTaskIds!.indexOf(t.id);
            if (index !== -1 && actionSelection.completedTasks[index]) {
                return { ...t, completed: true, completedAt: Date.now() };
            }
            return t;
        });
    }

    // New Pendings (Now includes pre-op, risk, and NPO if selected)
    detectedActions.newPendings.forEach((taskString, i) => {
        if (actionSelection.pendings[i]) {
            // Clean up internal flags before saving
            let cleanText = taskString.replace(/:::WARN_LAB:.*?:::/g, '').replace(/:::WARN_RISK:.*?:::/g, '');
            
            const newTask: PendingTask = {
                id: `task-${timestamp}-${i}`,
                text: cleanText,
                completed: false,
                createdAt: timestamp
            };

            // Detect NPO Time from text for smart dueTime setting
            const npoMatch = cleanText.match(/NPO.*a las (\d{2}:\d{2})/);
            if (npoMatch && npoMatch[1]) {
                newTask.dueTime = npoMatch[1];
            }

            updatedPatient.pendingTasks.unshift(newTask);
        }
    });

    // Diagnoses
    detectedActions.newDiagnoses.forEach((dx, i) => {
        if (actionSelection.diagnoses[i]) {
            if (!updatedPatient.diagnoses.includes(dx.dx)) {
                updatedPatient.diagnoses = [dx.dx, ...updatedPatient.diagnoses];
                updatedPatient.cie10 = [dx.cie10, ...(updatedPatient.cie10 || [])];
            }
        }
    });

    // Surgeries
    detectedActions.newSurgeries.forEach((s, i) => {
        if (actionSelection.surgeries[i]) {
            // A. Register Surgery
            updatedPatient.surgeries.push({
                id: `sx-${timestamp}-${i}`,
                date: s.date || today,
                time: s.time || '08:00',
                procedure: s.procedure,
                checklist: { preOp: false, risk: false, anesthesia: false, consent: false },
                status: 'scheduled'
            });

            // B. AUTOMATION: Activate Surgical Check
            updatedPatient.surgicalData.isSurgical = true;
            
            // Note: Verification tasks and NPO are now handled via `newPendings` list above
        }
    });

    // Labs (NEW LOGIC)
    detectedActions.newLabs.forEach((l, i) => {
        if (actionSelection.labs[i]) {
            updatedPatient.labResults.push({
                id: `lab-${timestamp}-${i}`,
                date: l.date || today,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                testName: l.testName,
                value: l.value, // Now utilizing the numeric value from AI
                unit: ''
            });
        }
    });

    // Doctor Changes (NEW LOGIC)
    detectedActions.doctorChanges.forEach((change, i) => {
        if (actionSelection.doctorChanges[i]) {
            // Fuzzy check implies we might want to verify against availableDocs, 
            // but for now we trust the user verified the checkbox.
            if (change.action === 'add' && !updatedPatient.doctors.includes(change.name)) {
                updatedPatient.doctors.push(change.name);
            } else if (change.action === 'remove') {
                updatedPatient.doctors = updatedPatient.doctors.filter(d => d !== change.name);
            }
        }
    });

    // Clinical Data Updates
    if (detectedActions.clinicalDataUpdates && actionSelection.clinicalDataUpdates) {
        if (detectedActions.clinicalDataUpdates.allergies !== undefined && detectedActions.clinicalDataUpdates.allergies !== null) {
            updatedPatient.clinicalData.allergies = detectedActions.clinicalDataUpdates.allergies;
        }
        if (detectedActions.clinicalDataUpdates.pathologies !== undefined && detectedActions.clinicalDataUpdates.pathologies !== null) {
            updatedPatient.clinicalData.pathologies = detectedActions.clinicalDataUpdates.pathologies;
        }
        if (detectedActions.clinicalDataUpdates.anticoagulation !== undefined && detectedActions.clinicalDataUpdates.anticoagulation !== null) {
            updatedPatient.clinicalData.anticoagulation = detectedActions.clinicalDataUpdates.anticoagulation;
        }
    }

    // Contact Updates
    if (detectedActions.contactUpdates && actionSelection.contactUpdates) {
        if (detectedActions.contactUpdates.phone) updatedPatient.phone = detectedActions.contactUpdates.phone;
        if (detectedActions.contactUpdates.familyPhone) updatedPatient.familyPhone = detectedActions.contactUpdates.familyPhone;
    }

    // Bed & Insurance Changes
    if (detectedActions.bedChange && actionSelection.bedChange) {
        const oldBed = updatedPatient.bedNumber;
        updatedPatient.bedNumber = detectedActions.bedChange;
        onNotify("Cambio de Cama", `Traslado: ${oldBed} -> ${detectedActions.bedChange}`);
    }
    if (detectedActions.insuranceChange && actionSelection.insuranceChange) {
        updatedPatient.insurance = detectedActions.insuranceChange;
        onNotify("Cambio de Seguro", `Nuevo seguro: ${detectedActions.insuranceChange}`);
    }

    onUpdate(updatedPatient);
    setNote('');
    setVitals({ pa: '', fc: '', fr: '', temp: '', sat: '', fio2: '' });
    setShowAIPreview(false);
    setAiSuggestions(null);
  };

  // Sort: Active first, then completed.
  const sortedPendings = [...(patient.pendingTasks || [])].sort((a, b) => {
      if (a.completed === b.completed) return b.createdAt - a.createdAt;
      return a.completed ? 1 : -1;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 gap-2 pb-10 relative">
      {/* ... (AI PREVIEW MODAL) ... */}
      {showAIPreview && aiSuggestions && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
              <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95">
                  <div className="bg-purple-600 px-4 py-3 border-b border-purple-700 flex justify-between items-center text-white shadow-md">
                      <h3 className="text-sm font-bold flex items-center gap-2"><Sparkles size={16} /> Crear Nota Inteligente</h3>
                      <button onClick={() => setShowAIPreview(false)} className="text-purple-200 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-50">
                      {/* ... (Existing elements: Type Selector, Data Warnings, Text Editor) ... */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Tipo de Nota:</label>
                          <select 
                            value={detectedType} 
                            onChange={(e) => handleTypeChangeInModal(e.target.value)} 
                            className="flex-1 h-8 text-xs font-bold text-purple-700 border border-purple-200 rounded px-2 bg-purple-50 outline-none focus:ring-2 focus:ring-purple-500"
                          >
                              {['Evolución', 'Nota de Ingreso', 'Nota Postoperatoria', 'Epicrisis', 'Nota de Procedimiento', 'Nota de Alta', 'Referencia'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {isProcessingAI && <RefreshCw size={14} className="animate-spin text-purple-600" />}
                      </div>

                      {/* DATA WARNINGS */}
                      {(aiSuggestions.detectedActions.dataWarnings || []).length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-in slide-in-from-top-2">
                              <h4 className="text-[10px] font-bold text-red-700 uppercase flex items-center gap-1 mb-1"><AlertTriangle size={12}/> Información Faltante</h4>
                              <ul className="list-disc list-inside text-[10px] text-red-600 font-medium">
                                  {aiSuggestions.detectedActions.dataWarnings?.map((w, i) => <li key={i}>{w}</li>)}
                              </ul>
                          </div>
                      )}

                      {/* TEXT EDITOR */}
                      {aiSuggestions.suggestedText ? (
                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block px-1">Contenido Generado</label>
                              <textarea 
                                value={aiSuggestions.suggestedText} 
                                onChange={(e) => setAiSuggestions({...aiSuggestions, suggestedText: e.target.value})} 
                                className="w-full h-40 p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium leading-relaxed resize-none focus:bg-white transition-colors text-justify"
                              />
                          </div>
                      ) : (
                          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs text-yellow-800 italic text-center">
                              No se generará nota clínica (solo se detectaron instrucciones/pendientes).
                          </div>
                      )}

                      {/* ACTIONS GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          
                          {/* UPDATED DIAGNOSES SECTION */}
                          {(aiSuggestions.detectedActions.newDiagnoses || []).length > 0 && (
                              <div className="col-span-1 md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-2 shadow-sm">
                                  <h4 className="font-bold text-blue-800 text-[10px] mb-2 uppercase flex items-center gap-1"><Activity size={10}/> Nuevos Diagnósticos</h4>
                                  <div className="space-y-1">
                                      {aiSuggestions.detectedActions.newDiagnoses.map((dx, i) => (
                                          <div key={i} className="flex gap-1 items-center bg-white p-1 rounded border border-blue-100">
                                              <input 
                                                type="checkbox" 
                                                checked={actionSelection.diagnoses[i]} 
                                                onChange={() => { const arr = [...actionSelection.diagnoses]; arr[i] = !arr[i]; setActionSelection({...actionSelection, diagnoses: arr}); }} 
                                                className="shrink-0"
                                              />
                                              <div className="relative w-16">
                                                  <input 
                                                    value={dx.cie10} 
                                                    onChange={(e) => handleUpdateDiagnosisItem(i, 'cie10', e.target.value)} 
                                                    className="w-full text-[10px] font-mono border rounded px-1 text-center font-bold bg-slate-50"
                                                    placeholder="CIE10"
                                                  />
                                                  {/* SPINNER ON TARGET (CIE) IF SEARCHING DX */}
                                                  {isSearchingRowDx && editingDxRow?.index === i && editingDxRow?.field === 'dx' && <RefreshCw size={8} className="absolute right-1 top-1 text-blue-500 animate-spin"/>}
                                              </div>
                                              <div className="relative flex-1">
                                                  <input 
                                                    value={dx.dx} 
                                                    onChange={(e) => handleUpdateDiagnosisItem(i, 'dx', e.target.value)}
                                                    className="w-full text-[10px] border rounded px-1"
                                                    placeholder="Diagnóstico"
                                                  />
                                                  {/* SPARKLES ON TARGET (DX) IF SEARCHING CIE */}
                                                  {isSearchingRowDx && editingDxRow?.index === i && editingDxRow?.field === 'cie10' && <Sparkles size={8} className="absolute right-1 top-1 text-purple-500 animate-pulse"/>}
                                              </div>
                                          </div>
                                      ))}
                                      {/* NEW DIAGNOSIS ROW */}
                                      <div className="flex gap-1 items-center bg-blue-100/50 p-1 rounded border border-blue-200 mt-2 relative">
                                          <Plus size={12} className="text-blue-500 shrink-0 mx-1"/>
                                          <div className="relative">
                                              <input 
                                                value={manualDxCode}
                                                onChange={(e) => { setManualDxCode(e.target.value); setActiveManualInput('code'); }}
                                                placeholder="CIE10"
                                                className="w-16 text-[10px] font-mono border rounded px-1 text-center font-bold bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                              />
                                              {isSearchingManualDx && activeManualInput === 'text' && <div className="absolute top-0 right-0 bottom-0 flex items-center pr-1"><RefreshCw size={8} className="animate-spin text-blue-500"/></div>}
                                          </div>
                                          <div className="relative flex-1">
                                              <input 
                                                value={manualDxText}
                                                onChange={(e) => { setManualDxText(e.target.value); setActiveManualInput('text'); }}
                                                placeholder="Agregar diagnóstico manual..."
                                                className="w-full text-[10px] border rounded px-1 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddManualDiagnosis()}
                                              />
                                              {isSearchingManualDx && activeManualInput === 'code' && <div className="absolute top-0 right-0 bottom-0 flex items-center pr-1"><Sparkles size={8} className="animate-pulse text-purple-500"/></div>}
                                          </div>
                                          <button onClick={handleAddManualDiagnosis} disabled={!manualDxText || !manualDxCode} className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold hover:bg-blue-700 disabled:opacity-50">Add</button>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* DETECTED SURGERIES SECTION - NEW */}
                          {(aiSuggestions.detectedActions.newSurgeries || []).length > 0 && (
                              <div className="col-span-1 md:col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-2 shadow-sm">
                                  <h4 className="font-bold text-purple-800 text-[10px] mb-2 uppercase flex items-center gap-1"><Scissors size={10}/> Programación Quirúrgica Detectada</h4>
                                  <div className="space-y-1">
                                      {aiSuggestions.detectedActions.newSurgeries.map((s, i) => (
                                          <div key={i} className="flex gap-1 items-center bg-white p-1 rounded border border-purple-100">
                                              <input 
                                                type="checkbox" 
                                                checked={actionSelection.surgeries[i]} 
                                                onChange={() => { const arr = [...actionSelection.surgeries]; arr[i] = !arr[i]; setActionSelection({...actionSelection, surgeries: arr}); }} 
                                                className="shrink-0"
                                              />
                                              <div className="grid grid-cols-12 gap-1 flex-1">
                                                  <input 
                                                    value={s.procedure} 
                                                    onChange={(e) => handleUpdateSurgeryItem(i, 'procedure', e.target.value)}
                                                    onFocus={(e) => handleProcedureFocus(i, e.target.value)}
                                                    className="col-span-6 w-full text-[10px] border rounded px-1 font-bold text-purple-700 bg-white shadow-sm border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all outline-none"
                                                    placeholder="Nombre del procedimiento..."
                                                  />
                                                  <input 
                                                    type="date"
                                                    value={s.date || new Date().toISOString().split('T')[0]} 
                                                    onChange={(e) => handleUpdateSurgeryItem(i, 'date', e.target.value)}
                                                    className="col-span-3 w-full text-[10px] border rounded px-1 bg-white shadow-sm border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all outline-none"
                                                  />
                                                  <input 
                                                    type="time"
                                                    value={s.time || '08:00'} 
                                                    onChange={(e) => handleUpdateSurgeryItem(i, 'time', e.target.value)}
                                                    className="col-span-3 w-full text-[10px] border rounded px-1 bg-white shadow-sm border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all outline-none"
                                                  />
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* LABS DETECTED (Resultados) */}
                          {(aiSuggestions.detectedActions.newLabs || []).length > 0 && (
                              <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 shadow-sm">
                                  <h4 className="font-bold text-teal-800 text-[10px] mb-2 uppercase flex items-center gap-1"><TestTube size={10}/> Resultados de Laboratorio</h4>
                                  <div className="space-y-1">
                                      {aiSuggestions.detectedActions.newLabs.map((l, i) => (
                                          <label key={i} className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer hover:bg-teal-100/50 p-1 rounded">
                                              <input type="checkbox" checked={actionSelection.labs[i]} onChange={() => { const arr = [...actionSelection.labs]; arr[i] = !arr[i]; setActionSelection({...actionSelection, labs: arr}); }} />
                                              <span className="font-bold">{l.testName}:</span> 
                                              <span className="font-mono bg-white px-1 border rounded">{l.value}</span>
                                          </label>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* DOCTOR CHANGES */}
                          {(aiSuggestions.detectedActions.doctorChanges || []).length > 0 && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 shadow-sm">
                                  <h4 className="font-bold text-indigo-800 text-[10px] mb-2 uppercase flex items-center gap-1"><UserPlus size={10}/> Gestión de Equipo Médico</h4>
                                  <div className="space-y-1">
                                      {aiSuggestions.detectedActions.doctorChanges.map((c, i) => (
                                          <label key={i} className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer hover:bg-indigo-100/50 p-1 rounded">
                                              <input type="checkbox" checked={actionSelection.doctorChanges[i]} onChange={() => { const arr = [...actionSelection.doctorChanges]; arr[i] = !arr[i]; setActionSelection({...actionSelection, doctorChanges: arr}); }} />
                                              {c.action === 'add' ? <UserPlus size={12} className="text-green-600"/> : <UserMinus size={12} className="text-red-600"/>}
                                              <span className="font-medium">{c.name}</span>
                                          </label>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* PENDINGS */}
                          {(aiSuggestions.detectedActions.newPendings || []).length > 0 && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 shadow-sm">
                                  <h4 className="font-bold text-yellow-800 text-[10px] mb-2 uppercase flex items-center gap-1"><AlertTriangle size={10}/> Pendientes / Indicaciones</h4>
                                  <div className="space-y-1">
                                      {aiSuggestions.detectedActions.newPendings.map((p, i) => {
                                          // Parse for warnings (dynamically extracted in handleGenerateAI)
                                          const warnLabMatch = p.match(/:::WARN_LAB:(.*?):::/);
                                          const warnRiskMatch = p.match(/:::WARN_RISK:(.*?):::/);
                                          
                                          const cleanText = p.replace(/:::WARN_LAB:.*?:::/, '').replace(/:::WARN_RISK:.*?:::/, '');
                                          const hasWarning = warnLabMatch || warnRiskMatch;

                                          return (
                                              <div key={i} className={`flex flex-col gap-1 text-[10px] p-1 rounded ${hasWarning ? 'bg-amber-100/50' : 'hover:bg-yellow-100/50'}`}>
                                                  <label className="flex items-start gap-2 text-slate-700 cursor-pointer">
                                                      <input type="checkbox" checked={actionSelection.pendings[i]} onChange={() => { const arr = [...actionSelection.pendings]; arr[i] = !arr[i]; setActionSelection({...actionSelection, pendings: arr}); }} className="mt-0.5" />
                                                      <span className="leading-tight">{cleanText}</span>
                                                  </label>
                                                  {warnLabMatch && <span className="ml-5 text-[9px] text-amber-700 flex items-center gap-1 font-bold"><AlertCircle size={10}/> Se detectaron exámenes recientes ({warnLabMatch[1]})</span>}
                                                  {warnRiskMatch && <span className="ml-5 text-[9px] text-amber-700 flex items-center gap-1 font-bold"><AlertCircle size={10}/> Se detectó riesgo Qx reciente ({warnRiskMatch[1]})</span>}
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}

                          {/* COMPLETED TASKS (Auto-close) */}
                          {(aiSuggestions.detectedActions.completedTaskIds || []).length > 0 && (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-2 shadow-sm">
                                  <h4 className="font-bold text-green-800 text-[10px] mb-2 uppercase flex items-center gap-1"><CheckCircle size={10}/> Tareas Completadas</h4>
                                  <div className="space-y-1">
                                      {patient.pendingTasks.filter(t => aiSuggestions.detectedActions.completedTaskIds?.includes(t.id)).map((t, i) => (
                                          <label key={t.id} className="flex items-start gap-2 text-[10px] text-slate-600 cursor-pointer hover:bg-green-100/50 p-1 rounded decoration-slate-400 line-through">
                                              <input type="checkbox" checked={actionSelection.completedTasks[i]} onChange={() => { const arr = [...actionSelection.completedTasks]; arr[i] = !arr[i]; setActionSelection({...actionSelection, completedTasks: arr}); }} className="mt-0.5" />
                                              <span className="leading-tight">{t.text}</span>
                                          </label>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                      <button onClick={() => setShowAIPreview(false)} className="px-4 py-2 text-xs text-slate-600 font-bold hover:bg-slate-200 rounded">Cancelar</button>
                      <button onClick={handleSave} className="px-6 py-2 bg-purple-600 text-white text-xs font-bold rounded shadow-lg hover:bg-purple-700 flex items-center gap-2 hover:scale-105 transition-all">
                          <Zap size={14} fill="currentColor" /> Ejecutar Todo
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- REST OF THE COMPONENT (SUMMARY, Q&A, EDITOR, PENDINGS LIST) REMAINS SAME --- */}
      {/* ... (Existing UI Code) ... */}
      
      {/* --- CLINICAL SUMMARY --- */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div onClick={() => setShowSummary(!showSummary)} className="px-3 py-2 flex justify-between items-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><FileText size={12} className="text-slate-400"/> Resumen Clínico Dinámico</h3>
              {showSummary ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
          </div>
          {showSummary && (
              <div className="p-3 border-t border-slate-200 bg-white">
                  {summaryLoading ? <div className="text-center text-xs text-slate-400 py-2 animate-pulse">Analizando expediente...</div> : (
                      <>
                          <div className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap text-justify">{patient.clinicalSummary || "No hay resumen generado."}</div>
                          <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-50">
                              <span className="text-[9px] text-slate-400">Última actualización: {patient.summaryLastUpdate ? new Date(patient.summaryLastUpdate).toLocaleString() : '-'}</span>
                              <button onClick={handleUpdateSummary} className="text-[9px] flex items-center gap-1 text-primary-600 font-bold bg-primary-50 px-2 py-1 rounded hover:bg-primary-100 transition-colors"><RefreshCw size={10} /> Actualizar</button>
                          </div>
                      </>
                  )}
              </div>
          )}
      </div>

      {/* --- Q&A --- */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div onClick={() => setShowQA(!showQA)} className="px-3 py-2 flex justify-between items-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><HelpCircle size={12} className="text-slate-400"/> Consultas al Expediente</h3>
              <div className="flex items-center gap-2">{showQA ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}</div>
          </div>
          {showQA && (
              <div className="p-2 border-t border-slate-200 bg-white space-y-2">
                  <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={qaInput} 
                        onChange={e => setQaInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} 
                        className="flex-1 h-8 text-xs border border-slate-200 rounded-lg px-3 bg-slate-50 focus:bg-white outline-none" 
                        placeholder="Ej: ¿Cuándo fue su última cirugía?"
                      />
                      {/* VOICE BUTTON FOR Q&A */}
                      <button 
                        onClick={toggleQARecording} 
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isQARecording ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} 
                        title="Dictar Pregunta"
                      >
                        {isQARecording ? <Pause size={14} /> : <Mic size={16} />}
                      </button>
                      
                      <button 
                        onClick={handleAskQuestion} 
                        disabled={qaLoading || !qaInput.trim()} 
                        className="bg-purple-600 text-white h-8 w-8 rounded-lg flex items-center justify-center shadow-sm disabled:opacity-50"
                      >
                        {qaLoading ? <RefreshCw size={14} className="animate-spin"/> : <Send size={14} />}
                      </button>
                  </div>
                  {qaAnswer && <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs text-slate-700 leading-relaxed animate-in fade-in"><div className="flex items-center gap-1.5 mb-1"><Sparkles size={10} className="text-purple-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">Respuesta IA</span></div>{qaAnswer}</div>}
              </div>
          )}
      </div>

      {/* --- EVOLUTION NOTE --- */}
      <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm p-2 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase">Evolución Médica</h3>
              <div className="flex items-center gap-2">
                  <button onClick={toggleRecording} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg ring-2 ring-red-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title="Dictar Nota">{isRecording ? <Pause size={14} /> : <Mic size={16} />}</button>
                  <button onClick={() => handleGenerateAI()} disabled={!note.trim()} className="h-8 px-4 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center gap-2 hover:bg-purple-700 shadow-md transition-all disabled:opacity-50 disabled:shadow-none"><Zap size={14} fill="currentColor" /> Crear</button>
              </div>
          </div>
          <div className="relative flex-1 mb-2">
              <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full h-full text-xs p-3 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:border-purple-200 transition-all outline-none resize-none leading-relaxed font-medium text-justify" placeholder="Dicte o escriba la nota aquí. Mencione cambios de médico, alergias, o seguros y la IA realizará las acciones." />
              {isProcessingAI && (<div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10"><div className="flex flex-col items-center"><RefreshCw size={24} className="text-purple-600 animate-spin mb-2" /><span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">Analizando...</span></div></div>)}
          </div>

          {/* ACTIVE PENDINGS BLOCK WITH MANUAL ADD */}
          <div className="shrink-0 bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden flex flex-col max-h-48">
              <div className="px-2 py-1 flex justify-between items-center bg-yellow-100/50 border-b border-yellow-200">
                  <div className="flex items-center gap-1.5 text-yellow-800">
                      <AlertTriangle size={12} />
                      <span className="text-[10px] font-bold uppercase">Pendientes ({sortedPendings.filter(p => !p.completed).length})</span>
                  </div>
                  <button onClick={() => setShowManualTaskForm(!showManualTaskForm)} className="h-5 w-5 bg-white border border-yellow-300 text-yellow-700 rounded flex items-center justify-center hover:bg-yellow-50" title="Agregar Manualmente"><Plus size={12}/></button>
              </div>
              
              {showManualTaskForm && (
                  <div className="p-2 bg-yellow-50 border-b border-yellow-200 animate-in slide-in-from-top-2">
                      <div className="flex gap-1 mb-1">
                          <input type="text" value={manualTaskText} onChange={e => setManualTaskText(e.target.value)} className="flex-1 h-6 text-[10px] border border-yellow-300 rounded px-2 outline-none bg-white" placeholder="Descripción de la tarea..." />
                      </div>
                      <div className="flex gap-1">
                          <input type="date" value={manualTaskDate} onChange={e => setManualTaskDate(e.target.value)} className="h-6 text-[10px] border border-yellow-300 rounded px-1 outline-none w-24 bg-white" />
                          <input type="time" value={manualTaskTime} onChange={e => setManualTaskTime(e.target.value)} className="h-6 text-[10px] border border-yellow-300 rounded px-1 outline-none w-16 bg-white" />
                          <button onClick={handleAddManualTask} className="bg-yellow-600 text-white px-3 rounded text-[10px] font-bold flex-1 hover:bg-yellow-700">Agregar</button>
                      </div>
                  </div>
              )}

              <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
                  {sortedPendings.length === 0 ? (
                      <p className="text-[9px] text-slate-400 text-center py-2 italic">Sin pendientes activos.</p>
                  ) : (
                      sortedPendings.map(t => (
                          <div key={t.id} className={`text-[10px] flex items-center justify-between gap-2 p-1 rounded border group ${t.completed ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-yellow-100 text-slate-700'}`}>
                              
                              {/* CHECKBOX ON THE LEFT */}
                              <button 
                                  onClick={(e) => { e.stopPropagation(); handleToggleTask(t.id); }}
                                  className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${t.completed ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-300 hover:border-green-500 text-transparent hover:text-green-200'}`}
                                  title={t.completed ? "Desmarcar" : "Completar"}
                              >
                                  <Check size={10} strokeWidth={4} fill="currentColor" className={t.completed ? 'opacity-100' : 'opacity-0 hover:opacity-100'} />
                              </button>

                              <div className="flex-1 min-w-0 flex flex-col">
                                  <span className={`leading-tight ${t.completed ? 'line-through decoration-slate-400 decoration-2' : ''}`}>{t.text}</span>
                                  {!t.completed && t.dueTime && <span className="text-[8px] text-red-500 font-bold flex items-center gap-1 mt-0.5"><Clock size={8}/> {t.dueTime}</span>}
                                  {t.completed && t.completedAt && (
                                      <span className="text-[8px] text-green-600 font-mono">Realizado: {new Date(t.completedAt).toLocaleString()}</span>
                                  )}
                              </div>
                              
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }} className="text-red-400 hover:bg-red-100 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar"><Trash2 size={12}/></button>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
