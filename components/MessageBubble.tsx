
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role, GroundingSource } from '../types';

interface MessageBubbleProps {
  message: Message;
  onAddToResearch: (text: string, sources?: GroundingSource[], type?: 'insight' | 'question', actor?: 'user' | 'model') => void;
  onCalibrate?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onAddToResearch, onCalibrate }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] rounded-2xl p-5 shadow-sm relative group
          ${isUser 
            ? 'bg-slate-800 text-white rounded-br-none' 
            : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
          }`}
      >
        {isUser && (
           <button 
             onClick={() => onAddToResearch(message.text, undefined, 'question', 'user')}
             className="absolute -left-8 top-2 p-1.5 text-slate-300 hover:text-substack-orange opacity-0 group-hover:opacity-100 transition-opacity"
             title="Save Question to Board"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
             </svg>
           </button>
        )}

        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'prose-slate'}`}>
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>

        {message.action === 'calibrate' && onCalibrate && (
            <div className="mt-4">
                <button 
                    onClick={onCalibrate}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium shadow-md"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Calibrate Assistant
                </button>
            </div>
        )}

        {!isUser && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-4">
                {message.sources && message.sources.length > 0 && (
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Evidence / Sources</h4>
                        <div className="flex flex-wrap gap-2">
                        {message.sources.map((source, idx) => (
                            <div key={idx} className="group flex items-center bg-slate-50 border border-slate-200 rounded-full max-w-full overflow-hidden hover:border-blue-300 transition-colors">
                                <div className="px-3 py-1 border-r border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-500">
                                    [fn.{idx + 1}]
                                </div>
                                <a 
                                    href={source.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 truncate max-w-[200px]"
                                    title={source.uri}
                                >
                                    {source.title}
                                </a>
                                <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(source.title)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border-l border-slate-200"
                                    title="Search this title on Google (Safety Net)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </a>
                            </div>
                        ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={() => onAddToResearch(message.text, message.sources, 'insight', 'model')}
                        className="text-xs font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-slate-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Capture Analysis & Evidence
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
