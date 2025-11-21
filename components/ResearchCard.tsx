import React from 'react';
import { ResearchItem, ResearchTier } from '../types';
import { TIER_COLORS } from '../constants';

interface ResearchCardProps {
  item: ResearchItem;
  onDelete: (id: string) => void;
}

export const ResearchCard: React.FC<ResearchCardProps> = ({ item, onDelete }) => {
  return (
    <div className={`p-4 mb-3 rounded-lg border shadow-sm transition-all hover:shadow-md bg-white border-l-4 ${TIER_COLORS[item.tier].replace('bg-', 'border-l-')}`}>
      <div className="flex justify-between items-start mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TIER_COLORS[item.tier]}`}>
          {item.tier}
        </span>
        <button 
          onClick={() => onDelete(item.id)}
          className="text-slate-400 hover:text-red-500 transition-colors"
          aria-label="Delete note"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <p className="text-sm text-slate-800 font-medium mb-2 leading-relaxed font-serif">
        {item.content}
      </p>

      {item.notes && (
        <p className="text-xs text-slate-500 italic border-t pt-2 mt-2">
          "{item.notes}"
        </p>
      )}

      {(item.sourceUrl) && (
        <div className="mt-3 text-xs truncate">
            <a 
              href={item.sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {item.sourceTitle || item.sourceUrl}
            </a>
        </div>
      )}
    </div>
  );
};
