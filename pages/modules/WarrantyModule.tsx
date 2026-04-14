
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WarrantyRequest, WarrantyStatus, Patient, Doctor, FinancialData, WarrantyRequestNote, Surgery, WarrantyLetter, WarrantyPayment, AppNotification, HospitalRole, PendingTask, Insurance } from '../../types';
import { Search, Plus, FileText, CheckCircle, AlertCircle, XCircle, RotateCcw, Save, DollarSign, Wallet, MessageSquare, TrendingUp, Calculator, Scissors, Coins, Calendar, Users, BarChart3, Link, ArrowLeft, Send, Check, Hash, Edit2, Trash2, Mail, Loader2, Link2, AlertTriangle, Filter, Archive, PanelLeft, FileSpreadsheet, Lock, Unlock } from 'lucide-react';

interface WarrantyModuleProps {
    sessionUser: string;
}

// Extended Interface for Local State (Expenses)
interface ExpenseItem {
    id: string;
    description: string;
    amount: number;         
    coveragePercent: number;
    patientShare: number;   
    type: 'surgery' | 'extra';
    surgeryId?: string;     
    linkedLetterId?: string; 
}

export const WarrantyModule: React.FC<WarrantyModuleProps> = ({ sessionUser }) => {
    // --- MODULE SWITCHING ---
    const [subModule, setSubModule] = useState<'insured' | 'private'>('insured');
    
    // --- LAYOUT STATE ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // --- INSURED SUB-TABS ---
    const [insuredTab, setInsuredTab] = useState<'list' | 'report'>('list');

    // --- FILTERS ---
    const [showClosed, setShowClosed] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // --- DATA STATE ---
    const [requests, setRequests] = useState<WarrantyRequest[]>([]);
    const [hospitalizedPatients, setHospitalizedPatients] = useState<Patient[]>([]);
    const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
    const [availableInsurances, setAvailableInsurances] = useState<Insurance[]>([]);

    // --- INSURED TAB STATE ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrigin, setFilterOrigin] = useState(''); 
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [currentRequest, setCurrentRequest] = useState<Partial<WarrantyRequest>>({});
    
    // LINKED PATIENT STATE (For multi-letter management)
    const [linkedPatient, setLinkedPatient] = useState<Patient | null>(null);

    // Financial Details State (Local to the form editing session)
    const [financialDetails, setFinancialDetails] = useState<ExpenseItem[]>([]);
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    
    // Payment State (New Global Payments)
    const [patientPayments, setPatientPayments] = useState<WarrantyPayment[]>([]);
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [newPaymentNote, setNewPaymentNote] = useState('');
    const [newPaymentLinkedId, setNewPaymentLinkedId] = useState(''); 

    const [formNames, setFormNames] = useState({ first: '', last: '' });
    const [newNoteText, setNewNoteText] = useState('');
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 30); 
        return {
            start: lastWeek.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0]
        };
    });

    // --- MOBILE UI STATE ---
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    // --- PRIVATE TAB STATE ---
    const [selectedPrivatePatient, setSelectedPrivatePatient] = useState<Patient | null>(null);
    const [tempFinancials, setTempFinancials] = useState<FinancialData>({ payments: [], observations: [], additionalCosts: [] });
    const [privateSearch, setPrivateSearch] = useState('');
    
    // Forms
    const [newPrivatePayment, setNewPrivatePayment] = useState<{ amount: string, date: string, notes: string }>({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    const [newMiscCost, setNewMiscCost] = useState<{ description: string, amount: string }>({ description: '', amount: '' });
    const [newObservation, setNewObservation] = useState('');
    
    // Auto-Save States
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
    const autoSaveTimerRef = useRef<any>(null);
    const [insuredSaveStatus, setInsuredSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
    const insuredAutoSaveTimerRef = useRef<any>(null);

    const canApproveSurgery = sessionUser === 'adminhosp' || sessionUser === 'admin' || sessionUser === 'admin';

    // --- INITIAL DATA LOAD ---
    const loadAll = () => {
        try {
            const storedReqs = localStorage.getItem('omni_warranty_requests');
            if (storedReqs) setRequests(JSON.parse(storedReqs));

            const storedPatients = localStorage.getItem('omni_patients');
            if (storedPatients) {
                const allP = JSON.parse(storedPatients) as Patient[];
                setHospitalizedPatients(allP.filter(p => !p.dischargeDate));
                
                if (selectedPrivatePatient) {
                    const refreshed = allP.find(p => p.id === selectedPrivatePatient.id);
                    if (refreshed) {
                        setSelectedPrivatePatient(refreshed);
                        if (saveStatus === 'idle') {
                            const rawFin = (refreshed.financialData || {}) as Partial<FinancialData>;
                            const safeFin: FinancialData = {
                                payments: rawFin.payments || [],
                                observations: rawFin.observations || [],
                                additionalCosts: rawFin.additionalCosts || [],
                                initialBudget: rawFin.initialBudget,
                                warrantyAmount: rawFin.warrantyAmount,
                                totalEstimatedAmount: rawFin.totalEstimatedAmount,
                                isClosed: rawFin.isClosed || false
                            };
                            setTempFinancials(safeFin);
                        }
                    }
                }
            }

            const storedDocs = localStorage.getItem('omni_doctors');
            if (storedDocs) setDoctorsList(JSON.parse(storedDocs));

            // LOAD DYNAMIC INSURANCES
            const storedInsurances = localStorage.getItem('omni_insurances');
            if (storedInsurances) {
                try {
                    const parsed = JSON.parse(storedInsurances);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        if (typeof parsed[0] === 'string') {
                            setAvailableInsurances(parsed.map((s: string) => ({ name: s, type: s === 'PARTICULAR' ? 'PARTICULAR' : 'EPS' })));
                        } else {
                            setAvailableInsurances(parsed);
                        }
                    } else {
                        setAvailableInsurances([]);
                    }
                } catch(e) { setAvailableInsurances([]); }
            } else {
                setAvailableInsurances([{ name: 'RIMAC', type: 'EPS' }, { name: 'PARTICULAR', type: 'PARTICULAR' }]);
            }

        } catch (error) {
            console.error("Error loading warranty module data:", error);
        }
    };

    useEffect(() => {
        loadAll();
        const handleUpdate = () => loadAll();
        window.addEventListener('omni_db_update', handleUpdate);
        return () => window.removeEventListener('omni_db_update', handleUpdate);
    }, []); 

    // --- EXPORT EXCEL LOGIC ---
    const handleExportExcel = () => {
        const headers = [
            'Fecha Recepción', 
            'Paciente', 
            'DNI/CE', 
            'Seguro', 
            'Origen',
            'Carta / Ref', 
            'Procedimiento', 
            'Monto Total', 
            'Monto Aprobado',
            'Copago Pcte',
            'Estado Carta', 
            'F. Respuesta', 
            'Estado Trámite (Activo/Cerrado)'
        ];

        const rows = reportRequests.map(r => {
            const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
            return [
                r.receptionDate,
                escape(r.patientName),
                escape(r.patientDoc),
                escape(r.insurance),
                escape(r.origin || ''),
                escape(r.letterNumber),
                escape(r.procedure),
                (r.totalAmount || 0).toFixed(2),
                (r.approvedAmount || 0).toFixed(2),
                (r.patientCopay || 0).toFixed(2),
                r.status,
                r.responseDate || '-',
                r.isClosed ? 'CERRADO' : 'ACTIVO'
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Reporte_Garantias_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- AUTO-SAVE LOGIC (PRIVATE TAB) ---
    useEffect(() => {
        if (!selectedPrivatePatient || subModule !== 'private') return;
        
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        setSaveStatus('saving');

        autoSaveTimerRef.current = setTimeout(() => {
            try {
                const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
                const updatedPatients = allPatients.map(p => 
                    p.id === selectedPrivatePatient.id ? { ...p, financialData: tempFinancials } : p
                );
                localStorage.setItem('omni_patients', JSON.stringify(updatedPatients));
                window.dispatchEvent(new Event('omni_db_update'));
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (e) {
                console.error("Auto-save failed", e);
                setSaveStatus('idle');
            }
        }, 1000); 

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [tempFinancials, subModule, selectedPrivatePatient?.id]);

    // --- AUTO-SAVE LOGIC (INSURED TAB) ---
    useEffect(() => {
        if (subModule !== 'insured' || !selectedRequestId || selectedRequestId === 'new') return;
        
        if (insuredAutoSaveTimerRef.current) clearTimeout(insuredAutoSaveTimerRef.current);
        setInsuredSaveStatus('saving');

        insuredAutoSaveTimerRef.current = setTimeout(() => {
            saveRequest(true); // Silent save
        }, 1500);

        return () => {
            if (insuredAutoSaveTimerRef.current) clearTimeout(insuredAutoSaveTimerRef.current);
        };
    }, [currentRequest, financialDetails, formNames, linkedPatient?.warrantyLetters, patientPayments]);


    // --- HELPERS ---
    const getDaysDiff = (start?: string, end?: string) => { 
        if (!start || !end) return '-'; 
        const d1 = new Date(start).getTime(); 
        const d2 = new Date(end).getTime(); 
        const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)); 
        return diff >= 0 ? `${diff}d` : '-'; 
    };

    const formatShortDate = (isoDate?: string) => {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-');
        return `${d}/${m}`;
    };
    
    const getStatusColor = (status: WarrantyStatus) => { 
        switch(status) { 
            case 'APROBADO': return 'bg-green-100 text-green-700 border-green-200'; 
            case 'RECHAZADA': return 'bg-red-100 text-red-700 border-red-200'; 
            case 'OBSERVADO': return 'bg-orange-100 text-orange-700 border-orange-200'; 
            case 'EN TRAMITE': return 'bg-blue-100 text-blue-700 border-blue-200'; 
            case 'REINGRESADA': return 'bg-purple-100 text-purple-700 border-purple-200'; 
            case 'PENDIENTE': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200'; 
        } 
    };

    // --- INSURED LOGIC ---
    const { reportRequests, sidebarRequests } = useMemo(() => { 
        const matches = requests.filter(r => 
            (r.insurance !== 'PARTICULAR' || (r.letterNumber && !r.letterNumber.includes('PARTICULAR'))) &&
            (r.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || r.patientDoc.includes(searchTerm)) && 
            (new Date(r.receptionDate).getTime() >= new Date(dateRange.start).getTime() && new Date(r.receptionDate).getTime() <= new Date(dateRange.end).getTime()) &&
            (filterOrigin === '' || r.origin === filterOrigin) &&
            (showClosed || !r.isClosed)
        ).sort((a,b) => new Date(b.receptionDate).getTime() - new Date(a.receptionDate).getTime());
        
        const allRequests = matches;
        const unique = new Map<string, WarrantyRequest>();
        matches.forEach(r => {
            if (r.isHospitalized) {
                if (!unique.has(r.patientDoc)) {
                    unique.set(r.patientDoc, r);
                }
            } else {
                unique.set(r.id, r);
            }
        });
        
        return { reportRequests: allRequests, sidebarRequests: Array.from(unique.values()) };
    }, [requests, searchTerm, dateRange, filterOrigin, showClosed]);
    
    const kpiStats = useMemo(() => { 
        return { 
            total: reportRequests.length, 
            pending: reportRequests.filter(r => r.status === 'PENDIENTE').length,
            approved: reportRequests.filter(r => r.status === 'APROBADO').length, 
            observed: reportRequests.filter(r => r.status === 'OBSERVADO').length, 
            rejected: reportRequests.filter(r => r.status === 'RECHAZADA').length, 
            reentered: reportRequests.filter(r => r.status === 'REINGRESADA').length, 
            inProcess: reportRequests.filter(r => r.status === 'EN TRAMITE').length 
        }; 
    }, [reportRequests]);

    const handleNewRequest = () => { 
        setSelectedRequestId('new');
        setCurrentRequest({ 
            receptionDate: new Date().toISOString().split('T')[0], 
            status: 'PENDIENTE', 
            isHospitalized: false,
            coveragePercent: 100,
            notesLog: [],
            isClosed: false
        }); 
        setLinkedPatient(null);
        setFinancialDetails([]);
        setPatientPayments([]);
        setFormNames({ first: '', last: '' });
        setIsMobileDetailOpen(true);
        setInsuredSaveStatus('idle'); 
    };
    
    const handleSearchSelect = (req: WarrantyRequest) => { 
        setSelectedRequestId(req.id);
        setCurrentRequest(req); 
        setInsuredSaveStatus('idle');
        
        const foundPatient = hospitalizedPatients.find(p => p.dni === req.patientDoc);
        if (foundPatient) {
            setLinkedPatient(foundPatient);
        } else {
            setLinkedPatient(null);
        }

        setPatientPayments(req.payments || []);

        let initialDetails: ExpenseItem[] = [];
        if (foundPatient) {
            initialDetails = foundPatient.surgeries.map(s => ({
                id: s.id,
                description: s.procedure,
                amount: s.cost || 0,
                coveragePercent: req.coveragePercent || 100, 
                patientShare: 0,
                type: 'surgery',
                surgeryId: s.id,
                linkedLetterId: s.linkedLetterId
            }));
        }
        setFinancialDetails(initialDetails);

        if (req.patientName.includes(',')) { const parts = req.patientName.split(','); setFormNames({ last: parts[0].trim(), first: parts[1].trim() }); } 
        else { setFormNames({ last: req.patientName, first: '' }); } 
        setIsMobileDetailOpen(true);
    };

    const handleReportRowDoubleClick = (req: WarrantyRequest) => {
        setInsuredTab('list');
        handleSearchSelect(req);
    };

    const handleLinkPatient = (docNumber: string) => { 
        const found = hospitalizedPatients.find(p => p.dni === docNumber); 
        if (found) { 
            let first = '', last = found.name; 
            if (found.name.includes(',')) { const parts = found.name.split(','); last = parts[0].trim(); first = parts[1].trim(); } 
            setFormNames({ first, last }); 
            setCurrentRequest(prev => ({ 
                ...prev, 
                patientDoc: found.dni, 
                insurance: found.insurance, 
                bedNumber: found.bedNumber, 
                isHospitalized: true,
                origin: 'Hospitalización'
            })); 
            setLinkedPatient(found);

            const surgeryExpenses: ExpenseItem[] = found.surgeries.map(s => ({
                id: s.id,
                description: s.procedure,
                amount: s.cost || 0,
                coveragePercent: currentRequest.coveragePercent || 100, 
                patientShare: 0,
                type: 'surgery',
                surgeryId: s.id,
                linkedLetterId: s.linkedLetterId
            }));
            setFinancialDetails(surgeryExpenses);
        } 
    };

    const handleUpdateLetter = (letterId: string, field: keyof WarrantyLetter, value: any) => {
        if (!linkedPatient) return;
        const updatedLetters = linkedPatient.warrantyLetters.map(l => l.id === letterId ? { ...l, [field]: value } : l);
        setLinkedPatient({ ...linkedPatient, warrantyLetters: updatedLetters });
    };

    const handleAssociateSurgery = (letterId: string, surgeryId: string) => {
        if (!linkedPatient) return;
        const updatedSurgeries = linkedPatient.surgeries.map(s => s.id === surgeryId ? { ...s, linkedLetterId: letterId } : (s.linkedLetterId === letterId ? { ...s, linkedLetterId: undefined } : s));
        const surgery = updatedSurgeries.find(s => s.id === surgeryId);
        const updatedLetters = linkedPatient.warrantyLetters.map(l => {
            if (l.id === letterId && !l.name && surgery) { return { ...l, name: surgery.procedure }; }
            return l;
        });
        setLinkedPatient({ ...linkedPatient, surgeries: updatedSurgeries, warrantyLetters: updatedLetters });
    };

    const handleAddLetter = () => {
        if (!linkedPatient) return;
        const newLetter: WarrantyLetter = {
            id: Date.now().toString(),
            number: linkedPatient.warrantyLetters.length + 1,
            status: 'pending',
            createdAt: Date.now(),
            name: '',
            receptionDate: new Date().toISOString().split('T')[0]
        };
        setLinkedPatient({ ...linkedPatient, warrantyLetters: [...linkedPatient.warrantyLetters, newLetter] });
    };

    useEffect(() => {
        if (currentRequest) {
            const globalCoverage = currentRequest.coveragePercent !== undefined ? currentRequest.coveragePercent : 100;

            const updatedDetails = financialDetails.map(item => {
                const patientShare = item.amount * (1 - (globalCoverage / 100));
                return { ...item, patientShare, coveragePercent: globalCoverage };
            });
            
            const hasChanged = updatedDetails.some((item, idx) => 
                Math.abs(item.patientShare - (financialDetails[idx]?.patientShare || 0)) > 0.01 || 
                item.coveragePercent !== financialDetails[idx]?.coveragePercent
            );
            
            if (hasChanged) {
                setFinancialDetails(updatedDetails);
                return; 
            }

            const globalTotal = updatedDetails.reduce((acc, item) => acc + item.amount, 0); 
            const calculatedApproved = globalTotal * (globalCoverage / 100); 
            const totalCopay = globalTotal - calculatedApproved; 
            
            if (
                Math.abs((currentRequest.approvedAmount || 0) - calculatedApproved) > 0.01 || 
                Math.abs((currentRequest.patientCopay || 0) - totalCopay) > 0.01 || 
                Math.abs((currentRequest.totalAmount || 0) - globalTotal) > 0.01
            ) {
                setCurrentRequest(prev => ({
                    ...prev,
                    totalAmount: parseFloat(globalTotal.toFixed(2)),
                    approvedAmount: parseFloat(calculatedApproved.toFixed(2)),
                    patientCopay: parseFloat(totalCopay.toFixed(2)) 
                }));
            }
        }
    }, [currentRequest.coveragePercent, financialDetails]);

    const handleAddPayment = () => {
        if (!newPaymentAmount || isNaN(parseFloat(newPaymentAmount))) return;
        const newP: WarrantyPayment = {
            id: Date.now().toString(),
            date: newPaymentDate,
            amount: parseFloat(newPaymentAmount),
            notes: newPaymentNote || 'Abono Cuenta',
            linkedExpenseId: newPaymentLinkedId || undefined
        };
        setPatientPayments([...patientPayments, newP]);
        setNewPaymentAmount('');
        setNewPaymentNote('');
        setNewPaymentLinkedId('');
    };

    const handleDeletePayment = (id: string) => {
        setPatientPayments(patientPayments.filter(p => p.id !== id));
    };

    const totalPaid = useMemo(() => patientPayments.reduce((acc, p) => acc + p.amount, 0), [patientPayments]);
    const remainingDebt = (currentRequest.patientCopay || 0) - totalPaid;

    const getPaidForExpense = (expenseId: string) => {
        return patientPayments
            .filter(p => p.linkedExpenseId === expenseId)
            .reduce((acc, p) => acc + p.amount, 0);
    };

    const handleAddExpense = () => {
        if (!newExpenseDesc || !newExpenseAmount) return;
        const globalCov = currentRequest.coveragePercent || 100;
        const amount = parseFloat(newExpenseAmount);
        const newItem: ExpenseItem = {
            id: Date.now().toString(),
            description: newExpenseDesc,
            amount: amount,
            coveragePercent: globalCov, 
            patientShare: amount * (1 - globalCov/100),
            type: 'extra'
        };
        setFinancialDetails([...financialDetails, newItem]);
        setNewExpenseDesc('');
        setNewExpenseAmount('');
    };

    const handleRemoveExpense = (id: string) => {
        setFinancialDetails(financialDetails.filter(i => i.id !== id));
    };

    const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: string) => {
        const numVal = parseFloat(value) || 0;
        const item = financialDetails.find(i => i.id === id);
        
        if (field === 'amount') {
             const globalCov = currentRequest.coveragePercent || 100;
             setFinancialDetails(prev => prev.map(i => i.id === id ? { ...i, amount: numVal, patientShare: numVal * (1 - globalCov/100) } : i));
             if (item && item.type === 'surgery' && item.surgeryId) updatePatientSurgeryCost(item.surgeryId, numVal);
        } else if (field === 'linkedLetterId') {
             setFinancialDetails(prev => prev.map(i => i.id === id ? { ...i, linkedLetterId: value } : i));
        } else {
             setFinancialDetails(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
        }
    };

    const updatePatientSurgeryCost = (surgeryId: string, cost: number) => {
        if (!currentRequest.patientDoc) return;
        const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
        const updatedPatients = allPatients.map(p => {
            if (p.dni === currentRequest.patientDoc) {
                const updatedSurgeries = p.surgeries.map(s => s.id === surgeryId ? { ...s, cost: cost } : s);
                return { ...p, surgeries: updatedSurgeries };
            }
            return p;
        });
        localStorage.setItem('omni_patients', JSON.stringify(updatedPatients));
        setHospitalizedPatients(updatedPatients.filter(p => !p.dischargeDate));
    };

    const handleAddNote = () => {
        if (!newNoteText.trim()) return;
        const newNote: WarrantyRequestNote = { id: Date.now().toString(), date: new Date().toISOString(), text: newNoteText, author: sessionUser || 'User' };
        setCurrentRequest(prev => ({ ...prev, notesLog: [newNote, ...(prev.notesLog || [])] }));
        setNewNoteText('');
    };

    const saveRequest = (silent = false) => {
        if (!formNames.last || !formNames.first || !currentRequest.patientDoc) { 
            if(!silent) alert("Datos incompletos"); 
            return; 
        }
        const fullName = `${formNames.last}, ${formNames.first}`;
        const today = new Date().toISOString().split('T')[0];
        
        if (linkedPatient) {
            const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
            const updatedPatients = allPatients.map(p => p.id === linkedPatient.id ? linkedPatient : p);
            localStorage.setItem('omni_patients', JSON.stringify(updatedPatients));
        }

        let updatedRequests = [...requests];

        if (linkedPatient && linkedPatient.warrantyLetters.length > 0) {
            linkedPatient.warrantyLetters.forEach(letter => {
                let procName = letter.name || 'Por definir';
                if (!letter.name) {
                    const linkedSx = linkedPatient.surgeries.find(s => s.linkedLetterId === letter.id);
                    if (linkedSx) procName = linkedSx.procedure;
                }
                const existingReq = requests.find(r => r.id === letter.id);
                const reqStatus = existingReq ? existingReq.status : (letter.status === 'sent' ? 'EN TRAMITE' : 'PENDIENTE');

                const newReq: WarrantyRequest = {
                    id: letter.id,
                    patientName: fullName,
                    patientDoc: currentRequest.patientDoc!,
                    insurance: currentRequest.insurance || 'PARTICULAR',
                    isHospitalized: true,
                    bedNumber: currentRequest.bedNumber,
                    procedure: procName,
                    receptionDate: letter.receptionDate || existingReq?.receptionDate || today,
                    processingDate: letter.processingDate || existingReq?.processingDate,
                    responseDate: letter.responseDate || existingReq?.responseDate,
                    letterNumber: `#${letter.number} ${letter.name || ''}`,
                    status: reqStatus,
                    isClosed: currentRequest.isClosed || false,
                    observation: currentRequest.observation,
                    notesLog: currentRequest.notesLog || [],
                    lastUpdate: Date.now(),
                    managedBy: sessionUser,
                    origin: 'Hospitalización',
                    totalAmount: currentRequest.totalAmount,
                    coveragePercent: currentRequest.coveragePercent,
                    initialApprovedAmount: currentRequest.initialApprovedAmount,
                    approvedAmount: currentRequest.approvedAmount,
                    patientCopay: currentRequest.patientCopay,
                    payments: patientPayments 
                };
                const idx = updatedRequests.findIndex(r => r.id === newReq.id);
                if (idx >= 0) updatedRequests[idx] = newReq; else updatedRequests.push(newReq);
            });
        } else {
            const newReq: WarrantyRequest = {
                id: currentRequest.id || Date.now().toString(),
                patientName: fullName,
                patientDoc: currentRequest.patientDoc!,
                insurance: currentRequest.insurance || 'PARTICULAR',
                isHospitalized: !!currentRequest.isHospitalized,
                bedNumber: currentRequest.bedNumber,
                procedure: currentRequest.procedure || '',
                receptionDate: currentRequest.receptionDate || today,
                processingDate: currentRequest.processingDate,
                responseDate: currentRequest.responseDate,
                letterNumber: currentRequest.letterNumber || '',
                status: currentRequest.status || 'PENDIENTE',
                isClosed: currentRequest.isClosed || false,
                observation: currentRequest.observation,
                notesLog: currentRequest.notesLog || [],
                lastUpdate: Date.now(),
                managedBy: sessionUser,
                origin: currentRequest.origin,
                totalAmount: currentRequest.totalAmount,
                coveragePercent: currentRequest.coveragePercent,
                initialApprovedAmount: currentRequest.initialApprovedAmount,
                approvedAmount: currentRequest.approvedAmount,
                patientCopay: currentRequest.patientCopay,
                payments: patientPayments 
            };
            const existsIndex = updatedRequests.findIndex(r => r.id === newReq.id);
            if (existsIndex !== -1) updatedRequests[existsIndex] = newReq; else updatedRequests.push(newReq);
        }
        
        setRequests(updatedRequests);
        localStorage.setItem('omni_warranty_requests', JSON.stringify(updatedRequests));
        
        if (!silent) {
            if (!linkedPatient) setSelectedRequestId(currentRequest.id || null);
            window.dispatchEvent(new Event('omni_db_update'));
        } else {
            setInsuredSaveStatus('saved');
            setTimeout(() => setInsuredSaveStatus('idle'), 2000);
        }
    };

    const handleStatusChange = (newStatus: string, letterId?: string) => { 
        const status = newStatus as WarrantyStatus; 
        const today = new Date().toISOString().split('T')[0]; 
        
        if (letterId && linkedPatient) {
             setRequests(prev => prev.map(r => r.id === letterId ? { ...r, status: status } : r));
             const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
             const targetPatientIdx = allPatients.findIndex(p => p.id === linkedPatient.id);
             
             if (targetPatientIdx !== -1) {
                 const targetPatient = allPatients[targetPatientIdx];
                 const updatedLetters = targetPatient.warrantyLetters.map(l => {
                     if (l.id === letterId) {
                         const newStatusVal: 'approved' | 'sent' = status === 'APROBADO' ? 'approved' : 'sent';
                         const updatedLetter = { ...l, status: newStatusVal };
                         if (status === 'APROBADO' && !updatedLetter.responseDate) {
                             updatedLetter.responseDate = today;
                         }
                         return updatedLetter;
                     }
                     return l;
                 });
                 let updatedSurgicalData = { ...targetPatient.surgicalData };
                 if (status === 'APROBADO') updatedSurgicalData.letterApproved = true;
                 
                 let updatedPendingTasks = [...(targetPatient.pendingTasks || [])];
                 const letterInfo = targetPatient.warrantyLetters.find(l => l.id === letterId);
                 const letterLabel = `Aprobación Carta #${letterInfo?.number || '?'}`;

                 if (status === 'EN TRAMITE' && letterInfo?.status !== 'sent') {
                     if (!updatedPendingTasks.some(t => t.text.includes(letterLabel) && !t.completed)) {
                         updatedPendingTasks.unshift({
                             id: `task-letter-${Date.now()}`,
                             text: `${letterLabel} - ${letterInfo?.name || 'Procedimiento'}`,
                             completed: false,
                             createdAt: Date.now()
                         });
                     }
                 } else if (status === 'APROBADO') {
                     updatedPendingTasks = updatedPendingTasks.map(t => {
                         if (t.text.includes(letterLabel) && !t.completed) {
                             return { ...t, completed: true, completedAt: Date.now() };
                         }
                         return t;
                     });
                 }

                 const updatedPatientRecord = { 
                     ...targetPatient, 
                     warrantyLetters: updatedLetters, 
                     surgicalData: updatedSurgicalData,
                     pendingTasks: updatedPendingTasks 
                 };
                 
                 allPatients[targetPatientIdx] = updatedPatientRecord;
                 localStorage.setItem('omni_patients', JSON.stringify(allPatients));
                 setLinkedPatient(updatedPatientRecord);

                 if (status === 'APROBADO') {
                     const notifs: AppNotification[] = [];
                     const timestamp = Date.now();
                     const letterNum = letterInfo?.number || '?';
                     const msg = `Carta #${letterNum} del paciente ${targetPatient.name} APROBADA.`;
                     notifs.push({ id: `n-${timestamp}-piso`, toRole: 'MEDICOS DE PISO', title: 'Carta Aprobada', message: msg, timestamp, read: false, relatedPatientId: targetPatient.id });
                     if (targetPatient.age < 15) notifs.push({ id: `n-${timestamp}-ped`, toRole: 'RESIDENTES PEDIA', title: 'Carta Aprobada', message: msg, timestamp, read: false, relatedPatientId: targetPatient.id });
                     const allDoctors: Doctor[] = doctorsList.length > 0 ? doctorsList : JSON.parse(localStorage.getItem('omni_doctors') || '[]');
                     const patientDocs = allDoctors.filter(d => targetPatient.doctors.includes(d.name));
                     if (patientDocs.some(d => (d.specialty || '').toUpperCase().includes('TRAUMATOLOGIA'))) notifs.push({ id: `n-${timestamp}-trauma`, toRole: 'RESIDENTES TRAUMATO', title: 'Carta Aprobada', message: msg, timestamp, read: false, relatedPatientId: targetPatient.id });
                     const linkedSurgery = targetPatient.surgeries.find(s => s.linkedLetterId === letterId);
                     if (linkedSurgery) notifs.push({ id: `n-${timestamp}-cardio`, toRole: 'CARDIOLOGIA', title: 'Riesgo Quirúrgico Requerido', message: `Carta #${letterNum} APROBADA para ${targetPatient.name}. Cirugía: ${linkedSurgery.procedure}.`, timestamp, read: false, relatedPatientId: targetPatient.id });
                     const existingNotifs = JSON.parse(localStorage.getItem('omni_notifications') || '[]');
                     localStorage.setItem('omni_notifications', JSON.stringify([...existingNotifs, ...notifs]));
                 }
                 window.dispatchEvent(new Event('omni_db_update'));
             }
             return; 
        }
        const updates: Partial<WarrantyRequest> = { status: status }; 
        if (status === 'EN TRAMITE') updates.processingDate = today; 
        if (['APROBADO', 'RECHAZADA', 'OBSERVADO'].includes(status) && !currentRequest.responseDate) updates.responseDate = today; 
        setCurrentRequest(prev => ({ ...prev, ...updates })); 
    };

    const privatePatients = useMemo(() => { 
        let list = hospitalizedPatients.filter(p => p.insurance === 'PARTICULAR'); 
        if (privateSearch) { const term = privateSearch.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(term) || p.dni.includes(term)); } 
        return showClosed ? list : list.filter(p => !p.financialData?.isClosed);
    }, [hospitalizedPatients, privateSearch, showClosed]);

    const financialSummary = useMemo(() => {
        const surgeriesTotal = (selectedPrivatePatient?.surgeries || []).filter(s => s.status !== 'cancelled').reduce((acc, s) => acc + (s.cost || 0), 0);
        const miscCostsTotal = (tempFinancials.additionalCosts || []).reduce((acc, c) => acc + (c.amount || 0), 0);
        const totalBudget = surgeriesTotal + miscCostsTotal;
        const warranty = tempFinancials.warrantyAmount || 0;
        const paymentsSum = (tempFinancials.payments || []).reduce((acc, curr) => acc + curr.amount, 0);
        const totalPaid = warranty + paymentsSum;
        const balance = totalBudget - totalPaid;
        const coveragePercent = totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0;
        return { surgeriesTotal, miscCostsTotal, totalBudget, warranty, paymentsSum, totalPaid, balance, coveragePercent };
    }, [tempFinancials, selectedPrivatePatient?.surgeries]);

    const handleSelectPrivate = (patient: Patient) => {
        setSelectedPrivatePatient(patient);
        const rawFin = (patient.financialData || {}) as Partial<FinancialData>;
        const safeFin: FinancialData = {
            payments: rawFin.payments || [],
            observations: rawFin.observations || [],
            additionalCosts: rawFin.additionalCosts || [],
            warrantyAmount: rawFin.warrantyAmount,
            isClosed: rawFin.isClosed || false
        };
        setTempFinancials(safeFin);
    };

    const handleAddPrivatePayment = () => {
        if (!newPrivatePayment.amount || !newPrivatePayment.date) return;
        setTempFinancials(prev => ({ ...prev, payments: [...prev.payments, { id: Date.now().toString(), date: newPrivatePayment.date, amount: parseFloat(newPrivatePayment.amount), notes: newPrivatePayment.notes }] }));
        setNewPrivatePayment({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    };
    const handleDeletePrivatePayment = (id: string) => { setTempFinancials(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) })); };
    const handleAddMiscCost = () => {
        if (!newMiscCost.description || !newMiscCost.amount) return;
        setTempFinancials(prev => ({ ...prev, additionalCosts: [...(prev.additionalCosts || []), { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], description: newMiscCost.description, amount: parseFloat(newMiscCost.amount) }] }));
        setNewMiscCost({ description: '', amount: '' });
    };
    const handleDeleteMiscCost = (id: string) => { setTempFinancials(prev => ({ ...prev, additionalCosts: (prev.additionalCosts || []).filter(c => c.id !== id) })); };
    const handleAddObservation = () => { if (!newObservation.trim()) return; setTempFinancials(prev => ({ ...prev, observations: [{ id: Date.now().toString(), date: new Date().toISOString(), text: newObservation, author: sessionUser }, ...prev.observations] })); setNewObservation(''); };

    const handleUpdateSurgeryCostPrivate = (surgeryId: string, newCostStr: string) => {
        if (!selectedPrivatePatient) return;
        const newCost = parseFloat(newCostStr);
        const safeNewCost = isNaN(newCost) ? 0 : newCost;
        const updatedSurgeries = selectedPrivatePatient.surgeries.map(s => s.id === surgeryId ? { ...s, cost: safeNewCost } : s);
        const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
        const finalPatients = allPatients.map(p => p.id === selectedPrivatePatient.id ? { ...selectedPrivatePatient, surgeries: updatedSurgeries } : p);
        localStorage.setItem('omni_patients', JSON.stringify(finalPatients));
        setSelectedPrivatePatient({ ...selectedPrivatePatient, surgeries: updatedSurgeries });
        window.dispatchEvent(new Event('omni_db_update'));
    };

    const handleToggleSurgeryStatus = (surgeryId: string) => {
        if (!selectedPrivatePatient || !canApproveSurgery) return;
        let actionLog = '';
        const updatedSurgeries = selectedPrivatePatient.surgeries.map(s => {
            if (s.id === surgeryId) {
                const isNowApproved = s.paymentStatus !== 'approved';
                actionLog = isNowApproved ? `Cirugía "${s.procedure}" AUTORIZADA.` : `Cirugía "${s.procedure}" revertida.`;
                return { ...s, paymentStatus: isNowApproved ? 'approved' : 'pending' as any };
            }
            return s;
        });
        const updatedFinancials = { ...tempFinancials, observations: [{ id: Date.now().toString(), date: new Date().toISOString(), text: actionLog, author: sessionUser }, ...tempFinancials.observations] };
        const updatedPatient = { ...selectedPrivatePatient, surgeries: updatedSurgeries, financialData: updatedFinancials };
        const allPatients: Patient[] = JSON.parse(localStorage.getItem('omni_patients') || '[]');
        const finalPatients = allPatients.map(p => p.id === updatedPatient.id ? updatedPatient : p);
        localStorage.setItem('omni_patients', JSON.stringify(finalPatients));
        setTempFinancials(updatedFinancials);
        setSelectedPrivatePatient(updatedPatient);
        window.dispatchEvent(new Event('omni_db_update'));
    };

    const capAmount = currentRequest.initialApprovedAmount || 0;
    const currentApproved = currentRequest.approvedAmount || 0;
    const isOverCap = capAmount > 0 && currentApproved > capAmount;

    return (
        <div className="bg-slate-50 min-h-full flex flex-col gap-2 p-2">
            <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-slate-200 shrink-0 h-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`hidden md:flex p-1.5 rounded-lg border transition-colors ${!isSidebarOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'}`} title={isSidebarOpen ? "Ocultar Panel Lateral" : "Mostrar Panel Lateral"}><PanelLeft size={16} /></button>
                    <div className={`${subModule === 'insured' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'} p-1 rounded-lg transition-colors`}>{subModule === 'insured' ? <FileText size={16} /> : <Wallet size={16} />}</div>
                    <h2 className="text-xs font-bold text-slate-800 hidden sm:block">{subModule === 'insured' ? 'Gestión de Garantías' : 'Gestión de Particulares'}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowClosed(!showClosed)} className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors flex items-center gap-1 ${showClosed ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}><Archive size={12}/> {showClosed ? 'Ver Activos' : 'Ver Histórico'}</button>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button onClick={() => setSubModule('insured')} className={`px-3 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${subModule === 'insured' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}><FileText size={12}/> Asegurados</button>
                        <button onClick={() => setSubModule('private')} className={`px-3 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${subModule === 'private' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}><Wallet size={12}/> Particulares</button>
                    </div>
                </div>
            </div>

            {subModule === 'insured' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden gap-2">
                    <div className="flex border-b border-slate-200 bg-white rounded-lg shadow-sm px-1 shrink-0">
                        <button onClick={() => setInsuredTab('list')} className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${insuredTab === 'list' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Users size={14} /> Gestión</button>
                        <button onClick={() => setInsuredTab('report')} className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${insuredTab === 'report' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><BarChart3 size={14} /> Reporte</button>
                    </div>

                    {insuredTab === 'report' && (
                        <div className="flex-1 flex flex-col gap-2 overflow-hidden animate-in fade-in">
                            <div className="flex overflow-x-auto gap-2 shrink-0 pb-1 snap-x hide-scrollbar">
                                <div className="min-w-[70px] snap-center bg-yellow-50 p-1.5 rounded-lg border border-yellow-200 shadow-sm flex flex-col items-center justify-center h-10"><p className="text-[9px] text-yellow-600 font-bold uppercase leading-none mb-0.5">Pendientes</p><p className="text-sm font-bold text-yellow-700 leading-none">{kpiStats.pending}</p></div>
                                <div className="min-w-[70px] snap-center bg-white p-1.5 rounded-lg border border-blue-200 shadow-sm flex flex-col items-center justify-center h-10"><p className="text-[9px] text-blue-400 font-bold uppercase leading-none mb-0.5">Trámite</p><p className="text-sm font-bold text-blue-600 leading-none">{kpiStats.inProcess}</p></div>
                                <div className="min-w-[70px] snap-center bg-white p-1.5 rounded-lg border border-green-200 shadow-sm flex flex-col items-center justify-center h-10"><p className="text-[9px] text-green-400 font-bold uppercase leading-none mb-0.5">Aprobados</p><p className="text-sm font-bold text-green-600 leading-none">{kpiStats.approved}</p></div>
                                <div className="min-w-[70px] snap-center bg-white p-1.5 rounded-lg border border-orange-200 shadow-sm flex flex-col items-center justify-center h-10"><p className="text-[9px] text-orange-400 font-bold uppercase leading-none mb-0.5">Obs.</p><p className="text-sm font-bold text-orange-600 leading-none">{kpiStats.observed}</p></div>
                                <div className="min-w-[70px] snap-center bg-white p-1.5 rounded-lg border border-purple-200 shadow-sm flex flex-col items-center justify-center h-10"><p className="text-[9px] text-purple-400 font-bold uppercase leading-none mb-0.5">Reingreso</p><p className="text-sm font-bold text-purple-600 leading-none">{kpiStats.reentered}</p></div>
                                <div className="min-w-[70px] snap-center bg-white p-1.5 rounded-lg border border-red-200 shadow-sm flex flex-col items-center justify-center h-10"><p className="text-[9px] text-red-400 font-bold uppercase leading-none mb-0.5">Rechazados</p><p className="text-sm font-bold text-red-600 leading-none">{kpiStats.rejected}</p></div>
                            </div>

                            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-2 border-b border-slate-200 bg-slate-50">
                                    <div className="flex items-center gap-2 mb-2 md:mb-0">
                                         <div className="flex flex-1 items-center gap-2 w-full">
                                             <div className="bg-slate-800 text-white px-2 py-1.5 rounded-lg text-xs font-bold shrink-0">{kpiStats.total}</div>
                                             <button onClick={handleExportExcel} className="bg-green-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-700 shadow-sm shrink-0" title="Descargar Excel"><FileSpreadsheet size={14}/> <span className="hidden sm:inline">Excel</span></button>
                                             <div className="relative flex-1">
                                                <Search className="absolute left-2 top-2 text-slate-400" size={14} />
                                                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500 bg-white shadow-sm" />
                                             </div>
                                             <button onClick={() => setShowMobileFilters(!showMobileFilters)} className={`md:hidden p-1.5 rounded-lg border shrink-0 transition-colors ${showMobileFilters ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}><Filter size={16} /></button>
                                         </div>
                                    </div>
                                    <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-2 mt-2 md:mt-0 items-center border-t md:border-t-0 border-slate-200 pt-2 md:pt-0`}>
                                         <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="w-full md:w-auto py-1.5 px-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500 bg-white text-slate-600 font-medium">
                                            <option value="">Todos los Orígenes</option><option value="Hospitalización">Hospitalización</option><option value="Emergencia">Emergencia</option><option value="Consulta Externa">Consulta Externa</option><option value="Medicina Física">Medicina Física</option><option value="Ambulatorio">Ambulatorio</option><option value="SOAT">SOAT</option>
                                         </select>
                                         <div className="flex w-full md:w-auto gap-2">
                                             <div className="flex-1 md:flex-none flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-sm"><span className="text-[10px] text-slate-400 font-bold">Del:</span><input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="text-xs border-none outline-none w-full md:w-24 text-slate-600 bg-white" /></div>
                                             <div className="flex-1 md:flex-none flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-sm"><span className="text-[10px] text-slate-400 font-bold">Al:</span><input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="text-xs border-none outline-none w-full md:w-24 text-slate-600 bg-white" /></div>
                                         </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto bg-slate-50 p-2 md:p-0">
                                    <table className="w-full text-left border-collapse hidden md:table">
                                        <thead className="bg-white text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                                            <tr><th className="px-3 py-2 bg-white">Fecha Rec.</th><th className="px-3 py-2 bg-white">Paciente</th><th className="px-3 py-2 bg-white">Origen</th><th className="px-3 py-2 bg-white">Carta / Correo</th><th className="px-3 py-2 bg-white">Procedimiento</th><th className="px-3 py-2 bg-white">Económico</th><th className="px-3 py-2 bg-white">Estado</th><th className="px-3 py-2 bg-white">Respuesta</th><th className="px-3 py-2 bg-white text-center">Admin</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {reportRequests.map(req => (
                                                <tr key={req.id} onDoubleClick={() => handleReportRowDoubleClick(req)} className="bg-white hover:bg-blue-50 border-b border-slate-100 transition-colors cursor-pointer select-none">
                                                    <td className="px-3 py-1.5 font-mono text-slate-600 text-[10px] bg-white">{formatShortDate(req.receptionDate)}</td>
                                                    <td className="px-3 py-1.5 bg-white"><div className="font-bold text-slate-800 text-[10px]">{req.patientName}</div><div className="text-[9px] text-slate-500">{req.patientDoc} • {req.insurance}</div></td>
                                                    <td className="px-3 py-1.5 font-bold text-slate-500 text-[10px] bg-white">{req.origin || '-'}</td>
                                                    <td className="px-3 py-1.5 text-[10px] bg-white font-mono text-slate-600">{req.letterNumber}</td>
                                                    <td className="px-3 py-1.5 bg-white"><div className="text-slate-800 font-medium text-[10px]">{req.procedure}</div></td>
                                                    <td className="px-3 py-1.5 bg-white">{req.totalAmount ? <div className="text-[9px]"><div>Total: S/{req.totalAmount}</div><div className="text-green-600 font-bold">Cob: S/{req.approvedAmount?.toFixed(2)}</div></div> : <span className="text-[9px] text-slate-300">-</span>}</td>
                                                    <td className="px-3 py-1.5 bg-white"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(req.status)}`}>{req.status}</span></td>
                                                    <td className="px-3 py-1.5 bg-white"><div className="text-slate-600 text-[10px]">{req.responseDate ? formatShortDate(req.responseDate) : '-'}</div>{req.responseDate && <div className="text-[8px] text-slate-400">Demora: {getDaysDiff(req.receptionDate, req.responseDate)}</div>}</td>
                                                    <td className="px-3 py-1.5 bg-white text-center" title={req.isClosed ? "Cerrado/Archivado" : "Activo"}>{req.isClosed ? <Lock size={12} className="mx-auto text-slate-400" /> : <Unlock size={12} className="mx-auto text-green-400" />}</td>
                                                </tr>
                                            ))}
                                            {reportRequests.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400 italic bg-white">No se encontraron solicitudes.</td></tr>}
                                        </tbody>
                                    </table>
                                    <div className="md:hidden space-y-2">
                                        {reportRequests.map(req => (
                                            <div key={req.id} onClick={() => handleReportRowDoubleClick(req)} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm active:bg-slate-50 transition-colors">
                                                <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{formatShortDate(req.receptionDate)}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusColor(req.status)}`}>{req.status}</span></div>{req.isClosed ? <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"><Lock size={10}/> CERRADO</div> : <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100"><Unlock size={10}/> ACTIVO</div>}</div>
                                                <div className="mb-2"><h3 className="text-sm font-bold text-slate-800 leading-tight">{req.patientName}</h3><p className="text-[10px] text-slate-500 mt-0.5">{req.letterNumber} • {req.insurance}</p></div>
                                                <div className="text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 mb-2">{req.procedure}</div>
                                                {req.totalAmount ? <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100"><span className="text-slate-500">Total: <span className="font-bold text-slate-700">S/{req.totalAmount}</span></span><span className="text-green-600 font-bold">Cob: S/{req.approvedAmount?.toFixed(2)}</span></div> : <div className="text-[10px] text-slate-300 italic text-center pt-1 border-t border-slate-100">- Sin datos económicos -</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {insuredTab === 'list' && (
                        <div className="flex flex-1 gap-2 overflow-hidden animate-in fade-in relative">
                            {/* ... (Existing List View remains mostly unchanged) ... */}
                            <div className={`${isMobileDetailOpen ? 'hidden' : 'flex'} ${!isSidebarOpen ? 'md:hidden' : 'md:flex'} w-full md:w-1/3 min-w-[280px] bg-white rounded-xl border border-slate-200 shadow-sm flex-col overflow-hidden`}>
                                <div className="p-2 border-b border-slate-200 bg-slate-50">
                                    <div className="flex flex-col gap-2 mb-2">
                                        <div className="relative"><Search className="absolute left-2 top-2 text-slate-400" size={14} /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500 bg-white" /></div>
                                        <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="w-full py-1 text-[10px] border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500 bg-white text-slate-500"><option value="">Todos los Orígenes</option><option value="Hospitalización">Hospitalización</option><option value="Emergencia">Emergencia</option><option value="Consulta Externa">Consulta Externa</option><option value="Medicina Física">Medicina Física</option><option value="Ambulatorio">Ambulatorio</option><option value="SOAT">SOAT</option></select>
                                    </div>
                                    <button onClick={handleNewRequest} className="w-full bg-primary-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary-700 shadow-sm"><Plus size={14}/> Nueva Solicitud</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                                    {sidebarRequests.map(req => (
                                        <div key={req.id} onClick={() => handleSearchSelect(req)} className={`p-2 rounded border cursor-pointer transition-all ${selectedRequestId === req.id ? 'bg-primary-50 border-primary-400 ring-1 ring-primary-300' : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300'} ${req.isClosed ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                            <div className="flex justify-between items-start mb-0.5"><div className="font-bold text-xs text-slate-800 truncate pr-2">{req.patientName}</div><div className="flex items-center gap-1">{req.isClosed && <Archive size={10} className="text-slate-400" />}<span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${getStatusColor(req.status)}`}>{req.status}</span></div></div>
                                            <div className="text-[10px] text-slate-500 flex justify-between items-center"><span className="truncate max-w-[120px] font-medium">{req.letterNumber}</span><span className="font-mono text-[9px] bg-slate-100 px-1 rounded">{formatShortDate(req.receptionDate)}</span></div>
                                            {req.totalAmount && <div className="mt-1 pt-1 border-t border-slate-100 flex justify-between text-[9px]"><span className="text-slate-400">Total: <span className="font-bold text-slate-600">S/{req.totalAmount}</span></span><span className="text-green-600 font-bold">Cob: {req.coveragePercent}%</span></div>}
                                        </div>
                                    ))}
                                    {sidebarRequests.length === 0 && <div className="text-center py-8 text-xs text-slate-400 italic">Sin resultados</div>}
                                </div>
                            </div>

                            <div className={`${!isMobileDetailOpen ? 'hidden md:flex' : 'flex'} flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex-col overflow-hidden relative absolute md:relative inset-0 z-10 md:z-0`}>
                                {selectedRequestId ? (
                                    <div className="flex flex-col h-full">
                                        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                                            <div className="flex items-center gap-2"><button onClick={() => setIsMobileDetailOpen(false)} className="md:hidden p-1 bg-white border border-slate-200 rounded-full text-slate-500 hover:text-slate-700"><ArrowLeft size={16} /></button><div className="flex flex-col"><h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">{selectedRequestId === 'new' ? 'Nueva Solicitud' : <><FileText size={14} className="text-primary-600"/> ID: {selectedRequestId.substring(0,8)}...</>}</h3></div></div>
                                            <div className="flex gap-3 items-center"><button onClick={() => { const isClosing = !currentRequest.isClosed; if (isClosing && !confirm('¿Cerrar administrativamente?')) return; setCurrentRequest({ ...currentRequest, isClosed: isClosing }); }} className={`px-2 py-1 rounded text-[9px] font-bold border flex items-center gap-1 transition-colors ${currentRequest.isClosed ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-800 hover:text-slate-800'}`}><Archive size={12}/> {currentRequest.isClosed ? 'Re-abrir' : 'Alta Administrativa'}</button><div className="text-[10px] flex items-center gap-1 min-w-[70px] justify-end">{insuredSaveStatus === 'saving' && <><Loader2 size={10} className="animate-spin text-slate-400" /> <span className="text-slate-400">...</span></>}{insuredSaveStatus === 'saved' && <><Check size={12} className="text-green-500" /> <span className="text-green-600 font-bold">OK</span></>}</div></div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 bg-slate-50 space-y-2">
                                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm"><h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-100 pb-1">Datos Generales</h4><div className="grid grid-cols-12 gap-1.5"><div className="col-span-6"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Apellidos</label><input type="text" value={formNames.last} onChange={e => setFormNames({...formNames, last: e.target.value})} className="w-full h-6 border rounded px-2 text-[10px] bg-white text-slate-900 focus:border-primary-500 outline-none" /></div><div className="col-span-6"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Nombres</label><input type="text" value={formNames.first} onChange={e => setFormNames({...formNames, first: e.target.value})} className="w-full h-6 border rounded px-2 text-[10px] bg-white text-slate-900 focus:border-primary-500 outline-none" /></div><div className="col-span-4"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">DNI / CE</label><input type="text" value={currentRequest.patientDoc || ''} onChange={e => setCurrentRequest({...currentRequest, patientDoc: e.target.value})} className="w-full h-6 border rounded px-2 text-[10px] bg-white text-slate-900 font-mono focus:border-primary-500 outline-none" /></div><div className="col-span-4"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Seguro</label>
                                                <select 
                                                    value={currentRequest.insurance || ''} 
                                                    onChange={e => setCurrentRequest({...currentRequest, insurance: e.target.value})} 
                                                    className="w-full h-6 border rounded px-1 text-[10px] bg-white text-slate-900 focus:border-primary-500 outline-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {availableInsurances.map(ins => (
                                                        <option key={ins.name} value={ins.name}>{ins.name} ({ins.type})</option>
                                                    ))}
                                                </select></div><div className="col-span-4"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Cama</label><input type="text" value={currentRequest.bedNumber || ''} onChange={e => setCurrentRequest({...currentRequest, bedNumber: e.target.value})} className="w-full h-6 border rounded px-2 text-[10px] bg-white text-slate-900 font-bold focus:border-primary-500 outline-none" /></div></div></div>
                                            {linkedPatient ? (
                                                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm overflow-x-auto"><div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1"><h4 className="text-[9px] font-bold text-slate-400 uppercase">Gestión de Cartas Hospitalarias</h4><button onClick={handleAddLetter} className="text-[9px] flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100"><Plus size={10}/> Nueva Carta</button></div><div className="min-w-full"><div className="hidden sm:grid grid-cols-12 gap-1 text-[8px] font-bold text-slate-400 uppercase mb-1 px-1"><div className="col-span-1 text-center">#</div><div className="col-span-4">Detalle / Procedimiento</div><div className="col-span-3">Fechas (Rec/Trám/Resp)</div><div className="col-span-4 text-center">Estado</div></div><div className="space-y-2 sm:space-y-0.5">{linkedPatient.warrantyLetters.map((letter, idx) => { const mappedReqStatus = requests.find(r => r.id === letter.id)?.status || 'PENDIENTE'; return (<div key={letter.id} className="flex flex-col sm:grid sm:grid-cols-12 gap-1.5 sm:gap-1 items-start sm:items-center bg-slate-50 px-2 py-2 sm:px-1 sm:py-0.5 rounded border border-slate-200 sm:border-slate-100 hover:border-blue-200 transition-colors"><div className="flex justify-between items-center w-full sm:w-auto sm:col-span-1 sm:justify-center"><span className="text-[9px] font-bold text-slate-500 sm:hidden">Carta #{letter.number}</span><div className="text-[9px] font-bold text-slate-500 text-center hidden sm:block">#{letter.number}</div><div className="sm:hidden"><select value={mappedReqStatus} onChange={(e) => handleStatusChange(e.target.value, letter.id)} className={`h-5 text-[9px] border rounded px-1 outline-none font-bold ${mappedReqStatus === 'APROBADO' ? 'text-green-700 border-green-200 bg-green-50' : 'text-slate-600 border-slate-300 bg-white'}`}>{['PENDIENTE','EN TRAMITE','APROBADO','OBSERVADO','RECHAZADA'].map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="w-full sm:col-span-4 flex flex-col gap-1.5 sm:gap-0.5"><input type="text" value={letter.name || ''} onChange={(e) => handleUpdateLetter(letter.id, 'name', e.target.value)} placeholder="Nro Carta..." className="w-full h-5 sm:h-4 text-[9px] border sm:border-none rounded sm:rounded-none px-1 sm:p-0 bg-white sm:bg-transparent outline-none font-mono"/><select value={linkedPatient.surgeries.find(s => s.linkedLetterId === letter.id)?.id || ''} onChange={(e) => handleAssociateSurgery(letter.id, e.target.value)} className="w-full h-5 sm:h-4 text-[9px] sm:text-[8px] border sm:border-none rounded sm:rounded-none px-1 sm:p-0 bg-white sm:bg-transparent outline-none text-slate-500"><option value="">(Cirugía)</option>{linkedPatient.surgeries.map(s => <option key={s.id} value={s.id}>{s.procedure}</option>)}</select></div><div className="w-full sm:col-span-3 flex items-center gap-1 sm:gap-0.5"><div className="h-5 flex-1 flex items-center justify-center bg-white border border-slate-200 rounded text-[8px] font-mono text-slate-500">{formatShortDate(letter.receptionDate) || '-'}</div><input type="date" value={letter.processingDate || ''} onChange={(e) => handleUpdateLetter(letter.id, 'processingDate', e.target.value)} className="h-5 flex-1 w-full text-[8px] border border-slate-200 rounded px-0 bg-white text-center outline-none"/><input type="date" value={letter.responseDate || ''} onChange={(e) => handleUpdateLetter(letter.id, 'responseDate', e.target.value)} className="h-5 flex-1 w-full text-[8px] border border-slate-200 rounded px-0 bg-white text-center outline-none"/></div><div className="hidden sm:block col-span-4"><select value={mappedReqStatus} onChange={(e) => handleStatusChange(e.target.value, letter.id)} className={`w-full h-5 text-[9px] border rounded px-1 outline-none font-bold ${mappedReqStatus === 'APROBADO' ? 'text-green-700 border-green-200 bg-green-50' : 'text-slate-600 border-slate-300 bg-white'}`}>{['PENDIENTE','EN TRAMITE','APROBADO','OBSERVADO','RECHAZADA'].map(s => <option key={s} value={s}>{s}</option>)}</select></div></div>); })}</div></div></div>
                                            ) : (
                                                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm"><h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-100 pb-1">Detalle de Solicitud</h4><div className="grid grid-cols-12 gap-1.5 items-end"><div className="col-span-4"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Origen</label><select value={currentRequest.origin || ''} onChange={e => setCurrentRequest({...currentRequest, origin: e.target.value as any})} className="w-full h-6 border rounded px-1 text-[10px] bg-white text-slate-900 outline-none"><option value="">Seleccionar...</option><option value="Hospitalización">Hospitalización</option><option value="Emergencia">Emergencia</option><option value="Consulta Externa">Consulta Externa</option><option value="Medicina Física">Medicina Física</option><option value="Ambulatorio">Ambulatorio</option><option value="SOAT">SOAT-Consulta</option></select></div><div className="col-span-3"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Carta/Correo</label><input type="text" value={currentRequest.letterNumber || ''} onChange={e => setCurrentRequest({...currentRequest, letterNumber: e.target.value})} className="w-full h-6 border rounded px-2 text-[10px] bg-white text-slate-900 outline-none" /></div><div className="col-span-5"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Procedimiento</label><input type="text" value={currentRequest.procedure || ''} onChange={e => setCurrentRequest({...currentRequest, procedure: e.target.value})} className="w-full h-6 border rounded px-2 text-[10px] bg-white text-slate-900 outline-none" /></div><div className="col-span-12 mt-2 pt-2 border-t border-slate-100"><div className="flex flex-col gap-2"><div className="flex items-center gap-2"><label className="text-[9px] font-bold text-slate-500 uppercase shrink-0">Estado:</label><div className="flex flex-wrap gap-1">{['PENDIENTE','EN TRAMITE','APROBADO','OBSERVADO','RECHAZADA'].map(st => (<button key={st} onClick={() => handleStatusChange(st)} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all flex items-center gap-1 ${currentRequest.status === st ? getStatusColor(st as WarrantyStatus) : 'bg-white border-slate-200 text-slate-500'}`}>{st}</button>))}</div></div><div className="flex gap-2"><div className="flex-1"><label className="text-[8px] font-bold text-slate-400 block mb-0">F. Recepción</label><input type="date" value={currentRequest.receptionDate || ''} onChange={e => setCurrentRequest({...currentRequest, receptionDate: e.target.value})} className="w-full text-[9px] h-6 border rounded px-1 outline-none bg-white" /></div><div className="flex-1"><label className="text-[8px] font-bold text-slate-400 block mb-0">F. Trámite</label><input type="date" value={currentRequest.processingDate || ''} onChange={e => setCurrentRequest({...currentRequest, processingDate: e.target.value})} className="w-full text-[9px] h-6 border rounded px-1 outline-none bg-white" /></div><div className="flex-1"><label className="text-[8px] font-bold text-slate-400 block mb-0">F. Respuesta</label><input type="date" value={currentRequest.responseDate || ''} onChange={e => setCurrentRequest({...currentRequest, responseDate: e.target.value})} className="w-full text-[9px] h-6 border rounded px-1 outline-none bg-white" /></div></div></div></div></div></div>
                                            )}

                                            {/* GRID CONTAINER FOR FINANCIAL DETAILS */}
                                            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 bg-slate-50">
                                                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                                    <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-100 pb-1 flex items-center gap-1"><Coins size={12}/> Calculadora Económica</h4>
                                                    <div className="flex gap-2 items-end mb-2">
                                                        <div className="flex-1"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Monto Total (S/)</label><input readOnly type="text" value={currentRequest.totalAmount?.toFixed(2) || '0.00'} className="w-full h-6 border rounded px-2 text-[10px] font-bold bg-slate-100 text-slate-700 outline-none" /></div>
                                                        <div className="w-16"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">% Cob.</label><input type="number" value={currentRequest.coveragePercent || ''} onChange={e => setCurrentRequest({...currentRequest, coveragePercent: parseFloat(e.target.value)})} className="w-full h-6 border rounded px-2 text-[10px] font-bold bg-white text-slate-900 outline-none text-center" /></div>
                                                        <div className="w-24 relative"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0">Monto Tope Carta</label><input type="number" value={currentRequest.initialApprovedAmount === undefined ? '' : currentRequest.initialApprovedAmount} onChange={e => setCurrentRequest({...currentRequest, initialApprovedAmount: parseFloat(e.target.value)})} className={`w-full h-6 border rounded px-2 text-[10px] font-bold outline-none text-right ${isOverCap ? 'border-red-400 bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`} />{isOverCap && <AlertTriangle size={12} className="absolute top-0 right-0 text-red-500 animate-pulse" />}</div>
                                                        <div className="flex-1"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-0 text-center">Cobertura</label><input readOnly type="text" value={`S/ ${currentRequest.approvedAmount?.toFixed(2) || '0.00'}`} className={`w-full h-6 border border-slate-200 rounded px-2 text-[10px] font-bold outline-none text-center ${isOverCap ? 'text-red-600' : 'text-green-600'}`} /></div>
                                                    </div>
                                                    {/* ... Financial grid ... */}
                                                    <div className="mb-4">
                                                        <div className="grid grid-cols-12 gap-1 text-[8px] font-bold text-slate-400 uppercase bg-white p-1 rounded-t border-b border-slate-200"><div className="col-span-3">Concepto</div><div className="col-span-2 text-right">Monto (S/)</div><div className="col-span-2 text-right">Copago</div><div className="col-span-2 text-center">Carta</div><div className="col-span-2 text-center">Abonado</div><div className="col-span-1"></div></div>
                                                        <div className="border border-slate-200 rounded-b max-h-32 overflow-y-auto bg-white mb-2">
                                                            {financialDetails.map((item, idx) => {
                                                                const paidForThisItem = getPaidForExpense(item.id);
                                                                const isFullyPaid = paidForThisItem >= item.patientShare - 0.01;
                                                                return (
                                                                    <div key={item.id} className={`grid grid-cols-12 gap-1 items-center p-1 border-b border-slate-100 text-[10px] bg-white`}>
                                                                        <div className="col-span-3 truncate"><span className={item.type === 'surgery' ? 'font-bold text-blue-800' : 'text-slate-700'}>{item.description}</span></div>
                                                                        <div className="col-span-2">
                                                                            <input 
                                                                                type="number" 
                                                                                value={item.amount} 
                                                                                onChange={(e) => handleUpdateExpense(item.id, 'amount', e.target.value)} 
                                                                                className="w-full text-right bg-transparent focus:bg-white focus:ring-2 focus:ring-primary-100 rounded px-1 border-none outline-none font-medium text-slate-800 transition-colors" 
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2 text-right font-bold text-slate-700">{item.patientShare.toFixed(2)}</div>
                                                                        <div className="col-span-2">
                                                                            {linkedPatient ? 
                                                                                <select 
                                                                                    value={item.linkedLetterId || ''} 
                                                                                    onChange={(e) => handleUpdateExpense(item.id, 'linkedLetterId', e.target.value)} 
                                                                                    className="w-full text-[9px] border-none bg-transparent focus:bg-white focus:ring-2 focus:ring-primary-100 rounded px-1 outline-none text-slate-500 text-center transition-colors"
                                                                                >
                                                                                    <option value="">-</option>{linkedPatient.warrantyLetters.map(l => <option key={l.id} value={l.id}>#{l.number}</option>)}
                                                                                </select> 
                                                                                : <span className="text-slate-300 text-center block">-</span>
                                                                            }
                                                                        </div>
                                                                        <div className="col-span-2 text-center"><span className={`text-[8px] px-1 rounded ${isFullyPaid ? 'bg-green-100 text-green-700' : 'text-slate-300'}`}>{isFullyPaid ? 'PAGADO' : `S/ ${paidForThisItem.toFixed(2)}`}</span></div>
                                                                        <div className="col-span-1 text-center">{item.type === 'extra' && <button onClick={() => handleRemoveExpense(item.id)} className="text-slate-300 hover:text-red-500"><XCircle size={12}/></button>}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="flex gap-1 items-center"><input type="text" value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)} className="flex-1 h-6 text-[10px] border border-slate-300 rounded px-2 bg-white outline-none" placeholder="Nuevo gasto..." /><input type="number" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} className="w-16 h-6 text-[10px] border border-slate-300 rounded px-2 bg-white outline-none" placeholder="S/" /><button onClick={handleAddExpense} className="h-6 w-6 bg-slate-700 text-white rounded flex items-center justify-center hover:bg-slate-800"><Plus size={12}/></button></div>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[9px] font-bold text-slate-500 uppercase mb-1 border-t border-slate-100 pt-2 flex items-center gap-1"><TrendingUp size={12}/> Abonos / Pagos</h4>
                                                        <div className="bg-white rounded border border-slate-200">
                                                            <div className="max-h-24 overflow-y-auto"><table className="w-full text-[9px] text-left"><thead className="bg-white text-slate-500"><tr><th className="px-2 py-1 bg-white">Fecha</th><th className="px-2 py-1 bg-white">Monto</th><th className="px-2 py-1 bg-white">Detalle</th><th className="w-6 bg-white"></th></tr></thead><tbody className="divide-y divide-slate-100">{patientPayments.map(p => (<tr key={p.id}><td className="px-2 py-1 text-slate-600 bg-white">{p.date}</td><td className="px-2 py-1 font-bold text-green-700 bg-white">{p.amount.toFixed(2)}</td><td className="px-2 py-1 text-slate-500 bg-white">{p.notes}</td><td className="text-center bg-white"><button onClick={() => handleDeletePayment(p.id)} className="text-slate-300 hover:text-red-500"><XCircle size={10}/></button></td></tr>))}</tbody></table></div>
                                                            <div className="p-1 border-t border-slate-200 flex gap-1 items-center bg-white rounded-b flex-wrap"><input type="date" value={newPaymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="w-20 h-6 text-[9px] border rounded px-1 bg-white outline-none" /><input type="number" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} placeholder="S/" className="w-16 h-6 text-[9px] border rounded px-1 bg-white outline-none" /><input type="text" value={newPaymentNote} onChange={e => setNewPaymentNote(e.target.value)} placeholder="Obs..." className="flex-1 h-6 text-[9px] border rounded px-1 bg-white outline-none" /><select value={newPaymentLinkedId} onChange={e => setNewPaymentLinkedId(e.target.value)} className="w-24 h-6 text-[9px] border rounded px-1 bg-white outline-none"><option value="">Vincular...</option>{financialDetails.filter(f => f.patientShare > 0).map(f => (<option key={f.id} value={f.id}>{f.description}</option>))}</select><button onClick={handleAddPayment} className="h-6 w-6 bg-green-600 text-white rounded flex items-center justify-center"><Plus size={12}/></button></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Payments Section */}
                                                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><TrendingUp size={12}/> Pagos Registrados</h4>
                                                    </div>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                        {tempFinancials.payments?.map(pay => (
                                                            <div key={pay.id} className="flex justify-between items-center text-[10px] p-1 border-b border-slate-50">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-700">S/ {pay.amount.toFixed(2)}</span>
                                                                    <span className="text-[8px] text-slate-400">{pay.date} - {pay.notes}</span>
                                                                </div>
                                                                <button onClick={() => handleDeletePrivatePayment(pay.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-1 pt-1 flex-wrap">
                                                        <input type="date" value={newPrivatePayment.date} onChange={e => setNewPrivatePayment({...newPrivatePayment, date: e.target.value})} className="w-20 h-6 text-[9px] border rounded px-1 outline-none" />
                                                        <input type="number" placeholder="Monto" value={newPrivatePayment.amount} onChange={e => setNewPrivatePayment({...newPrivatePayment, amount: e.target.value})} className="w-16 h-6 text-[9px] border rounded px-1 outline-none" />
                                                        <input type="text" placeholder="Nota..." value={newPrivatePayment.notes} onChange={e => setNewPrivatePayment({...newPrivatePayment, notes: e.target.value})} className="flex-1 h-6 text-[9px] border rounded px-1 outline-none" />
                                                        <button onClick={handleAddPrivatePayment} className="h-6 w-6 bg-emerald-600 text-white rounded flex items-center justify-center hover:bg-emerald-700"><Plus size={12}/></button>
                                                    </div>
                                                </div>

                                                {/* Right Column (Surgeries & Observations) - NOW INSIDE GRID */}
                                                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-3 overflow-hidden">
                                                    {/* Surgeries List */}
                                                    <div className="flex flex-col gap-2">
                                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 border-b border-slate-100 pb-1"><Scissors size={12}/> Procedimientos</h4>
                                                        <div className="space-y-1 overflow-y-auto max-h-48">
                                                            {/* Surgeries Logic */}
                                                            {(selectedPrivatePatient?.surgeries || []).filter(s => s.status !== 'cancelled').map(s => (
                                                                <div key={s.id} className="p-2 border rounded bg-slate-50 flex flex-col gap-1">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-[10px] font-bold text-slate-700">{s.procedure}</span>
                                                                        <button 
                                                                            onClick={() => handleToggleSurgeryStatus(s.id)}
                                                                            disabled={!canApproveSurgery}
                                                                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${s.paymentStatus === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-200 text-slate-500 border-slate-300'}`}
                                                                        >
                                                                            {s.paymentStatus === 'approved' ? 'AUTORIZADO' : 'PENDIENTE'}
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[9px] text-slate-400">{s.date}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[9px] font-bold text-slate-500">S/</span>
                                                                            <input 
                                                                                type="number" 
                                                                                value={s.cost || ''} 
                                                                                onChange={(e) => handleUpdateSurgeryCostPrivate(s.id, e.target.value)}
                                                                                className="w-16 h-5 text-[10px] text-right font-bold border rounded px-1 outline-none focus:border-emerald-400"
                                                                                placeholder="0.00"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {(selectedPrivatePatient?.surgeries || []).filter(s => s.status !== 'cancelled').length === 0 && (
                                                                <div className="text-center py-4 text-[10px] text-slate-400 italic">No hay cirugías registradas.</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Observations Log */}
                                                    <div className="flex flex-col gap-2 flex-1 min-h-0">
                                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 border-b border-slate-100 pb-1"><MessageSquare size={12}/> Bitácora</h4>
                                                        <div className="flex-1 overflow-y-auto space-y-2 bg-slate-50 p-2 rounded border border-slate-100">
                                                            {tempFinancials.observations.map(obs => (
                                                                <div key={obs.id} className="bg-white p-1.5 rounded border border-slate-200 shadow-sm">
                                                                    <div className="flex justify-between items-center mb-0.5">
                                                                        <span className="text-[8px] font-bold text-slate-600">{obs.author}</span>
                                                                        <span className="text-[8px] text-slate-400">{new Date(obs.date).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="text-[9px] text-slate-700 leading-snug">{obs.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-1 pt-1">
                                                            <input type="text" value={newObservation} onChange={e => setNewObservation(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddObservation()} className="flex-1 h-7 text-[10px] border rounded px-2 outline-none" placeholder="Nueva observación..." />
                                                            <button onClick={handleAddObservation} disabled={!newObservation.trim()} className="h-7 w-7 bg-slate-800 text-white rounded flex items-center justify-center hover:bg-slate-900 disabled:opacity-50"><Send size={12}/></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-col min-h-[150px]">
                                                <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-100 pb-1 flex items-center gap-1"><MessageSquare size={12}/> Bitácora de Observaciones</h4>
                                                <div className="flex-1 overflow-y-auto space-y-2 mb-2 max-h-[150px] bg-slate-50 rounded p-1.5 border border-slate-100">{(currentRequest.notesLog || []).map(note => (<div key={note.id} className="bg-white p-2 rounded border border-slate-200 shadow-sm"><div className="flex justify-between items-center mb-1"><span className="text-[8px] font-bold text-primary-700 uppercase">{note.author}</span><span className="text-[8px] text-slate-400">{new Date(note.date).toLocaleString()}</span></div><p className="text-[10px] text-slate-700 leading-snug">{note.text}</p></div>))}</div>
                                                <div className="flex gap-1 mt-auto pt-1 border-t border-slate-100"><input type="text" value={newNoteText} onChange={e => setNewNoteText(e.target.value)} className="flex-1 h-8 text-[10px] border border-slate-300 rounded px-2 bg-white outline-none" placeholder="Nueva observación..." onKeyDown={e => e.key === 'Enter' && handleAddNote()} /><button onClick={handleAddNote} disabled={!newNoteText.trim()} className="bg-slate-800 text-white h-8 w-8 rounded flex items-center justify-center hover:bg-slate-900 disabled:opacity-50"><Send size={14} /></button></div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-60"><FileText size={48} className="mb-4 text-slate-200" /><p className="text-sm font-bold text-slate-400">Seleccione para ver detalle</p></div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {subModule === 'private' && (
                <div className="flex flex-col md:flex-row gap-2 h-full overflow-hidden flex-1 min-h-0">
                    <div className={`w-full md:w-1/3 flex flex-col gap-2 min-w-[250px] max-w-[300px] ${!isSidebarOpen ? 'md:hidden' : ''}`}>
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex gap-2"><div className="relative flex-1"><Search className="absolute left-2 top-1.5 text-slate-400" size={12} /><input type="text" placeholder="Buscar..." value={privateSearch} onChange={e => setPrivateSearch(e.target.value)} className="w-full pl-6 pr-2 py-1 text-[10px] border border-slate-200 rounded-lg outline-none bg-white" /></div></div>
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                            {privatePatients.map(p => {
                                const fin = p.financialData || { payments: [], observations: [], additionalCosts: [] } as FinancialData;
                                const totalPaid = (fin.warrantyAmount || 0) + (fin.payments || []).reduce((acc, curr) => acc + curr.amount, 0);
                                const surgeriesTotal = (p.surgeries || []).filter(s => s.status !== 'cancelled').reduce((acc, s) => acc + (s.cost || 0), 0);
                                const miscCostsTotal = (fin.additionalCosts || []).reduce((acc, c) => acc + (c.amount || 0), 0);
                                const totalBudget = surgeriesTotal + miscCostsTotal;
                                const progress = totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0;
                                return (<div key={p.id} onClick={() => handleSelectPrivate(p)} className={`p-2 rounded border cursor-pointer hover:shadow-sm transition-all ${selectedPrivatePatient?.id === p.id ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400' : 'bg-white border-slate-200'} ${fin.isClosed ? 'opacity-50 grayscale-[0.5]' : ''}`}><div className="flex justify-between items-start mb-1"><div className="flex-1 min-w-0"><h4 className="text-xs font-bold text-slate-800 truncate">{p.name}</h4><p className="text-[9px] text-slate-500 font-mono">{p.dni}</p></div><div className="flex flex-col items-end gap-1"><span className="text-[9px] font-bold bg-slate-800 text-white px-1.5 rounded shrink-0">{p.bedNumber}</span>{fin.isClosed && <Archive size={10} className="text-slate-400" />}</div></div><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }}></div></div></div>);
                            })}
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        {selectedPrivatePatient ? (
                            <div className="flex flex-col h-full">
                                <div className="bg-slate-50 border-b border-slate-200 p-2 px-3 flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><div><h3 className="text-sm font-bold text-slate-800">{selectedPrivatePatient.name}</h3><p className="text-[10px] text-slate-500">Cama: {selectedPrivatePatient.bedNumber}</p></div><button onClick={() => { const isClosing = !tempFinancials.isClosed; if (isClosing && !confirm('¿Cerrar?')) return; setTempFinancials({ ...tempFinancials, isClosed: isClosing }); }} className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${tempFinancials.isClosed ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-800'}`}><Archive size={12}/> {tempFinancials.isClosed ? 'Re-abrir' : 'Cerrar Administrativo'}</button></div><div className="flex items-center gap-2">{saveStatus === 'saving' && <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse"><RotateCcw size={12}/> ...</span>}{saveStatus === 'saved' && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={14}/> OK</span>}</div></div>
                                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 bg-slate-50">
                                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-3">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 border-b border-slate-100 pb-1"><Calculator size={12}/> Resumen Presupuesto</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase">Garantía / Abono Inicial</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-2 text-slate-400 text-xs font-bold">S/</span>
                                                    <input type="number" value={tempFinancials.warrantyAmount === undefined ? '' : tempFinancials.warrantyAmount} onChange={e => setTempFinancials({...tempFinancials, warrantyAmount: parseFloat(e.target.value)})} className="w-full pl-6 pr-2 py-1.5 text-sm font-bold text-slate-900 border rounded outline-none" />
                                                </div>
                                            </div>
                                            <div className="bg-emerald-50 rounded border border-emerald-100 p-1.5 flex flex-col justify-center items-center">
                                                <span className="text-[8px] font-bold text-emerald-600 uppercase">Total</span>
                                                <span className="text-lg font-bold text-emerald-800">S/ {financialSummary.totalBudget.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                                <span>Abonado: <span className="text-emerald-600 font-bold">S/ {financialSummary.totalPaid.toFixed(2)}</span></span>
                                                <span>Deuda: <span className="text-red-500 font-bold">S/ {financialSummary.balance.toFixed(2)}</span></span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${financialSummary.coveragePercent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional Costs Section */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Coins size={12}/> Gastos Adicionales</h4>
                                        </div>
                                        <div className="space-y-1">
                                            {tempFinancials.additionalCosts?.map(cost => (
                                                <div key={cost.id} className="flex justify-between items-center text-[10px] p-1 border-b border-slate-50">
                                                    <span>{cost.description}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold">S/ {cost.amount.toFixed(2)}</span>
                                                        <button onClick={() => handleDeleteMiscCost(cost.id)} className="text-slate-300 hover:text-red-500"><XCircle size={10}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-1 pt-1">
                                            <input type="text" placeholder="Concepto..." value={newMiscCost.description} onChange={e => setNewMiscCost({...newMiscCost, description: e.target.value})} className="flex-1 h-6 text-[10px] border rounded px-2 outline-none" />
                                            <input type="number" placeholder="S/" value={newMiscCost.amount} onChange={e => setNewMiscCost({...newMiscCost, amount: e.target.value})} className="w-16 h-6 text-[10px] border rounded px-2 outline-none" />
                                            <button onClick={handleAddMiscCost} className="h-6 w-6 bg-slate-700 text-white rounded flex items-center justify-center hover:bg-slate-800"><Plus size={12}/></button>
                                        </div>
                                    </div>

                                    {/* Payments Section */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><TrendingUp size={12}/> Pagos Registrados</h4>
                                        </div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {tempFinancials.payments?.map(pay => (
                                                <div key={pay.id} className="flex justify-between items-center text-[10px] p-1 border-b border-slate-50">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">S/ {pay.amount.toFixed(2)}</span>
                                                        <span className="text-[8px] text-slate-400">{pay.date} - {pay.notes}</span>
                                                    </div>
                                                    <button onClick={() => handleDeletePrivatePayment(pay.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-1 pt-1 flex-wrap">
                                            <input type="date" value={newPrivatePayment.date} onChange={e => setNewPrivatePayment({...newPrivatePayment, date: e.target.value})} className="w-20 h-6 text-[9px] border rounded px-1 outline-none" />
                                            <input type="number" placeholder="Monto" value={newPrivatePayment.amount} onChange={e => setNewPrivatePayment({...newPrivatePayment, amount: e.target.value})} className="w-16 h-6 text-[9px] border rounded px-1 outline-none" />
                                            <input type="text" placeholder="Nota..." value={newPrivatePayment.notes} onChange={e => setNewPrivatePayment({...newPrivatePayment, notes: e.target.value})} className="flex-1 h-6 text-[9px] border rounded px-1 outline-none" />
                                            <button onClick={handleAddPrivatePayment} className="h-6 w-6 bg-emerald-600 text-white rounded flex items-center justify-center hover:bg-emerald-700"><Plus size={12}/></button>
                                        </div>
                                    </div>

                                    {/* Right Column (Surgeries & Observations) - NOW INSIDE GRID */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-3 overflow-hidden">
                                        {/* Surgeries List */}
                                        <div className="flex flex-col gap-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 border-b border-slate-100 pb-1"><Scissors size={12}/> Procedimientos</h4>
                                            <div className="space-y-1 overflow-y-auto max-h-48">
                                                {/* Surgeries Logic */}
                                                {(selectedPrivatePatient?.surgeries || []).filter(s => s.status !== 'cancelled').map(s => (
                                                    <div key={s.id} className="p-2 border rounded bg-slate-50 flex flex-col gap-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-[10px] font-bold text-slate-700">{s.procedure}</span>
                                                            <button 
                                                                onClick={() => handleToggleSurgeryStatus(s.id)}
                                                                disabled={!canApproveSurgery}
                                                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${s.paymentStatus === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-200 text-slate-500 border-slate-300'}`}
                                                            >
                                                                {s.paymentStatus === 'approved' ? 'AUTORIZADO' : 'PENDIENTE'}
                                                            </button>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] text-slate-400">{s.date}</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[9px] font-bold text-slate-500">S/</span>
                                                                <input 
                                                                    type="number" 
                                                                    value={s.cost || ''} 
                                                                    onChange={(e) => handleUpdateSurgeryCostPrivate(s.id, e.target.value)}
                                                                    className="w-16 h-5 text-[10px] text-right font-bold border rounded px-1 outline-none focus:border-emerald-400"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(selectedPrivatePatient?.surgeries || []).filter(s => s.status !== 'cancelled').length === 0 && (
                                                    <div className="text-center py-4 text-[10px] text-slate-400 italic">No hay cirugías registradas.</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Observations Log */}
                                        <div className="flex flex-col gap-2 flex-1 min-h-0">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 border-b border-slate-100 pb-1"><MessageSquare size={12}/> Bitácora</h4>
                                            <div className="flex-1 overflow-y-auto space-y-2 bg-slate-50 p-2 rounded border border-slate-100">
                                                {tempFinancials.observations.map(obs => (
                                                    <div key={obs.id} className="bg-white p-1.5 rounded border border-slate-200 shadow-sm">
                                                        <div className="flex justify-between items-center mb-0.5">
                                                            <span className="text-[8px] font-bold text-slate-600">{obs.author}</span>
                                                            <span className="text-[8px] text-slate-400">{new Date(obs.date).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-[9px] text-slate-700 leading-snug">{obs.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-1 pt-1">
                                                <input type="text" value={newObservation} onChange={e => setNewObservation(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddObservation()} className="flex-1 h-7 text-[10px] border rounded px-2 outline-none" placeholder="Nueva observación..." />
                                                <button onClick={handleAddObservation} disabled={!newObservation.trim()} className="h-7 w-7 bg-slate-800 text-white rounded flex items-center justify-center hover:bg-slate-900 disabled:opacity-50"><Send size={12}/></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-60">
                                <Wallet size={48} className="mb-4 text-slate-200" />
                                <p className="text-sm font-bold text-slate-400">Seleccione un paciente particular</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
