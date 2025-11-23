
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ResearchItem } from '../types';
import { TIER_COLORS } from '../constants';

interface ResearchCardProps {
  item: ResearchItem;
  onDelete: (id: string) => void;
  onEdit?: (item: ResearchItem) => void;
  onReply: (refId: number) => void;
}

export const ResearchCard: React.FC<ResearchCardProps> = ({ item, onDelete, onEdit, onReply }) => {
  const isQuestion = item.type === 'question';
  const isUserNote = item.type === 'user_note';
  const isAssistantNote = item.type === 'insight';

  let borderClass = '';
  if (isQuestion) borderClass = 'border-l-slate-600';
  else if (isUserNote) borderClass = 'border-l-substack-orange';
  else if (isAssistantNote) borderClass = 'border-l-blue-500';
  
  const tierBadgeClass = TIER_COLORS[item.tier];

  const allSources = item.sources || [];
  if (item.sourceUrl && !allSources.find(s => s.uri === item.sourceUrl)) {
      allSources.push({ title: item.sourceTitle || 'Source', uri: item.sourceUrl });
  }

  const hasFootnotes = /\[fn\.\d+\]/.test(item.content);
  const missingSources = hasFootnotes && allSources.length === 0 && !isQuestion;

  return (
    <div className={`p-4 mb-3 rounded-lg border shadow-sm transition-all hover:shadow-md bg-white border-l-4 ${borderClass} relative`}>
      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold border border-slate-200" title={`Reference ID #${item.refId}`}>#{item.refId}</div>

      <div className="flex justify-between items-start mb-2 pr-8">
        <div className="flex gap-2 items-center flex-wrap">
            {isUserNote && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-white">User Note</span>}
            {isAssistantNote && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">Assistant Note</span>}
            {isQuestion && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-600 text-white">Query</span>}
            {!isQuestion && <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tierBadgeClass}`}>{item.tier}</span>}
        </div>
      </div>
      
      {item.respondsToRefId && (
          <div className="mb-2 text-[10px] text-slate-400 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              <span>Replying to #{item.respondsToRefId}</span>
          </div>
      )}
      
      <div className="flex gap-1 mb-3">
            <button onClick={() => onReply(item.refId)} className="text-slate-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-50" title="Quote & Reply">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>Reply
            </button>
            {isUserNote && onEdit && (
                <button onClick={() => onEdit(item)} className="text-slate-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>Edit
                </button>
            )}
            <button onClick={() => onDelete(item.id)} className="text-slate-400 hover:text-red-500 transition-colors text-xs flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Delete
            </button>
      </div>
      
      {item.title && <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">{item.title}</h4>}
      <div className={`text-sm text-slate-800 mb-2 leading-relaxed prose prose-sm max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline ${isQuestion ? 'font-serif italic text-slate-600' : 'font-sans'}`}>
        <ReactMarkdown>{item.content}</ReactMarkdown>
      </div>
      {item.notes && <p className="text-xs text-slate-500 italic border-t pt-2 mt-2">"{item.notes}"</p>}

      {missingSources && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded border border-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span className="text-[10px] font-bold uppercase">⚠️ Sources Missing / Hallucination Risk</span>
          </div>
      )}

      {allSources.length > 0 && !isQuestion && (
        <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
                {allSources.map((source, idx) => (
                    <div key={idx} className="group flex items-center bg-slate-50 border border-slate-200 rounded-full max-w-full overflow-hidden hover:border-blue-300 transition-colors">
                        <div className="px-2 py-1 border-r border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-500">
                            {/* V4.4: Consistent [fn.X] Badge */}
                            {`[fn.${idx + 1}]`}
                        </div>
                        <a 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 truncate max-w-[180px]"
                            title={source.uri}
                        >
                            {source.title || 'Source'}
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
    </div>
  );
};
