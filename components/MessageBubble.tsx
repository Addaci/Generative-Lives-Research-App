import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role, GroundingSource, ResearchTier } from '../types';

interface MessageBubbleProps {
  message: Message;
  onAddToResearch: (text: string, source?: GroundingSource) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onAddToResearch }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[85%] lg:max-w-[75%] rounded-2xl p-5 shadow-sm 
          ${isUser 
            ? 'bg-slate-800 text-white rounded-br-none' 
            : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
          }`}
      >
        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>

        {/* Sources Section for Model */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Evidence / Sources</h4>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, idx) => (
                <div key={idx} className="group flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1 max-w-full">
                  <a 
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
                  >
                    {source.title}
                  </a>
                  <button
                    onClick={() => onAddToResearch(message.text.substring(0, 150) + "...", source)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-200"
                    title="Save to Research Board"
                  >
                    + Save
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions for Model Messages without specific sources (saving the insight itself) */}
        {!isUser && (!message.sources || message.sources.length === 0) && (
           <div className="mt-3 flex justify-end">
             <button
                onClick={() => onAddToResearch(message.text)}
                className="text-xs text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
               </svg>
               Capture Insight
             </button>
           </div>
        )}
      </div>
    </div>
  );
};
