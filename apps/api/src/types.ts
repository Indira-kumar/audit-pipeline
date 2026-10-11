import type { ObjectId } from 'mongodb';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AIStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobState = 'UNPUBLISHED' | 'PUBLISHED' | 'DONE';

export interface AIEnrichment {
  status: AIStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  aiSummary: string | null;
  anomalyFlags: string[];
  semanticVector: number[];
  auditorNotes: string;
}

export interface EnrichmentResult {
  riskScore: number;
  riskLevel: RiskLevel;
  aiSummary: string;
  anomalyFlags: string[];
  semanticVector: number[];
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
  enrichmentJob: { state: JobState; requestedAt: Date };
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
}

export interface SimilarMatch {
  id: ObjectId;
  evidenceId: string;
  entityName: string;
  description: string;
  riskScore: number | null;
  similarityScore: number;
}

export interface AuditStore {
  list(): Promise<AuditEntry[]>;
  create(entry: NewAuditEntry): Promise<AuditEntry>;
  findById(id: ObjectId): Promise<AuditEntry | null>;
  updateNotes(id: ObjectId, set: NoteUpdateSet): Promise<AuditEntry | null>;
  updateCore(id: ObjectId, expectedVersion: number, set: CoreUpdateSet): Promise<AuditEntry | null>;
  findSimilarCandidates(source: AuditEntry): Promise<AuditEntry[]>;
}
