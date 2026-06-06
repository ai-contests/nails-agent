import { z } from 'zod';
import * as tools from './tools';
import { ProposalSchema } from './agentPlanSchema';

const DiscoverOpportunityArgumentsSchema = z.object({
  targetType: z.enum(['style', 'tag', 'candidate', 'global']),
  targetId: z.string().min(1).optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).optional(),
  score: z.number().min(0).max(1).optional(),
}).strict();

const DiagnoseAnomalyArgumentsSchema = z.object({
  targetType: z.enum(['style', 'tag', 'global']),
  targetId: z.string().min(1).optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).optional(),
  score: z.number().min(0).max(1).optional(),
}).strict();

const ContinueObservationArgumentsSchema = z.object({
  note: z.string().min(1),
}).strict();

const AgentToolCallSchema = z.discriminatedUnion('toolName', [
  z.object({
    toolName: z.literal('discoverOpportunity'),
    arguments: DiscoverOpportunityArgumentsSchema,
  }).strict(),
  z.object({
    toolName: z.literal('diagnoseAnomaly'),
    arguments: DiagnoseAnomalyArgumentsSchema,
  }).strict(),
  z.object({
    toolName: z.literal('continueObservation'),
    arguments: ContinueObservationArgumentsSchema,
  }).strict(),
  z.object({
    toolName: z.literal('recordActionProposal'),
    arguments: ProposalSchema,
  }).strict(),
]);

const AgentToolCallPlanSchema = z.object({
  toolCalls: z.array(AgentToolCallSchema),
}).strict();

export type AgentToolCallPlan = z.infer<typeof AgentToolCallPlanSchema>;
export type AgentToolCall = AgentToolCallPlan['toolCalls'][number];

type FindingToolResult = Promise<{ findingId: string; status: string }>;
type ProposalToolResult = Promise<{ proposalId: string; status: string }>;

export interface AgentToolHandlers {
  discoverOpportunity(input: tools.DiscoverOpportunityInput): FindingToolResult;
  diagnoseAnomaly(input: tools.DiagnoseAnomalyInput): FindingToolResult;
  continueObservation(agentRunId: string, note: string): FindingToolResult;
  recordActionProposal(input: tools.RecordProposalInput): ProposalToolResult;
}

export interface AgentToolExecutionResult {
  findingIds: string[];
  proposalIds: string[];
}

export const defaultAgentToolHandlers: AgentToolHandlers = {
  discoverOpportunity: tools.discoverOpportunity,
  diagnoseAnomaly: tools.diagnoseAnomaly,
  continueObservation: tools.continueObservation,
  recordActionProposal: tools.recordActionProposal,
};

/**
 * Coerce common LLM targetType mistakes before Zod validation.
 * e.g. list_candidate with targetType:"style" → targetType:"candidate"
 */
function coerceToolCallPlan(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj['toolCalls'])) return raw;
  obj['toolCalls'] = (obj['toolCalls'] as unknown[]).map(tc => {
    if (!tc || typeof tc !== 'object') return tc;
    const call = tc as Record<string, unknown>;
    const args = call['arguments'] as Record<string, unknown> | undefined;
    if (!args) return tc;
    // list_candidate must have targetType="candidate"
    if (call['toolName'] === 'recordActionProposal' && args['proposalType'] === 'list_candidate') {
      args['targetType'] = 'candidate';
    }
    // unlist_to_candidate must have targetType="style"
    if (call['toolName'] === 'recordActionProposal' && args['proposalType'] === 'unlist_to_candidate') {
      args['targetType'] = 'style';
    }
    return tc;
  });
  return obj;
}

export function parseAgentToolCallPlanResponse(responseText: string): AgentToolCallPlan {
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Invalid agent tool call plan JSON: ${(error as Error).message}`);
  }

  parsed = coerceToolCallPlan(parsed);

  const result = AgentToolCallPlanSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid agent tool call plan: ${issues}`);
  }

  return result.data;
}

export async function executeAgentToolCalls(
  toolCalls: AgentToolCall[],
  agentRunId: string,
  handlers: AgentToolHandlers = defaultAgentToolHandlers,
): Promise<AgentToolExecutionResult> {
  const findingIds: string[] = [];
  const proposalIds: string[] = [];

  for (const call of toolCalls) {
    if (call.toolName === 'discoverOpportunity') {
      const result = await handlers.discoverOpportunity({
        agentRunId,
        ...call.arguments,
        evidence: call.arguments.evidence ?? {},
      });
      findingIds.push(result.findingId);
    } else if (call.toolName === 'diagnoseAnomaly') {
      const result = await handlers.diagnoseAnomaly({
        agentRunId,
        ...call.arguments,
        evidence: call.arguments.evidence ?? {},
      });
      findingIds.push(result.findingId);
    } else if (call.toolName === 'continueObservation') {
      const result = await handlers.continueObservation(agentRunId, call.arguments.note);
      findingIds.push(result.findingId);
    } else if (call.toolName === 'recordActionProposal') {
      const result = await handlers.recordActionProposal({
        agentRunId,
        ...call.arguments,
      });
      proposalIds.push(result.proposalId);
    }
  }

  return { findingIds, proposalIds };
}
