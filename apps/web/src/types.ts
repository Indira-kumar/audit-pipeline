export interface AuditEntry {
  _id: string;
  evidenceId: string;
  entityName: string;
  description: string;
  monetaryImpact: number;
  controlId: string;
  actorUserId: string;
  evidenceVersion: number;
  enrichmentJob: { state: string; lastError?: string };
  aiMetadata: {
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    riskScore: number | null;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    aiSummary: string | null;
    auditorNotes: string;
  };
}

export interface SimilarMatch {
  id: string;
  evidenceId: string;
  entityName: string;
  description: string;
  riskScore: number | null;
  similarityScore: number;
}
