export interface AuditEntry {
  _id: string;
  evidenceId: string;
  entityName: string;
  description: string;
  monetaryImpact: number;
  controlId: string;
  actorUserId: string;
  evidenceVersion: number;
  aiMetadata: {
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    riskScore: number | null;
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
