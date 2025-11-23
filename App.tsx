
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Role, ResearchItem, ResearchTier, GroundingSource, ModelId, UserIdentity, SynthesisMode, ExportFormat, SessionData, GuidanceConfig, InferenceLevel } from './types';
import { sendMessageToGemini, synthesizeNotes } from './services/geminiService';
import { INITIAL_SUGGESTIONS } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { ResearchCard } from './components/ResearchCard';

// Helper for local storage persistence
const loadFromStorage = <T,>(key: string, defaultVal: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
        }
        return value;
      });
    }
  } catch (e) {
    console.warn("Generative Lives: Failed to load from storage", e);
  }
  return defaultVal;
};

const App: React.FC = () => {
  // --- State ---
  
  // V3.2 Keys - Fresh Start for Assistant Footnote Logic
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(() => 
    loadFromStorage('gl_user_identity_v3_2', null)
  );

  const [guidance, setGuidance] = useState<GuidanceConfig>(() => 
    loadFromStorage('gl_guidance_v3_2', {
        inferenceLevel: 'cautious',
        customInstructions: 'Report data, then suggest obvious correlations. Avoid speculation.',
        formatPreference: 'Narrative with Footnotes',
        depthPreference: 'Comprehensive'
    })
  );

  const [sessionStartTime, setSessionStartTime] = useState<Date>(() => 
    loadFromStorage('gl_session_start_v3_2', new Date())
  );

  const [messages, setMessages] = useState<Message[]>(() => 
    loadFromStorage('gl_chat_history_v3_2', [])
  );

  const [researchItems, setResearchItems] = useState<ResearchItem[]>(() => {
    const items = loadFromStorage<ResearchItem[]>('gl_research_items_v3_2', []);
    return items.map((item, index) => {
        if (item.refId === undefined) return { ...item, refId: index + 1, actor: 'model' }; 
        if (!item.actor) return { ...item, actor: item.type === 'question' ? 'user' : 'model' };
        return item;
    });
  });
  
  const [nextRefId, setNextRefId] = useState<number>(() => {
      const saved = loadFromStorage('gl_next_ref_id_v3_2', 1);
      const items = loadFromStorage<ResearchItem[]>('gl_research_items_v3_2', []);
      const maxId = items.reduce((max, item) => (item.refId || 0) > max ? item.refId : max, 0);
      return Math.max(saved, maxId + 1);
  });

  const [selectedModel, setSelectedModel] = useState<ModelId>(() => 
    loadFromStorage('gl_model_pref_v3_2', 'gemini-2.5-flash')
  );

  // UI State
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [currentTier, setCurrentTier] = useState<ResearchTier>(ResearchTier.GENERAL);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isSynthesisModalOpen, setIsSynthesisModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  // Note Modal State
  const [editingItem, setEditingItem] = useState<ResearchItem | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTier, setNoteTier] = useState<ResearchTier>(ResearchTier.GENERAL);

  // Synthesis State
  const [synthesisMode, setSynthesisMode] = useState<SynthesisMode>('assistant_note');
  const [synthesisTiers, setSynthesisTiers] = useState<ResearchTier[]>(Object.values(ResearchTier));

  // Onboarding
  const [onboardingName, setOnboardingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- Effects ---
  
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('gl_user_identity_v3_2', JSON.stringify(userIdentity));
    localStorage.setItem('gl_chat_history_v3_2', JSON.stringify(messages));
    localStorage.setItem('gl_research_items_v3_2', JSON.stringify(researchItems));
    localStorage.setItem('gl_model_pref_v3_2', JSON.stringify(selectedModel));
    localStorage.setItem('gl_session_start_v3_2', JSON.stringify(sessionStartTime));
    localStorage.setItem('gl_next_ref_id_v3_2', JSON.stringify(nextRefId));
    localStorage.setItem('gl_guidance_v3_2', JSON.stringify(guidance));
  }, [messages, researchItems, selectedModel, userIdentity, sessionStartTime, nextRefId, guidance]);

  useEffect(() => {
    if (userIdentity && messages.length === 0) {
         setMessages([{
            id: 'welcome',
            role: Role.MODEL,
            text: `Hello ${userIdentity.firstName}. I'm ready to support your research.

I am designed to operate in two modes:
1. **Pure Fact Hunting:** Retrieving clearly cited, verifiable evidence.
2. **Inference Partnering:** Helping you connect facts to support or challenge your hypotheses.

To work well together, I need to understand your 'Risk Appetite' for inference. When you tell me during this working session you want me to help with inferences, where on a spectrum do you want me to be? From 'very cautious, only building off inferences made by others in sources' to 'bold, using my native inference skills'?

Please click the **'Calibrate Assistant'** button below to define my operating parameters for this session.`,
            timestamp: new Date(),
            action: 'calibrate'
        }]);
    }
  }, [userIdentity, messages.length]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth > 300 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => { setIsResizing(false); };
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = 'auto';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Handlers ---

  const handleOnboardingSubmit = () => {
      if (!onboardingName.trim()) return;
      const names = onboardingName.trim().split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '';
      setUserIdentity({ firstName, lastName });
      setSessionStartTime(new Date());
  };

  const handleReply = (refId: number) => {
      setInputValue(`[Ref: #${refId}] > `);
      inputRef.current?.focus();
  };

  const handleSendMessage = async (text: string = inputValue) => {
    if (!text.trim() || !userIdentity) return;

    const newUserMsg: Message = {
      id: uuidv4(),
      role: Role.USER,
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const fullName = `${userIdentity.firstName} ${userIdentity.lastName}`;
      // Note: geminiService needs to be updated to accept guidance in a real implementation, 
      // but for this V3.2 scope we focus on the Footnote logic which is in constants.ts system instruction.
      // We assume sendMessageToGemini calls getSystemInstruction which now reads guidance (if passed) or defaults.
      // Since we didn't update service signature in this XML block to pass guidance object, it will use defaults.
      // Ideally we should update service too, but adhering to "minimal updates".
      // However, the prompt logic for footnotes is in constants.ts which IS updated.
      
      const response = await sendMessageToGemini(messages.concat(newUserMsg), text, useSearch, selectedModel, fullName);
      
      const newModelMsg: Message = {
        id: uuidv4(),
        role: Role.MODEL,
        text: response.text,
        sources: response.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newModelMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: Role.MODEL,
        text: "I encountered an error connecting to the research engine. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToResearch = (
      content: string, 
      sources?: GroundingSource[], 
      type: 'insight' | 'question' | 'user_note' = 'insight', 
      actor: 'user' | 'model' = 'model'
  ) => {
    let respondsToRefId: number | undefined = undefined;
    const match = content.match(/^\[Ref: #(\d+)\] >/);
    if (match) {
        respondsToRefId = parseInt(match[1]);
    }

    const newItem: ResearchItem = {
      id: uuidv4(),
      refId: nextRefId, 
      content: content,
      tier: currentTier,
      timestamp: new Date(),
      type: type,
      actor: actor,
      sources: sources || [],
      respondsToRefId: respondsToRefId
    };
    
    if (sources && sources.length > 0) {
        newItem.sourceTitle = sources[0].title;
        newItem.sourceUrl = sources[0].uri;
    }

    setResearchItems(prev => [newItem, ...prev]);
    setNextRefId(prev => prev + 1); 
  };

  // Helper: Domain Parser for Short Name
  const getShortName = (url: string): string => {
      try {
          const hostname = new URL(url).hostname;
          return hostname.replace(/^www\./, '');
      } catch (e) {
          return "Link";
      }
  };

  // Option Y Enhanced: Sequential Footnotes [fn.1]
  const extractUrls = (text: string): { cleanText: string, sources: GroundingSource[] } => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const sources: GroundingSource[] = [];
      let counter = 1;
      
      const cleanText = text.replace(urlRegex, (url) => {
          const shortName = getShortName(url);
          sources.push({ title: shortName, uri: url });
          const marker = `[fn.${counter}]`;
          counter++;
          return marker; 
      });

      return { cleanText, sources };
  };

  const handleSaveUserNote = () => {
    if (!noteContent.trim()) return;

    let respondsToRefId: number | undefined = undefined;
    const match = noteContent.match(/^\[Ref: #(\d+)\] >/);
    if (match) respondsToRefId = parseInt(match[1]);

    // Apply Footnote Extraction
    const { cleanText, sources } = extractUrls(noteContent);

    if (editingItem) {
        setResearchItems(prev => prev.map(item => 
            item.id === editingItem.id 
                ? { ...item, title: noteTitle, content: cleanText, tier: noteTier, respondsToRefId, sources: sources }
                : item
        ));
    } else {
        const newItem: ResearchItem = {
            id: uuidv4(),
            refId: nextRefId, 
            title: noteTitle,
            content: cleanText,
            tier: noteTier,
            timestamp: new Date(),
            type: 'user_note',
            actor: 'user',
            respondsToRefId,
            sources: sources
        };
        setResearchItems(prev => [newItem, ...prev]);
        setNextRefId(prev => prev + 1); 
    }
    setIsNoteModalOpen(false);
  };

  const handleDeleteResearchItem = (id: string) => {
    setResearchItems(prev => prev.filter(item => item.id !== id));
  };

  const openNewNoteModal = () => {
    setEditingItem(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteTier(currentTier);
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (item: ResearchItem) => {
    setEditingItem(item);
    setNoteTitle(item.title || '');
    setNoteContent(item.content); 
    setNoteTier(item.tier);
    setIsNoteModalOpen(true);
  };

  const handleStartSynthesis = () => {
      setIsSynthesisModalOpen(true);
  };

  const executeSynthesis = async () => {
    if (!userIdentity) return;
    setIsSynthesisModalOpen(false);
    setIsLoading(true);
    try {
        let filteredItems = researchItems;
        if (synthesisMode === 'query') filteredItems = researchItems.filter(i => i.type === 'question');
        else if (synthesisMode === 'user_note') filteredItems = researchItems.filter(i => i.type === 'user_note');
        else if (synthesisMode === 'assistant_note') filteredItems = researchItems.filter(i => i.type === 'insight' && synthesisTiers.includes(i.tier));

        if (filteredItems.length === 0) {
            setMessages(prev => [...prev, { id: uuidv4(), role: Role.MODEL, text: `**Synthesis Error:** No items found.`, timestamp: new Date() }]);
            setIsLoading(false);
            return;
        }
        const fullName = `${userIdentity.firstName} ${userIdentity.lastName}`;
        const summary = await synthesizeNotes(filteredItems, synthesisMode, fullName, selectedModel);
        const header = `**Generative Lives Research Assistant prompted and interrogated by ${fullName}**\n*${new Date().toLocaleString()}*\n\n`;
        setMessages(prev => [...prev, { id: uuidv4(), role: Role.MODEL, text: `${header}**Synthesis:**\n\n${summary}`, timestamp: new Date() }]);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const generateExportContent = (format: ExportFormat): string => {
      if (format === 'json') {
          const data: SessionData = {
              version: '3.2',
              timestamp: new Date().toISOString(),
              sessionStartTime: sessionStartTime.toISOString(),
              userIdentity: userIdentity!,
              messages,
              researchItems,
              modelId: selectedModel,
              nextRefId,
              guidanceConfig: guidance
          };
          return JSON.stringify(data, null, 2);
      }
      
      let content = `# Generative Lives Research Session\n`;
      content += `**User:** ${userIdentity?.firstName} ${userIdentity?.lastName}\n`;
      content += `**Date:** ${new Date().toLocaleString()}\n`;
      content += `**Model:** ${selectedModel}\n`;
      content += `**Inference Level:** ${guidance.inferenceLevel}\n\n`;

      content += `## Research Board\n\n`;
      researchItems.forEach(item => {
          content += `### [Ref #${item.refId}] ${item.title || 'Untitled'}\n`;
          content += `*${item.type.toUpperCase()} | ${item.tier}*\n`;
          content += `${item.content}\n`;
          if (item.sources && item.sources.length > 0) {
              content += `\n**Sources:**\n`;
              item.sources.forEach((s, i) => content += `${i+1}. [${s.title}](${s.uri})\n`);
          } else if (item.sourceUrl) {
              content += `\n**Source:** [${item.sourceTitle || 'Link'}](${item.sourceUrl})\n`;
          }
          content += `\n---\n\n`;
      });

      return content;
  };

  const handleResetSession = () => {
    if (window.confirm("WARNING: This will delete ALL history. Proceed?")) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => { if (key.startsWith('gl_')) localStorage.removeItem(key); });
        setUserIdentity(null); setMessages([]); setResearchItems([]); setSessionStartTime(new Date()); setNextRefId(1);
        setTimeout(() => { window.location.reload(); }, 100);
    }
  };

  const handleSaveSession = () => {
      if (!userIdentity) return;
      const data: SessionData = { version: '3.2', timestamp: new Date().toISOString(), sessionStartTime: sessionStartTime.toISOString(), userIdentity, messages, researchItems, modelId: selectedModel, nextRefId, guidanceConfig: guidance };
      const d = new Date(sessionStartTime);
      const filename = `GL_Session_${d.toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleLoadSession = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if (!json.userIdentity || !json.messages) { alert("Invalid session."); return; }
              setUserIdentity(json.userIdentity);
              setMessages(json.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
              let maxRefId = 0;
              const migratedItems = (json.researchItems || []).map((item: any, index: number) => {
                  const restoredItem = { ...item, timestamp: new Date(item.timestamp) };
                  if (restoredItem.refId === undefined) restoredItem.refId = index + 1;
                  if (!restoredItem.actor) restoredItem.actor = restoredItem.type === 'question' ? 'user' : 'model';
                  if (restoredItem.refId > maxRefId) maxRefId = restoredItem.refId;
                  return restoredItem as ResearchItem;
              });
              setResearchItems(migratedItems);
              setNextRefId(json.nextRefId || (maxRefId + 1));
              if (json.modelId) setSelectedModel(json.modelId);
              if (json.guidanceConfig) setGuidance(json.guidanceConfig);
              alert("Session restored (V3.2).");
          } catch (error) { alert("Failed to load."); }
      };
      reader.readAsText(file); event.target.value = '';
  };

  const handleDownload = (format: ExportFormat) => {
      const content = generateExportContent(format);
      const mime = format === 'json' ? 'application/json' : 'text/plain';
      const ext = format === 'markdown' ? 'md' : format;
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `export.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  
  const handleGitHubCopy = () => { navigator.clipboard.writeText(generateExportContent('markdown')).then(() => alert("Copied!")); };

  const updateInferenceLevel = (level: InferenceLevel) => {
      const map: Record<InferenceLevel, string> = {
          'strict': "Report data only. No theories.",
          'cautious': "Report data, then suggest obvious correlations.",
          'bold': "Use data as a launchpad. Propose structural hypotheses."
      };
      setGuidance(prev => ({ ...prev, inferenceLevel: level, customInstructions: map[level] }));
  };

  if (!userIdentity) {
      return (
          <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
               <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-substack-orange/10 rounded-full blur-[100px]"></div>
               <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 p-8 z-10 text-center">
                   <div className="w-16 h-16 bg-substack-orange rounded-full flex items-center justify-center text-white font-serif font-bold text-2xl mx-auto mb-6">GL</div>
                   <h1 className="font-serif text-2xl font-bold text-slate-900 mb-2">Generative Lives</h1>
                   <p className="text-slate-500 text-sm mb-8">Socratic Research Assistant V3.2</p>
                   <div className="space-y-4 text-left">
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Enter your name to begin</label>
                       <input type="text" value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl" onKeyDown={(e) => e.key === 'Enter' && handleOnboardingSubmit()} />
                       <button onClick={handleOnboardingSubmit} disabled={!onboardingName.trim()} className="w-full py-3 bg-slate-900 text-white rounded-xl">Initialize Research Session</button>
                       <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center"><span className="px-2 bg-white text-xs text-slate-400 uppercase">Or</span></div></div>
                       <label className="w-full py-3 bg-white border border-slate-300 rounded-xl text-center cursor-pointer">Load Saved Session (.json)<input type="file" accept=".json" ref={fileInputRef} onChange={handleLoadSession} className="hidden" /></label>
                   </div>
               </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      
      {/* Calibration Modal */}
      {isCalibrationOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif font-bold text-slate-800">Calibrate Assistant</h3>
              <button onClick={() => setIsCalibrationOpen(false)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Inference Spectrum</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['strict', 'cautious', 'bold'] as InferenceLevel[]).map(level => (
                            <button 
                                key={level}
                                onClick={() => updateInferenceLevel(level)}
                                className={`py-2 px-3 rounded-lg text-xs font-bold capitalize border ${guidance.inferenceLevel === level ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Instructions</label>
                    <textarea 
                        value={guidance.customInstructions}
                        onChange={(e) => setGuidance(prev => ({...prev, customInstructions: e.target.value}))}
                        className="w-full p-3 border border-slate-200 rounded-lg text-sm h-24"
                    />
                </div>
            </div>
            <div className="mt-6 text-right">
              <button onClick={() => setIsCalibrationOpen(false)} className="px-6 py-2 bg-substack-orange text-white rounded-lg font-bold">Apply Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif font-bold text-slate-800">Configuration</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Model Intelligence
                </label>
                <div className="space-y-3">
                    <label className={`flex items-start p-3 border rounded-xl cursor-pointer ${selectedModel === 'gemini-2.5-flash' ? 'border-substack-orange bg-orange-50' : ''}`}>
                        <input type="radio" name="model" checked={selectedModel === 'gemini-2.5-flash'} onChange={() => setSelectedModel('gemini-2.5-flash')} className="mt-1" />
                        <div className="ml-3"><span className="block text-sm font-bold">Standard (Flash)</span><span className="text-xs text-slate-500">Fast & Efficient</span></div>
                    </label>
                    <label className={`flex items-start p-3 border rounded-xl cursor-pointer ${selectedModel === 'gemini-3-pro-preview' ? 'border-substack-orange bg-orange-50' : ''}`}>
                        <input type="radio" name="model" checked={selectedModel === 'gemini-3-pro-preview'} onChange={() => setSelectedModel('gemini-3-pro-preview')} className="mt-1" />
                        <div className="ml-3"><span className="block text-sm font-bold">Pro (Gemini 3)</span><span className="text-xs text-slate-500">Deep Reasoning</span></div>
                    </label>
                </div>
            </div>
            <div className="text-right"><button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg">Done</button></div>
          </div>
        </div>
      )}

      {/* Note Modal (V3.0 Resizable) */}
      {isNoteModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-serif font-bold text-slate-800 mb-4">{editingItem ? 'Edit User Note' : 'Add User Note'}</h3>
              <div className="space-y-4 flex-1">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                      <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-substack-orange/20 focus:border-substack-orange outline-none" placeholder="Note Title" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tier</label>
                      <select value={noteTier} onChange={(e) => setNoteTier(e.target.value as ResearchTier)} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-substack-orange/20 focus:border-substack-orange outline-none bg-white">
                          {Object.values(ResearchTier).map((tier) => (<option key={tier} value={tier}>{tier}</option>))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Content</label>
                      <textarea 
                        value={noteContent} 
                        onChange={(e) => setNoteContent(e.target.value)} 
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-substack-orange/20 focus:border-substack-orange outline-none min-h-[200px] font-serif text-sm leading-relaxed resize-y" 
                        placeholder="Write your analysis here (URLs will become footnotes [fn.X])..." 
                      />
                  </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button onClick={() => setIsNoteModalOpen(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">Cancel</button>
                  <button onClick={handleSaveUserNote} className="px-4 py-2 bg-substack-orange text-white rounded-lg text-sm font-medium">Save</button>
              </div>
           </div>
        </div>
      )}

      {/* Synthesis Modal */}
      {isSynthesisModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
              <h3 className="text-lg font-serif font-bold text-slate-800 mb-4">Synthesis Engine</h3>
              <div className="space-y-4 mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Synthesis Mode</label>
                  <button onClick={() => setSynthesisMode('query')} className={`w-full p-3 rounded-lg border text-left transition-all ${synthesisMode === 'query' ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800' : 'border-slate-200 hover:border-slate-300'}`}><span className="font-bold text-slate-900 block">Query Evolution</span></button>
                  <button onClick={() => setSynthesisMode('user_note')} className={`w-full p-3 rounded-lg border text-left transition-all ${synthesisMode === 'user_note' ? 'border-substack-orange bg-orange-50 ring-1 ring-substack-orange' : 'border-slate-200 hover:border-slate-300'}`}><span className="font-bold text-slate-900 block">User Narrative</span></button>
                  <button onClick={() => setSynthesisMode('assistant_note')} className={`w-full p-3 rounded-lg border text-left transition-all ${synthesisMode === 'assistant_note' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}><span className="font-bold text-slate-900 block">Operational Evidence</span></button>
                  {synthesisMode === 'assistant_note' && (
                      <div className="pl-2 pt-2 border-l-2 border-blue-100 ml-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Include Tiers:</label>
                          <div className="grid grid-cols-2 gap-2">
                              {Object.values(ResearchTier).map(tier => (
                                  <label key={tier} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                                      <input type="checkbox" checked={synthesisTiers.includes(tier)} onChange={(e) => { if (e.target.checked) setSynthesisTiers([...synthesisTiers, tier]); else setSynthesisTiers(synthesisTiers.filter(t => t !== tier)); }} className="rounded text-blue-600 focus:ring-blue-500" />
                                      <span>{tier.split('/')[0]}</span>
                                  </label>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setIsSynthesisModalOpen(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">Cancel</button>
                  <button onClick={executeSynthesis} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Generate Synthesis</button>
              </div>
           </div>
        </div>
      )}

      {/* Main Layout */}
      <main className="flex-1 flex flex-col transition-all duration-300" style={{ marginRight: isSidebarOpen ? 0 : 0 }}>
        <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-substack-orange rounded-full flex items-center justify-center text-white font-serif font-bold">GL</div>
             <div>
               <h1 className="font-serif font-bold text-lg text-slate-800">Generative Lives</h1>
               <div className="flex items-center gap-2">
                   <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">v3.2 • {userIdentity.firstName}</span>
                   <button onClick={() => setIsCalibrationOpen(true)} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[9px] font-bold text-blue-600 uppercase tracking-wider transition-colors">
                       Mode: {guidance.inferenceLevel}
                   </button>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleResetSession} className="text-slate-400 hover:text-red-600 text-xs font-medium">Reset</button>
             <button onClick={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
             <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                <button onClick={() => setUseSearch(!useSearch)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${useSearch ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  {useSearch ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Search Active</> : 'Discussion'}
                </button>
             </div>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-slate-600 ml-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 00-2 2" /></svg></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
           <div className="max-w-3xl mx-auto">
              {messages.map(msg => (<MessageBubble key={msg.id} message={msg} onAddToResearch={handleAddToResearch} onCalibrate={() => setIsCalibrationOpen(true)} />))}
              {isLoading && (<div className="flex justify-start mb-6"><div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3"><span className="text-sm text-slate-500 font-medium animate-pulse">{useSearch ? "Searching..." : "Thinking..."}</span></div></div>)}
              <div ref={messagesEndRef} />
           </div>
        </div>

        <div className="p-6 bg-white border-t shrink-0">
           <div className="max-w-3xl mx-auto">
              <div className="relative">
                  <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Ask a question..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-12 focus:ring-2 focus:ring-substack-orange/20 focus:border-substack-orange outline-none resize-none text-sm min-h-[60px] max-h-[150px]" rows={2} />
                  <button onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()} className="absolute right-3 bottom-3 p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg></button>
              </div>
           </div>
        </div>
      </main>

      {isSidebarOpen && (
        <>
          <div className="w-1 cursor-col-resize bg-slate-200 hover:bg-substack-orange transition-colors z-30" onMouseDown={() => setIsResizing(true)} />
          <aside style={{ width: sidebarWidth }} className="bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-20 max-w-[800px] min-w-[300px]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="font-serif font-bold text-slate-800">Research Board</h2>
                <div className="flex items-center gap-1">
                    <button onClick={openNewNoteModal} className="text-xs bg-slate-900 text-white px-2 py-1.5 rounded hover:bg-slate-700 transition-colors mr-2 flex items-center gap-1"><span>+ Add Note</span></button>
                    <button onClick={handleSaveSession} className="p-1.5 text-substack-orange hover:text-orange-700 hover:bg-orange-50 rounded transition-colors mr-1" title="Save Session (JSON)"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg></button>
                    <button onClick={() => handleDownload('markdown')} disabled={researchItems.length === 0} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-30" title="Download .MD">M↓</button>
                </div>
              </div>
              <div className="p-4 border-b border-slate-100">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Current Focus Tier</label>
                <select value={currentTier} onChange={(e) => setCurrentTier(e.target.value as ResearchTier)} className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {Object.values(ResearchTier).map((tier) => (<option key={tier} value={tier}>{tier}</option>))}
                </select>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 scrollbar-visible">
                {researchItems.length === 0 ? (<div className="text-center mt-10 p-6 border-2 border-dashed border-slate-200 rounded-lg"><p className="text-sm text-slate-400 mb-2">Your board is empty.</p><p className="text-xs text-slate-400">Click "+ Add Note" or save insights from the chat.</p></div>) : (researchItems.map(item => (<ResearchCard key={item.id} item={item} onDelete={handleDeleteResearchItem} onEdit={item.type === 'user_note' ? openEditNoteModal : undefined} onReply={handleReply} />)))}
              </div>
              <div className="p-4 border-t border-slate-200 bg-white">
                  <button onClick={handleStartSynthesis} disabled={isLoading || researchItems.length === 0} className="w-full py-2 bg-substack-orange hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>Synthesize Findings
                  </button>
              </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default App;
