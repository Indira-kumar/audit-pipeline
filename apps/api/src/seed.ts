import { ObjectId } from 'mongodb';
import { connectDatabase, demoTenantId } from './config/database.js';
import type { AuditEntry, RiskLevel } from './types.js';

const day = 24 * 60 * 60 * 1000;
const dateDaysAgo = (days: number): Date => new Date(Date.now() - days * day);

interface SeedExample {
  evidenceId: string;
  daysAgo: number;
  entityName: string;
  description: string;
  monetaryImpact: number;
  controlId: string;
  actorUserId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  aiSummary: string;
  anomalyFlags: string[];
  semanticVector: number[];
}

const examples: SeedExample[] = [
  {
    evidenceId: 'EVID-902181',
    daysAgo: 21,
    entityName: 'Northstar Supplies',
    description: 'Manual approval override for a vendor invoice above the $50k threshold',
    monetaryImpact: 65000,
    controlId: 'CTRL-FIN-302',
    actorUserId: 'user_1042',
    riskScore: 82,
    riskLevel: 'HIGH',
    aiSummary:
      'A high-value vendor invoice used a manual approval override. Confirm the override was authorised and documented.',
    anomalyFlags: ['MONETARY_THRESHOLD_EXCEEDED', 'MANUAL_OVERRIDE'],
    semanticVector: [0.9, 0.78, 0.08, 0.1, 0.18, 0.04, 0.12, 0.06],
  },
  {
    evidenceId: 'EVID-902182',
    daysAgo: 14,
    entityName: 'Harbor Procurement',
    description: 'Urgent vendor payment approved outside the standard approval chain',
    monetaryImpact: 92000,
    controlId: 'CTRL-FIN-302',
    actorUserId: 'user_2048',
    riskScore: 88,
    riskLevel: 'HIGH',
    aiSummary:
      'An urgent vendor payment bypassed the usual approval chain. Review the approval trail and business reason.',
    anomalyFlags: ['MONETARY_THRESHOLD_EXCEEDED', 'APPROVAL_CHAIN_BYPASS'],
    semanticVector: [0.84, 0.71, 0.12, 0.16, 0.21, 0.05, 0.1, 0.08],
  },
  {
    evidenceId: 'EVID-902183',
    daysAgo: 9,
    entityName: 'Cedar Operations',
    description: 'Duplicate invoice reference found during a manual payable adjustment',
    monetaryImpact: 48000,
    controlId: 'CTRL-AP-118',
    actorUserId: 'user_3310',
    riskScore: 71,
    riskLevel: 'HIGH',
    aiSummary:
      'A payable adjustment references a possible duplicate invoice. Check whether the payment was already recorded.',
    anomalyFlags: ['POSSIBLE_DUPLICATE_INVOICE'],
    semanticVector: [0.15, 0.12, 0.87, 0.76, 0.08, 0.21, 0.09, 0.13],
  },
  {
    evidenceId: 'EVID-902184',
    daysAgo: 3,
    entityName: 'Global Procurement Services',
    description: 'Manual approval override for vendor payables exceeding the $50k threshold',
    monetaryImpact: 85000,
    controlId: 'CTRL-FIN-302',
    actorUserId: 'user_7731',
    riskScore: 86,
    riskLevel: 'HIGH',
    aiSummary:
      'A manual override approved vendor payables above the control threshold. Verify the approver and supporting evidence.',
    anomalyFlags: ['MONETARY_THRESHOLD_EXCEEDED', 'MANUAL_OVERRIDE'],
    semanticVector: [0.92, 0.8, 0.07, 0.09, 0.16, 0.04, 0.11, 0.05],
  },
];

function completedEntry(example: SeedExample, tenantId: ObjectId): AuditEntry {
  const timestamp = dateDaysAgo(example.daysAgo);
  return {
    _id: new ObjectId(),
    tenantId,
    timestamp,
    eventType: 'Control Execution',
    evidenceId: example.evidenceId,
    entityName: example.entityName,
    description: example.description,
    monetaryImpact: example.monetaryImpact,
    controlId: example.controlId,
    actorUserId: example.actorUserId,
    evidenceVersion: 1,
    aiMetadata: {
      status: 'COMPLETED',
      riskScore: example.riskScore,
      riskLevel: example.riskLevel,
      aiSummary: example.aiSummary,
      anomalyFlags: example.anomalyFlags,
      semanticVector: example.semanticVector,
      auditorNotes: '',
    },
    enrichmentJob: { state: 'DONE', requestedAt: timestamp },
    created: timestamp,
    updated: timestamp,
  };
}

const tenantId = demoTenantId();
const pendingAt = dateDaysAgo(1);
const pendingEntry: AuditEntry = {
  _id: new ObjectId(),
  tenantId,
  timestamp: pendingAt,
  eventType: 'Control Execution',
  evidenceId: 'EVID-902185',
  entityName: 'Pinecrest Finance',
  description: 'New vendor approval override awaiting risk review',
  monetaryImpact: 110000,
  controlId: 'CTRL-FIN-302',
  actorUserId: 'user_8802',
  evidenceVersion: 1,
  aiMetadata: {
    status: 'PENDING',
    riskScore: null,
    riskLevel: null,
    aiSummary: null,
    anomalyFlags: [],
    semanticVector: [],
    auditorNotes: '',
  },
  enrichmentJob: { state: 'UNPUBLISHED', requestedAt: pendingAt },
  created: pendingAt,
  updated: pendingAt,
};

const { client, entries } = await connectDatabase();
try {
  const documents = [...examples.map((example) => completedEntry(example, tenantId)), pendingEntry];
  let inserted = 0;
  for (const document of documents) {
    const result = await entries.updateOne(
      { tenantId, evidenceId: document.evidenceId },
      { $setOnInsert: document },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  }
  console.log(`Seed ready: ${inserted} new entries, ${documents.length} examples total.`);
} finally {
  await client.close();
}
