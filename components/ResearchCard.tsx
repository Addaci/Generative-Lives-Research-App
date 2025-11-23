
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

  // Determine styles based on type
  let borderClass = '';
  
  if (isQuestion) {
    borderClass = 'border-l-slate-600';
  } else if (isUserNote) {
    borderClass = 'border-l-substack-orange';
  } else if (isAssistantNote) {
    borderClass = 'border-l-blue-500';
  }
  
  const tierBadgeClass = TIER_COLORS[item.tier];

  // Combine legacy sourceUrl with new sources array for display
  const allSources = item.sources || [];
  if (item.sourceUrl && !allSources.find(s => s.uri === item.sourceUrl)) {
      allSources.push({ title: item.sourceTitle || 'Source', uri: item.sourceUrl });
  }

  return (
    <div className={`p-4 mb-3 rounded-lg border shadow-sm transition-all hover:shadow-md bg-white border-l-4 ${borderClass} relative`}>
      
      {/* Reference Anchor Badge */}
      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold border border-slate-200" title={`Reference ID #${item.refId}`}>
        #{item.refId}
      </div>

      <div className="flex justify-between items-start mb-2 pr-8">
        <div className="flex gap-2 items-center flex-wrap">
            {/* Primary Type Badge */}
            {isUserNote && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-white">
                    User Note
                </span>
            )}
            {isAssistantNote && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                    Assistant Note
                </span>
            )}
            {isQuestion && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-600 text-white">
                    Query
                </span>
            )}

            {/* Tier Badge */}
            {!isQuestion && (
                 <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tierBadgeClass}`}>
                    {item.tier}
                 </span>
            )}
        </div>
      </div>
      
      {/* Reply Context */}
      {item.respondsToRefId && (
          <div className="mb-2 text-[10px] text-slate-400 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Replying to #{item.respondsToRefId}</span>
          </div>
      )}
      
      {/* Actions Row */}
      <div className="flex gap-1 mb-3">
            <button 
            onClick={() => onReply(item.refId)}
            className="text-slate-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-50"
            title="Quote & Reply"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reply
            </button>

            {isUserNote && onEdit && (
                <button 
                onClick={() => onEdit(item)}
                className="text-slate-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                </button>
            )}
            <button 
            onClick={() => onDelete(item.id)}
            className="text-slate-400 hover:text-red-500 transition-colors text-xs flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-50"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Delete
            </button>
      </div>
      
      {item.title && (
          <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">{item.title}</h4>
      )}

      <div className={`text-sm text-slate-800 mb-2 leading-relaxed prose prose-sm max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline ${isQuestion ? 'font-serif italic text-slate-600' : 'font-sans'}`}>
        <ReactMarkdown>{item.content}</ReactMarkdown>
      </div>

      {item.notes && (
        <p className="text-xs text-slate-500 italic border-t pt-2 mt-2">
          "{item.notes}"
        </p>
      )}

      {/* Sources Lozenges (Unified V3.2 Style: [fn.X] for all) */}
      {allSources.length > 0 && !isQuestion && (
        <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5">
                {allSources.map((source, idx) => (
                    <a 
                        key={idx}
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-full px-2.5 py-1 max-w-full transition-colors text-decoration-none"
                    >
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            [fn.{idx + 1}]
                        </span>
                        <span className="text-xs text-blue-600 truncate max-w-[150px]">{source.title || 'Link'}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};
