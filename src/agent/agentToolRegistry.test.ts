import { expect, test } from 'bun:test';
import {
  executeAgentToolCalls,
  parseAgentToolCallPlanResponse,
  type AgentToolHandlers,
} from './agentToolRegistry.ts';

test('parses a valid tool call plan', () => {
  const plan = parseAgentToolCallPlanResponse(JSON.stringify({
    toolCalls: [
      {
        toolName: 'discoverOpportunity',
        arguments: {
          targetType: 'tag',
          targetId: 'color:tan',
          title: 'Tan tag is heating up',
          summary: 'Tan has strong engagement in the current window.',
          score: 0.72,
        },
      },
      {
        toolName: 'recordActionProposal',
        arguments: {
          proposalType: 'list_candidate',
          targetType: 'candidate',
          targetIds: ['STYLE055'],
          intendedAction: 'List candidate style',
          hypothesis: 'Candidate matches a high-interest tag.',
          expectedMetrics: [{ metric: 'favorite_count', direction: 'increase', minDelta: 3 }],
          rollbackCondition: 'Move back if favorites do not increase in 12 hours.',
          reviewWindowHours: 12,
          confidence: 0.7,
        },
      },
    ],
  }));

  expect(plan.toolCalls.map(call => call.toolName)).toEqual([
    'discoverOpportunity',
    'recordActionProposal',
  ]);
});

test('rejects unknown tool names', () => {
  expect(() => parseAgentToolCallPlanResponse(JSON.stringify({
    toolCalls: [
      {
        toolName: 'adjustRecommendation',
        arguments: {
          proposalId: 'PPL001',
        },
      },
    ],
  }))).toThrow('Invalid agent tool call plan');
});

test('rejects recordActionProposal with a tag target', () => {
  expect(() => parseAgentToolCallPlanResponse(JSON.stringify({
    toolCalls: [
      {
        toolName: 'recordActionProposal',
        arguments: {
          proposalType: 'adjust_recommendation',
          targetType: 'tag',
          targetIds: ['tan', 'short'],
          intendedAction: 'Promote hot tag',
          hypothesis: 'The tag is trending.',
          expectedMetrics: [{ metric: 'tryon_count', direction: 'increase', minDelta: 5 }],
          rollbackCondition: 'Rollback if try-on count does not increase.',
          confidence: 0.8,
        },
      },
    ],
  }))).toThrow('Invalid agent tool call plan');
});

test('executes record tools with the current agent run id', async () => {
  const calls = parseAgentToolCallPlanResponse(JSON.stringify({
    toolCalls: [
      {
        toolName: 'discoverOpportunity',
        arguments: {
          targetType: 'tag',
          targetId: 'color:tan',
          title: 'Tan tag is heating up',
          summary: 'Tan has strong engagement in the current window.',
          score: 0.72,
        },
      },
      {
        toolName: 'recordActionProposal',
        arguments: {
          proposalType: 'list_candidate',
          targetType: 'candidate',
          targetIds: ['STYLE055'],
          intendedAction: 'List candidate style',
          hypothesis: 'Candidate matches a high-interest tag.',
          expectedMetrics: [{ metric: 'favorite_count', direction: 'increase', minDelta: 3 }],
          rollbackCondition: 'Move back if favorites do not increase in 12 hours.',
          reviewWindowHours: 12,
          confidence: 0.7,
        },
      },
      {
        toolName: 'continueObservation',
        arguments: {
          note: 'Keep monitoring until stronger evidence appears.',
        },
      },
    ],
  })).toolCalls;

  const seen: string[] = [];
  const handlers: AgentToolHandlers = {
    discoverOpportunity: async (input) => {
      seen.push(`opportunity:${input.agentRunId}:${input.targetType}:${input.targetId}`);
      return { findingId: 'FDG001', status: 'recorded' };
    },
    diagnoseAnomaly: async (input) => {
      seen.push(`anomaly:${input.agentRunId}:${input.targetType}:${input.targetId}`);
      return { findingId: 'FDG002', status: 'recorded' };
    },
    continueObservation: async (agentRunId, note) => {
      seen.push(`observation:${agentRunId}:${note}`);
      return { findingId: 'FDG003', status: 'recorded' };
    },
    recordActionProposal: async (input) => {
      seen.push(`proposal:${input.agentRunId}:${input.proposalType}:${input.targetType}`);
      return { proposalId: 'PPL001', status: 'pending_check' };
    },
  };

  const result = await executeAgentToolCalls(calls, 'RUN_TEST', handlers);

  expect(seen).toEqual([
    'opportunity:RUN_TEST:tag:color:tan',
    'proposal:RUN_TEST:list_candidate:candidate',
    'observation:RUN_TEST:Keep monitoring until stronger evidence appears.',
  ]);
  expect(result.findingIds).toEqual(['FDG001', 'FDG003']);
  expect(result.proposalIds).toEqual(['PPL001']);
});
