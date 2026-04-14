
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { analyzeIdeaScalability, sendMessageToGemini } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Button } from '../components/ui/Button';

export const IdeaLab: React.FC = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'chat' | 'architect'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '¡Hola! Soy tu asistente de escalabilidad. Podemos chatear libremente o cambiar al "Modo Arquitecto" para analizar a fondo una nueva función para OmniBase.',
      timestamp: Date.now()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';
      
      if (mode === 'architect') {
        responseText = await analyzeIdeaScalability(userMsg.text);
      } else {
        responseText = await sendMessageToGemini(userMsg.text, messages);
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
      
      {/* Module Header */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="text-purple-400" size={20} />
            Laboratorio de Ideas
          </h2>
          <p className="text-xs text-slate-400">Impulsado por Gemini 3.0 Flash & Pro</p>
        </div>
        
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setMode('chat')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'chat' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Chat
          </button>
          <button
             onClick={() => setMode('architect')}
             className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
               mode === 'architect' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
             }`}
           >
             Modo Arquitecto
           </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${msg.role === 'user' ? 'bg-primary-600' : 'bg-purple-600'}
            `}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`
              max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-primary-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'}
            `}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex items-start gap-4">
             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
               <Bot size={16} />
             </div>
             <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none px-5 py-3">
               <div className="flex space-x-2">
                 <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'architect' ? "Describe tu idea para un análisis técnico de escalabilidad..." : "Pregúntame cualquier cosa..."}
            className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-4 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 disabled:opacity-50 disabled:hover:bg-primary-600 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-500 mt-2">
          {mode === 'architect' 
            ? 'Usando presupuesto de pensamiento de Gemini 3.0 Pro' 
            : 'Usando Gemini 3.0 Flash'}
        </p>
      </div>
    </div>
  );
};
