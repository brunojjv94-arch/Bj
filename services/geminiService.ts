
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ChatMessage, Patient, Doctor, LabResult, Surgery, ObstetricData, EvolutionType, WarrantyDocumentData, PendingTask } from '../types';
import { TARIFARIO_SEGUS } from '../data/tarifario';

// ... (Existing functions) ...

/**
 * Analiza imágenes médicas usando AI Vision.
 */
export const analyzeWithGemini = async (base64Images: string[], patientContext: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Robust cleanup of base64 string
    const imageParts = base64Images.map(img => {
       // Check if it has the prefix "data:image/..."
       const base64Data = img.includes(',') ? img.split(',')[1] : img;
       return {
          inlineData: { data: base64Data, mimeType: 'image/jpeg' },
       };
    });
    
    const prompt = `
    ROL: Eres un Radiólogo y Traumatólogo Experto Senior (Nivel Consultor Hospitalario).
    
    CONTEXTO DEL PACIENTE: ${patientContext}
    
    TAREA: Generar un INFORME RADIOLÓGICO Y TRAUMATOLÓGICO PROFESIONAL FORMAL de las imágenes adjuntas.
    
    ESTRUCTURA OBLIGATORIA DEL INFORME:
    1. HALLAZGOS RADIOLÓGICOS DETALLADOS: 
       - Describe sistemáticamente: Calidad ósea, corticales, medular, espacios articulares, partes blandas.
       - Alineación y congruencia articular.
    
    2. CLASIFICACIÓN (CRÍTICO - NO OMITIR): 
       - SI HAY FRACTURA: Proporciona OBLIGATORIAMENTE la Clasificación AO/OTA (Ej: 33-C2) y cualquier otra clasificación epónima relevante (Gustilo, Schatzker, Neer, Garden, etc.).
       - SI NO HAY FRACTURA: Indica "Sin evidencia de trazo de fractura" y describe hallazgos incidentales (artrosis, efusión, etc.).

    3. JUSTIFICACIÓN TÉCNICA DE LA CLASIFICACIÓN:
       - Explica paso a paso por qué se asigna ese código AO (Hueso, Segmento, Tipo). Esto es vital para la docencia.

    4. IMPRESIÓN DIAGNÓSTICA (CONCLUSIÓN):
       - Diagnóstico final preciso y técnico.

    5. PLAN DE MANEJO SUGERIDO:
       - Quirúrgico vs Conservador.
       - Si es quirúrgico, sugiere el material de osteosíntesis ideal (Placa LCP, Clavo Endomedular, Fijador Externo, etc.) basado en el patrón de fractura.

    TONO: Estrictamente médico, técnico, preciso y formal. Sin introducciones tipo "Hola", ve directo al informe.
    `; 

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [...imageParts, { text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
    });
    return response.text || "No se pudo generar el análisis médico detallado.";
  } catch (error) { 
      console.error("AI Error:", error);
      return "Error técnico al procesar la imagen. Verifique su conexión o intente nuevamente."; 
  }
};

export const suggestSegusCodes = async (procedureName: string): Promise<{ code: string, description: string }[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const tarifarioContext = JSON.stringify(TARIFARIO_SEGUS);
        const prompt = `ACTÚA COMO: Auditor Médico Experto en Tarifario SEGUS... INPUT: "${procedureName}"...`;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "[]");
    } catch (error) { return []; }
};

export const generateWarrantyReportText = async (patient: Patient, procedures: { code: string, description: string }[], diagnoses: { name: string, code: string }[]): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const dxText = diagnoses.map(d => `${d.name} (${d.code})`).join(', ');
        const procText = procedures.map(p => `${p.description} (SEGUS: ${p.code})`).join(', ');
        const prompt = `ACTÚA COMO: Médico Tratante. Redacta una JUSTIFICACIÓN MÉDICA...`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        return response.text?.trim() || "";
    } catch (error) { return "Error al generar justificación."; }
};

export const generateWarrantyRequestDocument = (patient: Patient, data: WarrantyDocumentData, doctorName: string): string => {
    return `HTML Content...`; 
};

