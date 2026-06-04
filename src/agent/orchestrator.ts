import * as tools from './tools.js';
import { callLlmModel, ChatMessage } from '../services/llm.js';

interface StyleHeatItem {
  style_id: string | null;
  heat_score: number;
}

interface TagHeatItem {
  tag_type: string;
  tag_value: string;
  heat_score: number;
}

interface CandidateItem {
  style_id: string;
  color_tags: string;
}

interface StrategyMemoryItem {
  memory_id: string;
  lesson: string;
}

interface OperationContext {
  styleHeat: StyleHeatItem[];
  tagHeat: TagHeatItem[];
  candidates: CandidateItem[];
  memories: StrategyMemoryItem[];
}

export interface OperationalFinding {
  findingType: 'opportunity' | 'anomaly';
  targetType: 'style' | 'tag' | 'candidate' | 'global';
  targetId?: string;
  title: string;
  summary: string;
  evidence?: Record<string, unknown>;
  score?: number;
}

export async function runOperationCycle(triggerType: 'manual_demo' | 'scheduled_12h') {
  console.log(`[Agent Cycle] Starting run, trigger: ${triggerType}`);

  // Phase 0: Start Agent Run
  const runInfo = await tools.startAgentRun({ triggerType });
  const runId = runInfo.agentRunId;

  try {
    // Phase 1: Rollup behavior metrics
    console.log(`[Agent Cycle] Aggregating behavior events for run ${runId}`);
    await tools.rollupBehaviorWindow({
      agentRunId: runId,
      windowHours: 12,
      historyRounds: 5,
    });

    // Phase 2: Review due pending items
    console.log('[Agent Cycle] Reviewing past pending actions');
    const reviewCtx = await tools.getDueReviewContext(runId);
    for (const review of reviewCtx.pendingReviews) {
      // Mock review evaluation: check if conversion rate is above 0.5
      const outcomeScore = Math.random();
      const lesson = outcomeScore > 0.5
        ? `Action in decision ${review.decision_id} succeeded (score: ${outcomeScore.toFixed(2)}). Next time similar trends can be promoted.`
        : `Action in decision ${review.decision_id} showed poor performance (score: ${outcomeScore.toFixed(2)}). Use caution in next iterations.`;
      
      await tools.writeStrategyMemory({
        pendingReviewId: review.pending_review_id,
        outcomeScore,
        lesson,
      });
    }

    // Phase 3: Load operation context
    console.log('[Agent Cycle] Loading current context');
    const opCtx = await tools.getOperationContext(runId);

    // Phase 4 & 5: Self Diagnosis & Record Findings
    console.log('[Agent Cycle] Performing self-diagnosis using LLM...');
    
    // Construct LLM prompt
    const promptMessages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are Nails-Agent, an AI Operations Manager for a nail design platform. Your goal is to analyze current performance statistics and recommend operational actions (e.g. promoting styles, listing candidates, demoting poor styles).'
      },
      {
        role: 'user',
        content: `
        Analyze the following context:
        - Style Heat Metrics (recent 12h): ${JSON.stringify(opCtx.styleHeat.slice(0, 10))}
        - Tag Heat Metrics: ${JSON.stringify(opCtx.tagHeat)}
        - Candidates in Pool: ${JSON.stringify(opCtx.candidates.map(c => ({ id: c.style_id, tags: c.color_tags })))}
        - Strategy Memories: ${JSON.stringify(opCtx.memories)}

        Output a JSON object with:
        1. "findings": A list of findings, each having targetType ("style", "tag", "candidate"), targetId, findingType ("opportunity", "anomaly"), title, summary, score.
        2. "proposals": A list of proposed actions, each having proposalType ("adjust_recommendation", "list_candidate", "unlist_to_candidate"), targetType, targetIds, intendedAction, hypothesis, expectedMetrics, rollbackCondition, confidence.
        `
      }
    ];

    let decisionData: {
      findings?: OperationalFinding[];
      proposals?: tools.RecordProposalInput[];
    } = {};

    try {
      const responseText = await callLlmModel(promptMessages);
      // Attempt to parse JSON response from LLM
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        decisionData = JSON.parse(jsonMatch[0]) as typeof decisionData;
      }
    } catch (e) {
      console.warn('Failed to call LLM or parse response, falling back to rule-based diagnostics:', e);
      // Fallback rule-based diagnostics
      decisionData = runRuleBasedEngine(opCtx);
    }

    // Write findings
    if (decisionData.findings && decisionData.findings.length > 0) {
      for (const finding of decisionData.findings) {
        if (finding.findingType === 'opportunity') {
          await tools.discoverOpportunity({
            agentRunId: runId,
            targetType: finding.targetType,
            targetId: finding.targetId || undefined,
            title: finding.title,
            summary: finding.summary,
            evidence: finding.evidence || {},
            score: finding.score || undefined,
          });
        } else {
          await tools.diagnoseAnomaly({
            agentRunId: runId,
            targetType: finding.targetType as 'style' | 'tag' | 'global',
            targetId: finding.targetId || undefined,
            title: finding.title,
            summary: finding.summary,
            evidence: finding.evidence || {},
            score: finding.score || undefined,
          });
        }
      }
    } else {
      await tools.continueObservation(runId, 'No anomalous behavior detected. Overall metrics are stable.');
    }

    // Phase 6 & 7: Record and Validate Proposals
    const proposalsToExecute: string[] = [];
    if (decisionData.proposals && decisionData.proposals.length > 0) {
      for (const prop of decisionData.proposals) {
        const propRes = await tools.recordActionProposal({
          agentRunId: runId,
          proposalType: prop.proposalType,
          targetType: prop.targetType,
          targetIds: prop.targetIds,
          intendedAction: prop.intendedAction,
          hypothesis: prop.hypothesis,
          expectedMetrics: prop.expectedMetrics,
          rollbackCondition: prop.rollbackCondition,
          reviewWindowHours: prop.reviewWindowHours,
          confidence: prop.confidence,
        });

        // Validate
        const valRes = await tools.validateActionProposal(propRes.proposalId);
        if (valRes.status === 'approved') {
          proposalsToExecute.push(propRes.proposalId);
        }
      }
    }

    // Phase 8: Execute Actions
    console.log(`[Agent Cycle] Executing ${proposalsToExecute.length} approved actions`);
    for (const proposalId of proposalsToExecute) {
      // Load proposal payload
      const proposals = await tools.recordProposalInputFromDb(proposalId);
      if (!proposals) continue;

      if (proposals.proposalType === 'adjust_recommendation') {
        // Adjust recommendations (mocking new rank positions)
        const mockRanks = opCtx.styleHeat
          .sort((a, b) => b.heat_score - a.heat_score)
          .map((item, idx) => ({
            styleId: item.style_id ?? '',
            rankNo: idx + 1,
            score: item.heat_score,
            reason: `Sorted rank based on heat score of ${item.heat_score}`
          }));
        await tools.adjustRecommendation({
          agentRunId: runId,
          proposalId,
          ranks: mockRanks,
        });
      } else if (proposals.proposalType === 'list_candidate' && proposals.targetIds.length > 0) {
        const targetId = proposals.targetIds[0];
        if (targetId) {
          await tools.decideStyleStatus({
            agentRunId: runId,
            proposalId,
            styleId: targetId,
            newStatus: 'listed',
          });
        }
      } else if (proposals.proposalType === 'unlist_to_candidate' && proposals.targetIds.length > 0) {
        const targetId = proposals.targetIds[0];
        if (targetId) {
          await tools.decideStyleStatus({
            agentRunId: runId,
            proposalId,
            styleId: targetId,
            newStatus: 'candidate',
          });
        }
      }
    }

    // Phase 10: Complete Run
    const summaryMsg = `Successfully processed rollup metrics. Found ${decisionData.findings?.length || 0} items to report. Executed ${proposalsToExecute.length} operational actions.`;
    await tools.completeAgentRun({
      agentRunId: runId,
      chatSummary: summaryMsg,
      success: true,
    });

    console.log(`[Agent Cycle] Completed run ${runId}`);
    return { runId, success: true, summary: summaryMsg };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Agent Cycle] Error in run ${runId}:`, err);
    await tools.completeAgentRun({
      agentRunId: runId,
      chatSummary: 'Operation cycle failed due to unexpected error.',
      success: false,
      errorMessage: err.message || String(error),
    });
    throw error;
  }
}

// Simple deterministic rule-based engine fallback
function runRuleBasedEngine(opCtx: OperationContext) {
  const findings: OperationalFinding[] = [];
  const proposals: tools.RecordProposalInput[] = [];

  // Find popular styles to promote
  const highHeatStyles = opCtx.styleHeat
    .sort((a, b) => b.heat_score - a.heat_score)
    .slice(0, 2);

  for (const style of highHeatStyles) {
    if (style.heat_score > 10 && style.style_id) {
      findings.push({
        findingType: 'opportunity',
        targetType: 'style',
        targetId: style.style_id,
        title: 'High Heat Style Opportunity',
        summary: `Style ${style.style_id} has a high heat score of ${style.heat_score} in recent events.`,
        evidence: { heatScore: style.heat_score },
        score: 0.9,
      });

      proposals.push({
        agentRunId: '',
        proposalType: 'adjust_recommendation',
        targetType: 'style',
        targetIds: [style.style_id],
        intendedAction: 'Promote style rank',
        hypothesis: 'Promoting this style will increase conversion rate.',
        expectedMetrics: [{ metric: 'conversion_score', target: 0.1 }],
        rollbackCondition: 'If click-through rate drops below baseline.',
        confidence: 0.8,
      });
    }
  }

  // Find candidate to list matching tag trend
  const topTag = opCtx.tagHeat.sort((a, b) => b.heat_score - a.heat_score)[0];
  if (topTag && topTag.heat_score > 5) {
    const matchingCandidate = opCtx.candidates.find((c) => {
      const tags: string[] = c.color_tags ? JSON.parse(c.color_tags) as string[] : [];
      return tags.includes(topTag.tag_value);
    });

    if (matchingCandidate) {
      findings.push({
        findingType: 'opportunity',
        targetType: 'candidate',
        targetId: matchingCandidate.style_id,
        title: 'Candidate Listing Opportunity',
        summary: `Candidate ${matchingCandidate.style_id} matches top popular tag ${topTag.tag_value}.`,
        evidence: { tag: topTag.tag_value, tagScore: topTag.heat_score },
        score: 0.85,
      });

      proposals.push({
        agentRunId: '',
        proposalType: 'list_candidate',
        targetType: 'candidate',
        targetIds: [matchingCandidate.style_id],
        intendedAction: 'List candidate style to catalog',
        hypothesis: 'Listing matching style will align with popular tag trend.',
        expectedMetrics: [{ metric: 'view_count', target: 50 }],
        rollbackCondition: 'If conversion rate is 0 after 24h.',
        confidence: 0.9,
      });
    }
  }

  return { findings, proposals };
}

