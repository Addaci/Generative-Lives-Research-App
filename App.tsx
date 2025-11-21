import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Role, ResearchItem, ResearchTier, GroundingSource, ModelId } from './types';
import { sendMessageToGemini, synthesizeNotes } from './services/geminiService';
import { INITIAL_SUGGESTIONS, TIER_COLORS } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { ResearchCard } from './components/ResearchCard';

// Helper for local storage persistence with Date revival
const loadFromStorage = <T,>(key: string, defaultVal: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved, (key, value) => {
        // Simple check to see if a string looks like an ISO date
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
  
  // Initialize from Local Storage if available
  const [messages, setMessages] = useState<Message[]>(() => 
    loadFromStorage('gl_chat_history_v1', [
      {
        id: 'welcome',
        role: Role.MODEL,
        text: "Hello. I'm ready to support your research for *Generative Lives*.\n\nTo begin our Socratic inquiry: Please tell me the main theme you want to explore today, and whether you have a specific research question or hypothesis you would like to test",
        timestamp: new Date()
      }
    ])
  );

  const [researchItems, setResearchItems] = useState<ResearchItem[]>(() => 
    loadFromStorage('gl_research_items_v1', [])
  );
  
  // Default to flash, but load user preference if exists
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => 
    loadFromStorage('gl_model_pref_v1', 'gemini-2.5-flash')
  );

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [currentTier, setCurrentTier] = useState<ResearchTier>(ResearchTier.GENERAL);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  
  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('gl_chat_history_v1', JSON.stringify(messages));
    localStorage.setItem('gl_research_items_v1', JSON.stringify(researchItems));
    localStorage.setItem('gl_model_pref_v1', JSON.stringify(selectedModel));
  }, [messages, researchItems, selectedModel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Handlers ---

  const handleSendMessage = async (text: string = inputValue) => {
    if (!text.trim()) return;

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
      const response = await sendMessageToGemini(messages.concat(newUserMsg), text, useSearch, selectedModel);
      
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

  const handleAddToResearch = (content: string, source?: GroundingSource) => {
    const newItem: ResearchItem = {
      id: uuidv4(),
      content: content,
      sourceTitle: source?.title,
      sourceUrl: source?.uri,
      tier: currentTier,
      timestamp: new Date(),
    };
    setResearchItems(prev => [newItem, ...prev]);
  };

  const handleDeleteResearchItem = (id: string) => {
    setResearchItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSynthesize = async () => {
    if (researchItems.length === 0) return;
    setIsLoading(true);
    try {
        const summary = await synthesizeNotes(researchItems.map(i => i.content), selectedModel);
        setMessages(prev => [...prev, {
            id: uuidv4(),
            role: Role.MODEL,
            text: `**Synthesis of your Research Board:**\n\n${summary}`,
            timestamp: new Date()
        }]);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  // Reset Session
  const handleNewSession = () => {
    if (window.confirm("Start a new session? This will clear your current chat and research board.")) {
        localStorage.removeItem('gl_chat_history_v1');
        localStorage.removeItem('gl_research_items_v1');
        setMessages([{
            id: uuidv4(),
            role: Role.MODEL,
            text: "Hello. I'm ready to support your research for *Generative Lives*.\n\nTo begin our Socratic inquiry: Please tell me the main theme you want to explore today, and whether you have a specific research question or hypothesis you would like to test",
            timestamp: new Date()
        }]);
        setResearchItems([]);
    }
  };

  // Generate Markdown content for export
  const generateBoardMarkdown = (): string => {
    const dateStr = new Date().toLocaleDateString();
    let content = `# Generative Lives Research Board\nDate: ${dateStr}\n\n`;
    
    // Group by Tier
    const tiers = Object.values(ResearchTier);
    tiers.forEach(tier => {
        const items = researchItems.filter(i => i.tier === tier);
        if (items.length > 0) {
            content += `## ${tier}\n`;
            items.forEach(item => {
                content += `- ${item.content}\n`;
                if (item.sourceTitle || item.sourceUrl) {
                    content += `  *Source: [${item.sourceTitle || 'Link'}](${item.sourceUrl || '#'})*\n`;
                }
                if (item.notes) {
                    content += `  *Note: ${item.notes}*\n`;
                }
                content += '\n';
            });
            content += '\n';
        }
    });
    return content;
  };

  const handleDownloadBoard = () => {
    const markdown = generateBoardMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Generative-Lives-Research-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyBoard = () => {
      const markdown = generateBoardMarkdown();
      navigator.clipboard.writeText(markdown).then(() => {
          alert("Research Board copied to clipboard!");
      });
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      
      {/* Help Modal */}
      {isHelpOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif font-bold text-slate-800">Research Assistant Help</h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <span className="font-bold text-substack-orange block mb-1">1. Define Your Thesis</span>
                <p>Start by proposing a hypothesis. The assistant will paraphrase and confirm before proceeding.</p>
              </div>
              <div>
                <span className="font-bold text-substack-orange block mb-1">2. Discussion vs. Search</span>
                <p>Use <strong>Discussion Mode</strong> to refine concepts Socratically. Toggle <strong>Search Active</strong> to find real-world evidence.</p>
              </div>
              <div>
                <span className="font-bold text-substack-orange block mb-1">3. Capture Evidence</span>
                <p>Click <strong>+ Save</strong> on sources or <strong>Capture Insight</strong> on text bubbles to add them to your Research Board.</p>
              </div>
              <div>
                <span className="font-bold text-substack-orange block mb-1">4. Tier & Synthesize</span>
                <p>Tag notes by professional tier. Click <strong>Synthesize Findings</strong> to draft your article structure.</p>
              </div>
            </div>
            <div className="mt-6 text-right">
              <button 
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors"
              >
                Close
              </button>
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
                    <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${selectedModel === 'gemini-2.5-flash' ? 'border-substack-orange bg-orange-50 ring-1 ring-substack-orange' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input 
                            type="radio" 
                            name="model" 
                            value="gemini-2.5-flash"
                            checked={selectedModel === 'gemini-2.5-flash'}
                            onChange={() => setSelectedModel('gemini-2.5-flash')}
                            className="mt-1 h-4 w-4 text-substack-orange border-slate-300 focus:ring-substack-orange"
                        />
                        <div className="ml-3">
                            <span className="block text-sm font-semibold text-slate-900">Standard (Gemini 2.5 Flash)</span>
                            <span className="block text-xs text-slate-500 mt-1">Fast, efficient, and excellent for general search and summarizing. Best for quick iteration.</span>
                        </div>
                    </label>

                    <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${selectedModel === 'gemini-3-pro-preview' ? 'border-substack-orange bg-orange-50 ring-1 ring-substack-orange' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input 
                            type="radio" 
                            name="model" 
                            value="gemini-3-pro-preview"
                            checked={selectedModel === 'gemini-3-pro-preview'}
                            onChange={() => setSelectedModel('gemini-3-pro-preview')}
                            className="mt-1 h-4 w-4 text-substack-orange border-slate-300 focus:ring-substack-orange"
                        />
                        <div className="ml-3">
                            <span className="block text-sm font-semibold text-slate-900">Pro (Gemini 3.0 Pro)</span>
                            <span className="block text-xs text-slate-500 mt-1">Advanced reasoning and synthesis. Best for "Deep Dive" Socratic dialogue and complex article structuring.</span>
                        </div>
                    </label>
                </div>
            </div>

            <div className="text-right">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Chat Area */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'mr-0' : 'mr-0'}`}>
        
        {/* Header */}
        <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-substack-orange rounded-full flex items-center justify-center text-white font-serif font-bold">
               GL
             </div>
             <div className="flex flex-col justify-center">
               <h1 className="font-serif font-bold text-lg text-slate-800 tracking-tight leading-tight">Generative Lives Research</h1>
               <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">v1.5</span>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             {/* New Session Button */}
             <button
                onClick={handleNewSession}
                className="text-slate-400 hover:text-red-600 hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium mr-1"
                title="Start Fresh / Clear Data"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
             </button>

             {/* Settings Button */}
             <button
                onClick={() => setIsSettingsOpen(true)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium mr-1"
                title="Configure Model"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>

             <button
                onClick={() => setIsHelpOpen(true)}
                className="text-slate-500 hover:text-blue-600 hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium mr-2"
                title="Help"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               Help
             </button>

             <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                <button 
                  onClick={() => setUseSearch(!useSearch)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${useSearch ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {useSearch ? 'Search Active' : 'Discussion Mode'}
                </button>
             </div>
             <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-slate-400 hover:text-slate-600 ml-2"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
             </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
           <div className="max-w-3xl mx-auto">
              {messages.map(msg => (
                <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    onAddToResearch={handleAddToResearch}
                />
              ))}
              {isLoading && (
                  <div className="flex justify-start mb-6">
                      <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                          <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-slate-500 font-medium animate-pulse">
                              {useSearch ? "Searching external sources..." : "Thinking deeply..."}
                          </span>
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
           </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t shrink-0">
           <div className="max-w-3xl mx-auto">
              {/* Suggestion Chips */}
              {messages.length < 3 && (
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide">
                      {INITIAL_SUGGESTIONS.map((sugg, i) => (
                          <button 
                            key={i}
                            onClick={() => handleSendMessage(sugg)}
                            className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-600 transition-colors"
                          >
                              {sugg}
                          </button>
                      ))}
                  </div>
              )}

              <div className="relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder="Ask a question, paste a URL, or propose a theory..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-12 focus:ring-2 focus:ring-substack-orange/20 focus:border-substack-orange outline-none resize-none text-sm min-h-[60px] max-h-[150px]"
                    rows={2}
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !inputValue.trim()}
                    className="absolute right-3 bottom-3 p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
              </div>
              <div className="mt-2 text-xs text-center text-slate-400">
                  AI can make mistakes. Verify important sources.
              </div>
           </div>
        </div>
      </main>

      {/* RIGHT: Research Sidebar */}
      {isSidebarOpen && (
        <aside className="w-[350px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-20">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <h2 className="font-serif font-bold text-slate-800">Research Board</h2>
             
             {/* Export Controls */}
             <div className="flex items-center gap-1">
                <button 
                   onClick={handleCopyBoard}
                   disabled={researchItems.length === 0}
                   className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors disabled:opacity-30"
                   title="Copy Board to Clipboard"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                </button>
                <button 
                   onClick={handleDownloadBoard}
                   disabled={researchItems.length === 0}
                   className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors disabled:opacity-30"
                   title="Download as Markdown"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
                <span className="mx-1 w-px h-4 bg-slate-300"></span>
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{researchItems.length}</span>
             </div>
          </div>

          <div className="p-4 border-b border-slate-100">
             <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Current Focus Tier</label>
             <select 
                value={currentTier}
                onChange={(e) => setCurrentTier(e.target.value as ResearchTier)}
                className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
             >
                 {Object.values(ResearchTier).map((tier) => (
                     <option key={tier} value={tier}>{tier}</option>
                 ))}
             </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
             {researchItems.length === 0 ? (
                 <div className="text-center mt-10 p-6 border-2 border-dashed border-slate-200 rounded-lg">
                     <p className="text-sm text-slate-400 mb-2">Your board is empty.</p>
                     <p className="text-xs text-slate-400">Click "Capture Insight" or "Save" on citations in the chat to build your evidence base.</p>
                 </div>
             ) : (
                 researchItems.map(item => (
                     <ResearchCard 
                        key={item.id} 
                        item={item} 
                        onDelete={handleDeleteResearchItem} 
                     />
                 ))
             )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-white">
              <button 
                onClick={handleSynthesize}
                disabled={isLoading || researchItems.length === 0}
                className="w-full py-2 bg-substack-orange hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                 </svg>
                 Synthesize Findings
              </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export default App;