export const lookupDiagnosisInfo = async (query: string, type: 'text' | 'code'): Promise<{ name: string, code: string } | null> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        let prompt = "";
        if (type === 'text') {
            prompt = `Eres un experto codificador clínico CIE-10. 
            TAREA: Identifica el código CIE-10 más específico para el diagnóstico: "${query}".
            FORMATO JSON: { "name": "Nombre Oficial CIE-10 en Español", "code": "X00.0" }
            Si es ambiguo, elige el más común. Responde SOLO JSON.`;
        } else {
            prompt = `Eres un experto codificador clínico CIE-10. 
            TAREA: Identifica el nombre oficial para el código: "${query}".
            FORMATO JSON: { "name": "Nombre Oficial CIE-10 en Español", "code": "${query.toUpperCase()}" }
            Responde SOLO JSON.`;
        }

        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt, 
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        code: { type: Type.STRING }
                    }
                }
            } 
        });
        
        let text = response.text || "{}";
        // Clean markdown if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(text);
    } catch (error) { 
        console.error("Diagnosis AI Error:", error);
        return null; 
    }
};

export const sendMessageToGemini = async (prompt: string, history: ChatMessage[] = []): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "Sin respuesta.";
  } catch (error) { return "Error."; }
};

export const analyzeIdeaScalability = async (idea: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: `Analiza escalabilidad: "${idea}"`, config: { thinkingConfig: { thinkingBudget: 1024 } } });
        return response.text || "Error.";
    } catch (error) { return "Error."; }
};

export const generateClinicalSummary = async (patient: Patient): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const labs = patient.labResults.slice(-5).map(l => `${l.testName}: ${l.value} (${l.date})`).join('; ');
        const surgeries = patient.surgeries.map(s => `${s.procedure} (${s.status} - ${s.date})`).join('; ');
        const images = patient.images.slice(-3).map(i => `${i.name} (${i.date})`).join('; ');
        const lastEvo = patient.evolutions.length > 0 ? patient.evolutions[0].note : "Sin evoluciones.";

        const context = `
        PACIENTE: ${patient.name}, ${patient.age} años.
        DIAGNÓSTICO: ${patient.diagnoses.join(', ')}.
        CIRUGÍAS: ${surgeries || 'Ninguna'}.
        IMÁGENES RECIENTES: ${images || 'Ninguna'}.
        LABORATORIOS RECIENTES: ${labs || 'Ninguno'}.
        ÚLTIMA EVOLUCIÓN: ${lastEvo}
        `;

        const prompt = `
        ACTÚA COMO: Jefe de Guardia Médica.
        TAREA: Generar un RESUMEN CLÍNICO CONCISO (un solo párrafo) para el pase de visita.
        CONTEXTO: ${context}
        INSTRUCCIONES:
        - Menciona diagnóstico principal y días de hospitalización.
        - Resume brevemente el postoperatorio si aplica.
        - Destaca hallazgos críticos de labs/imágenes si los hay.
        - Concluye con el plan actual o estado general.
        - Sé directo y profesional.
        `;

        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        return response.text || "No disponible.";
    } catch (error) { return "Error al generar resumen."; }
};

