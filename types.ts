export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum ResearchTier {
  ASSOCIATE = 'Associate/Entry',
  EXPERIENCED = 'Experienced/Manager',
  PARTNER = 'Partner/Executive',
  GENERAL = 'General/Firm-wide'
}

export type ModelId = 'gemini-2.5-flash' | 'gemini-3-pro-preview';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  sources?: GroundingSource[];
  suggestedActions?: string[];
}

export interface ResearchItem {
  id: string;
  content: string;
  sourceUrl?: string;
  sourceTitle?: string;
  tier: ResearchTier;
  timestamp: Date;
  notes?: string;
}

export interface AppState {
  messages: Message[];
  researchItems: ResearchItem[];
  isSearching: boolean;
  currentTier: ResearchTier;
  modelId: ModelId;
}