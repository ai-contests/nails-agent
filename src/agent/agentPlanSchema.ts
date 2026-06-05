import { z } from 'zod';
import type { RecordProposalInput } from './tools.ts';

export const ExpectedMetricSchema = z.object({
  metric: z.enum([
    'view_count',
    'click_count',
    'tryon_count',
    'favorite_count',
    'heat_score',
    'growth_score',
    'conversion_score',
  ]),
  direction: z.enum(['increase', 'decrease', 'maintain']),
  minDelta: z.number().nonnegative().optional(),
}).strict();

export const FindingSchema = z.object({
  findingType: z.enum(['opportunity', 'anomaly']),
  targetType: z.enum(['style', 'tag', 'candidate', 'global']),
  targetId: z.string().min(1).optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).optional(),
  score: z.number().min(0).max(1).optional(),
}).strict();

const BaseProposalSchema = z.object({
  targetIds: z.array(z.string().min(1)),
  intendedAction: z.string().min(1),
  hypothesis: z.string().min(1),
  expectedMetrics: z.array(ExpectedMetricSchema).min(1),
  rollbackCondition: z.string().min(1),
  reviewWindowHours: z.number().int().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
  executionTool: z.string().min(1).optional(),
  executionPayload: z.record(z.string(), z.unknown()).optional(),
}).strict();

const AdjustRecommendationProposalSchema = BaseProposalSchema.extend({
  proposalType: z.literal('adjust_recommendation'),
  targetType: z.literal('style'),
  targetIds: z.array(z.string().min(1)).min(1).max(10),
}).strict();

const ListCandidateProposalSchema = BaseProposalSchema.extend({
  proposalType: z.literal('list_candidate'),
  targetType: z.literal('candidate'),
  targetIds: z.array(z.string().min(1)).min(1).max(3),
}).strict();

const UnlistToCandidateProposalSchema = BaseProposalSchema.extend({
  proposalType: z.literal('unlist_to_candidate'),
  targetType: z.literal('style'),
  targetIds: z.array(z.string().min(1)).min(1).max(3),
}).strict();

const NoActionProposalSchema = z.object({
  proposalType: z.literal('no_action'),
  targetType: z.literal('global'),
  targetIds: z.array(z.string()).max(0),
  intendedAction: z.string().min(1),
  hypothesis: z.string().min(1),
  expectedMetrics: z.array(ExpectedMetricSchema).max(0),
  rollbackCondition: z.string().min(1),
  reviewWindowHours: z.number().int().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
  executionTool: z.string().min(1).optional(),
  executionPayload: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const ProposalSchema = z.discriminatedUnion('proposalType', [
  AdjustRecommendationProposalSchema,
  ListCandidateProposalSchema,
  UnlistToCandidateProposalSchema,
  NoActionProposalSchema,
]);

const AgentPlanSchema = z.object({
  findings: z.array(FindingSchema),
  proposals: z.array(ProposalSchema),
}).strict();

export type AgentPlan = z.infer<typeof AgentPlanSchema>;
export type AgentPlanFinding = AgentPlan['findings'][number];
export type AgentPlanProposal = AgentPlan['proposals'][number] & Omit<RecordProposalInput, 'agentRunId'>;

export function parseAgentPlanResponse(responseText: string): AgentPlan {
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Invalid agent plan JSON: ${(error as Error).message}`);
  }

  const result = AgentPlanSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid agent plan: ${issues}`);
  }

  return result.data;
}