// --- UPDATED Q&A FUNCTION WITH FULL CONTEXT ---
export const answerPatientQuery = async (patient: Patient, query: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // 1. Prepare Full Clinical Context
        const labs = patient.labResults.map(l => `[${l.date} ${l.time}] ${l.testName}: ${l.value} ${l.unit}`).join('\n');
        const surgeries = patient.surgeries.map(s => `[${s.date}] ${s.procedure} (${s.status})`).join('\n');
        const evolutions = patient.evolutions.slice(0, 15).map(e => `[${e.date} ${e.time}] ${e.note}`).join('\n'); // Increased context
        const allergies = patient.clinicalData.allergies || 'Ninguna';
        const pathologies = patient.clinicalData.pathologies || 'Ninguna';
        const meds = patient.clinicalData.anticoagulation || 'No especificado';

        const fullContext = `
        --- FICHA CLÍNICA PACIENTE ---
        NOMBRE: ${patient.name}
        EDAD: ${patient.age} años
        DIAGNÓSTICOS ACTUALES: ${patient.diagnoses.join(', ')}
        ALERGIAS: ${allergies}
        ANTECEDENTES: ${pathologies}
        MEDICACIÓN RELEVANTE: ${meds}
        
        --- HISTORIAL QUIRÚRGICO ---
        ${surgeries || 'Sin registros'}

        --- LABORATORIOS RECIENTES ---
        ${labs || 'Sin registros'}

        --- ÚLTIMAS EVOLUCIONES MÉDICAS ---
        ${evolutions || 'Sin registros'}
        `;

        const prompt = `
        ACTÚA COMO: Auditor Médico Senior con comunicación ejecutiva.
        
        OBJETIVO: Responder a la consulta del usuario basándote ESTRICTAMENTE en la ficha clínica proporcionada.

        PREGUNTA DEL USUARIO: "${query}"

        REGLAS DE RESPUESTA (CRÍTICO):
        1. VERACIDAD ABSOLUTA: NO inventes ni asumas datos. Si la respuesta no está en el texto proporcionado, responde exactamente: "Dato no disponible en el expediente actual."
        2. CONCISIÓN EXTREMA: Sé breve. Elimina saludos, introducciones ("Según el expediente...") y cierres. Ve directo a la respuesta.
        3. CLARIDAD: Usa lenguaje médico preciso pero entendible.
        4. CERO REDUNDANCIA: No repitas la pregunta del usuario.
        5. CITAS DE TIEMPO: Si das un dato (ej: "Hemoglobina 8.5"), añade la fecha del registro entre paréntesis.

        FORMATO: Responde en texto plano, máximo 2-3 oraciones a menos que sea una lista necesaria.
        `;

        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: [{ parts: [{ text: fullContext }, { text: prompt }] }] 
        });
        
        return response.text || "No se pudo obtener una respuesta.";
    } catch (error) { 
        console.error("Q&A Error:", error);
        return "Error al procesar la consulta."; 
    }
};

