
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
export type InferenceLevel = 'strict' | 'cautious' | 'moderate' | 'bold';

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
  action?: 'calibrate';
}

export interface ResearchItem {
  id: string;
  refId: number;
  title?: string;
  content: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sources?: GroundingSource[];
  actor: 'user' | 'model';
  respondsToRefId?: number;
  tier: ResearchTier;
  timestamp: Date;
  notes?: string;
  type: 'question' | 'insight' | 'user_note';
}

export interface UserIdentity {
  firstName: string;
  lastName: string;
}

export interface GuidanceConfig {
  inferenceLevel: InferenceLevel;
  customInstructions: string;
  formatPreference: string;
  depthPreference: string;
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
