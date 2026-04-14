
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Pause, Trash2, X } from 'lucide-react';

interface VoiceCommandModalProps {
  onClose: () => void;
  onSend: (text: string) => void;
}

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({ onClose, onSend }) => {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs to maintain state inside event listeners without closure staleness
  const recognitionRef = useRef<any>(null);
  const isPausedRef = useRef(false); 

  useEffect(() => {
    // 1. Browser Compatibility Check
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
        onClose();
        return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // 2. Configuration for "Echo-Free" Continuous Recording
    recognition.continuous = true; 
    // IMPORTANT: interimResults = false prevents the "echo/repetition" issue. 
    // It only returns text when the browser is sure about the phrase.
    recognition.interimResults = false; 
    recognition.lang = 'es-ES';

    // 3. Result Handler
    recognition.onresult = (event: any) => {
        let newContent = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                newContent += event.results[i][0].transcript;
            }
        }
        
        if (newContent) {
            setTranscript(prev => {
                const cleanNew = newContent.trim();
                // Add space if needed
                return prev ? `${prev} ${cleanNew}` : cleanNew;
            });
        }
    };

    recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            alert("Permiso de micrófono denegado.");
            isPausedRef.current = true; // Stop trying to restart
            setIsRecording(false);
        }
    };

    // 4. "Infinite" Loop Logic
    recognition.onend = () => {
        // If the user did NOT click pause/send, restart immediately.
        if (!isPausedRef.current) {
            try {
                recognition.start();
            } catch (e) {
                // Ignore errors if already started
            }
        } else {
            setIsRecording(false);
        }
    };

    recognitionRef.current = recognition;

    // 5. Auto-Start on Mount
    handleStart();

    // Cleanup
    return () => {
        isPausedRef.current = true; // Ensure it stops trying to restart
        if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const handleStart = () => {
      if (recognitionRef.current) {
          isPausedRef.current = false;
          try {
              recognitionRef.current.start();
              setIsRecording(true);
          } catch (e) {
              setIsRecording(true);
          }
      }
  };

  const handlePause = () => {
      if (recognitionRef.current) {
          isPausedRef.current = true; // Flag to prevent auto-restart in onend
          recognitionRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleClear = () => {
      setTranscript('');
  };

  const handleSend = () => {
      // FORCE STOP IMMEDIATELY
      isPausedRef.current = true;
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          // We do not set recognitionRef.current to null here to avoid potential errors in cleanup,
          // but isPausedRef=true ensures onend won't restart it.
      }
      
      if (transcript.trim()) {
          onSend(transcript);
      }
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2">
                <Mic size={20} className={isRecording ? 'animate-pulse' : ''} /> 
                {isRecording ? 'Escuchando...' : 'En Pausa'}
            </h3>
            <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="p-4">
            <textarea 
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Diga el número de cama y luego la indicación..."
                className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed shadow-inner"
            />
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-4">
            {!isRecording ? (
                <button 
                    onClick={handleStart} 
                    className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 hover:bg-red-700"
                    title="Grabar"
                >
                    <Mic size={28} />
                </button>
            ) : (
                <button 
                    onClick={handlePause} 
                    className="w-14 h-14 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 hover:bg-yellow-600 animate-pulse"
                    title="Pausar"
                >
                    <Pause size={28} />
                </button>
            )}
            
            <button onClick={handleClear} className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-all" title="Borrar">
                <Trash2 size={18} />
            </button>

            <button 
                onClick={handleSend}
                disabled={!transcript.trim()}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
            >
                Enviar <Send size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};