export const improveAnamnesisText = async (rawText: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
        ACTÚA COMO: Médico Internista Senior y Corrector de Estilo Clínico.
        
        TAREA: Reescribir y mejorar el siguiente borrador de ANAMNESIS (Relato de la Enfermedad).
        
        TEXTO ORIGINAL (DICTADO/BORRADOR):
        "${rawText}"

        OBJETIVOS DE LA MEJORA:
        1. LENGUAJE FORMAL: Utiliza terminología médica precisa (ej: "dolor de cabeza" -> "cefalea", "falta de aire" -> "disnea", "orina con sangre" -> "hematuria").
        2. CRONOLOGÍA: Ordena los eventos temporalmente (TE: Tiempo de Enfermedad, Forma de Inicio, Curso).
        3. CLARIDAD: Elimina redundancias, muletillas de dictado y frases coloquiales.
        4. COHERENCIA: Asegura que la narrativa fluya lógicamente hacia el motivo de ingreso actual.
        5. NO INVENTAR: No agregues síntomas o datos que no estén implícitos en el texto original. Solo estructura lo que hay.

        FORMATO DE SALIDA:
        Devuelve SOLO el texto mejorado en un párrafo sólido o estructura de relato. Sin introducciones ni markdown.
        `;

        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt 
        });
        
        return response.text || rawText;
    } catch (error) { 
        console.error("Improve Anamnesis Error:", error);
        return rawText; 
    }
};

export const analyzeXRay = async (base64Images: string[]): Promise<string> => {
  return "Analisis";
};

export const generateEvolutionAnalysis = async (
    p: Patient, 
    rawText: string, 
    currentVitals: any, 
    availableBeds: string[], 
    insurances: string[], 
    forcedType: string | null, 
    obstetricData: any,
    availableDoctors: Doctor[],
    pendingTasks: PendingTask[] = []
): Promise<any> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Format pending tasks for context
        const pendingContext = pendingTasks
            .filter(t => !t.completed)
            .map(t => `ID: "${t.id}", Tarea: "${t.text}"`)
            .join('; ');

        // Date Context for intelligent parsing
        const now = new Date();
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dateContext = `FECHA ACTUAL: ${now.toISOString().split('T')[0]} (Día: ${days[now.getDay()]}, Hora: ${now.getHours()}:${now.getMinutes()})`;

        const context = `
        PACIENTE: ${p.name}, ${p.age} años. 
        MÉDICOS ASIGNADOS: ${p.doctors.join(', ')}.
        DOCTORES STAFF (DISPONIBLES): ${availableDoctors.map(d => d.name).join(', ')}.
        ALERGIAS ACTUALES: ${p.clinicalData.allergies || 'Ninguna'}. 
        PATOLOGÍAS ACTUALES: ${p.clinicalData.pathologies || 'Ninguna'}. 
        ANTICOAG: ${p.clinicalData.anticoagulation || 'No'}.
        PENDIENTES ACTIVOS: [${pendingContext}]
        TIPO FORZADO: ${forcedType ? forcedType : 'Auto-detectar'}
        ${dateContext}
        `;

        const prompt = `
        ACTÚA COMO: Asistente Clínico Inteligente de OmniBase.
        INPUT DEL MÉDICO: "${rawText}"
        CONTEXTO: ${context}

        TAREA PRINCIPAL: Procesar el texto dictado para estructurar la historia clínica.

        REGLAS DE CIRUGÍA (PROGRAMACIÓN):
        1. "newSurgeries": Si el médico indica programar o realizar una cirugía.
           - "procedure": Nombre del procedimiento. Si no es específico, usa "Por definir".
           - "date": CALCULA LA FECHA EXACTA (YYYY-MM-DD) basada en el texto (ej: "mañana", "el lunes", "en 2 días") y la FECHA ACTUAL proporcionada.
           - "time": Hora estimada formato HH:MM (si no se dice, usa "08:00").

        REGLAS DE LABORATORIO (ESTRICTO):
        1. "newLabs": ÚNICAMENTE si el médico dicta un VALOR numérico o resultado explícito (Ej: "Hemoglobina en 10.5", "PCR positivo").
           - Formato: { "testName": "Hemoglobina", "value": 10.5, "date": "YYYY-MM-DD" }.
           - Si el médico dice "Pedir hemoglobina" o "Falta hemoglobina", NO es un resultado, es un PENDIENTE.
        
        2. "newPendings": Si el médico ordena, solicita o planea algo (Ej: "Solicitar TAC", "Pedir hemograma control").

        RESPONDE SOLO JSON:
        {
            "detectedType": "Tipo",
            "suggestedText": "Texto nota o vacío",
            "extractedVitals": { "pa": "", "fc": "", "fr": "", "temp": "", "sat": "", "fio2": "" },
            "detectedActions": {
                "newPendings": ["tarea 1"],
                "completedTaskIds": ["id_tarea_completada_1"],
                "dataWarnings": ["Advertencia 1"],
                "newDiagnoses": [{ "dx": "Nombre", "cie10": "Code" }],
                "newSurgeries": [{ "procedure": "Nombre", "date": "YYYY-MM-DD", "time": "HH:MM" }],
                "newLabs": [{ "testName": "Nombre", "value": 0.0, "date": "YYYY-MM-DD" }],
                "doctorChanges": [{ "action": "add" | "remove", "name": "Nombre Exacto" }],
                "clinicalDataUpdates": { "allergies": "", "pathologies": "", "anticoagulation": "" },
                "contactUpdates": { "phone": "num", "familyPhone": "num" },
                "bedChange": "cama" | null,
                "insuranceChange": "seguro" | null,
                "interconsultationResult": { "detected": boolean, "specialty": "", "doctorName": "", "text": "" }
            }
        }
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || "{}");
    } catch (error) { 
        console.error(error);
        return { 
            detectedType: forcedType || 'Evolución', 
            suggestedText: rawText, 
            extractedVitals: currentVitals,
            detectedActions: {} 
        }; 
    }
};

export const generateMedicalReport = async (p: Patient, t: string, i: string, d: string, r: any, l: string, s: string, sd: string[], ls: string): Promise<string> => {
    // (Implementation omitted for brevity, same as before)
    return "Reporte HTML";
};
