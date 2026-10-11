import type { ObjectId } from 'mongodb';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AIStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobState =
  'UNPUBLISHED' | 'PUBLISHING' | 'PUBLISHED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface SearchEmbedding {
  model: string;
  chunks: Array<{ text: string; vector: number[] }>;
}

export interface AIEnrichment {
  status: AIStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  aiSummary: string | null;
  anomalyFlags: string[];
  semanticVector: number[];
  searchEmbedding?: SearchEmbedding;
  auditorNotes: string;
}

export interface EnrichmentResult {
  riskScore: number;
  riskLevel: RiskLevel;
  aiSummary: string;
  anomalyFlags: string[];
  semanticVector: number[];
  searchEmbedding: SearchEmbedding;
}

export interface AuditEntry {
  _id: ObjectId;
  tenantId: ObjectId;
  timestamp: Date;
  eventType: string;
  evidenceId: string;
  entityName: string;
  description: string;
  monetaryImpact: number;
  controlId: string;
  actorUserId: string;
  evidenceVersion: number;
  aiMetadata: AIEnrichment;
  enrichmentJob: {
    state: JobState;
    requestedAt: Date;
    requestId?: string;
    claimToken?: string;
    leaseUntil?: Date;
    startedAt?: Date;
    lastError?: string;
  };
  created: Date;
  updated: Date;
}

export type NewAuditEntry = Omit<AuditEntry, '_id' | 'tenantId'>;

export interface NoteUpdateSet {
  updated: Date;
  'aiMetadata.auditorNotes': string;
}

export interface CoreUpdateSet {
  updated: Date;
  description?: string;
  monetaryImpact?: number;
  controlId?: string;
  'aiMetadata.auditorNotes'?: string;
  'aiMetadata.status': AIStatus;
  'aiMetadata.riskScore': null;
  'aiMetadata.riskLevel': null;
  'aiMetadata.aiSummary': null;
  'aiMetadata.anomalyFlags': string[];
  'aiMetadata.semanticVector': number[];
  'enrichmentJob.state': JobState;
  'enrichmentJob.requestedAt': Date;
  'enrichmentJob.requestId': string;
}

export interface SimilarityCandidate {
  _id: ObjectId;
  evidenceId: string;
  entityName: string;
  description: string;
  controlId: string;
  timestamp: Date;
  aiMetadata: {
    riskScore: number | null;
    searchEmbedding?: SearchEmbedding;
  };
}

export interface SimilarMatch {
  id: ObjectId;
  evidenceId: string;
  entityName: string;
  description: string;
  riskScore: number | null;
  similarityScore: number;
  semanticScore: number;
  keywordScore: number;
}

export interface AuditStore {
  list(): Promise<AuditEntry[]>;
  create(entry: NewAuditEntry): Promise<AuditEntry>;
  findById(id: ObjectId): Promise<AuditEntry | null>;
  updateNotes(id: ObjectId, set: NoteUpdateSet): Promise<AuditEntry | null>;
  updateCore(id: ObjectId, expectedVersion: number, set: CoreUpdateSet): Promise<AuditEntry | null>;
  retryFailed(id: ObjectId, expectedVersion: number): Promise<AuditEntry | null>;
  findSimilarCandidates(source: AuditEntry): AsyncIterable<SimilarityCandidate>;
}
