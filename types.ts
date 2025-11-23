
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
export type SynthesisMode = 'query' | 'user_note' | 'assistant_note';
export type ExportFormat = 'markdown' | 'txt' | 'json';
export type InferenceLevel = 'strict' | 'cautious' | 'bold';

export interface GuidanceConfig {
  inferenceLevel: InferenceLevel;
  customInstructions: string;
  formatPreference: string;
  depthPreference: string;
}

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
  action?: string;
}

export interface ResearchItem {
  id: string;
  refId: number;
  title?: string;
  content: string;
  sourceUrl?: string; // Legacy
  sourceTitle?: string; // Legacy
  sources?: GroundingSource[]; // V2.8: Full structured sources
  actor: 'user' | 'model'; // V2.8: Explicit provenance
  respondsToRefId?: number; // V2.8: Threading logic
  tier: ResearchTier;
  timestamp: Date;
  notes?: string;
  type: 'question' | 'insight' | 'user_note';
}

export interface UserIdentity {
  firstName: string;
  lastName: string;
}

export interface AppState {
  messages: Message[];
  researchItems: ResearchItem[];
  isSearching: boolean;
  currentTier: ResearchTier;
  modelId: ModelId;
  userIdentity: UserIdentity | null;
}

export interface SessionData {
  version: string;
  timestamp: string;
  sessionStartTime: string;
  userIdentity: UserIdentity;
  messages: Message[];
  researchItems: ResearchItem[];
  modelId: ModelId;
  nextRefId: number;
  guidanceConfig?: GuidanceConfig;
}
