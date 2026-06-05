import * as tools from './tools.js';
import { callLlmModel, ChatMessage } from '../services/llm.js';
import { executeAgentToolCalls, parseAgentToolCallPlanResponse } from './agentToolRegistry.js';
import { evaluateReviewOutcome } from './reviewEvaluator.js';

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

    // Phase 2: Review due pending items — uses real after_metrics computed from behavior_events.
    console.log('[Agent Cycle] Reviewing past pending actions');
    const reviewCtx = await tools.getDueReviewContext(runId);
    for (const review of reviewCtx.pendingReviews) {
      const { beforeMetrics, afterMetrics, expectedMetrics } = review.parsed;
      const outcome = evaluateReviewOutcome(expectedMetrics, beforeMetrics, afterMetrics);

      await tools.writeStrategyMemory({
        pendingReviewId: review.pending_review_id,
        outcome: outcome.outcome,
        outcomeScore: outcome.outcomeScore,
        beforeMetrics,
        afterMetrics,
        metricDelta: outcome.metricDelta,
        evaluations: outcome.evaluations,
        lesson: outcome.lesson,
      });
    }

    // Phase 3: Load operation context
    console.log('[Agent Cycle] Loading current context');
    const opCtx = await tools.getOperationContext(runId, 5);

    // Phase 4 & 5: Self Diagnosis & Record Findings
    console.log('[Agent Cycle] Performing self-diagnosis using LLM...');
    
    // Construct LLM prompt
    const promptMessages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are Nails-Agent, an AI Operations Manager for a nail design platform. Return strict JSON only. The top-level object must contain only a "toolCalls" array. Use camelCase keys only.'
      },
      {
        role: 'user',
        content: `
        Analyze the following nail platform data:

        TOP STYLE HEAT (top 8, recent 12h):
        ${JSON.stringify(opCtx.styleHeat
          .sort((a, b) => (b.heat_score ?? 0) - (a.heat_score ?? 0))
          .slice(0, 8)
          .map(s => ({ id: s.style_id, heat: s.heat_score, growth: s.growth_score, conv: s.conversion_score })))}

        TAG HEAT:
        ${JSON.stringify(opCtx.tagHeat.map(t => ({ tag: t.tag_type + ':' + t.tag_value, heat: t.heat_score, growth: t.growth_score })))}

        ACTIVE RECOMMENDATIONS (top 10 ranks):
        ${JSON.stringify((opCtx.activeRecommendationItems || []).slice(0, 10).map(r => ({ id: r.item.style_id, rank: r.item.rank_no })))}

        RISING TAG TRENDS + PRE-MATCHED CANDIDATES (use these for list_candidate proposals):
        ${JSON.stringify({ trends: opCtx.tagTrendActions.trends.slice(0, 3), actions: opCtx.tagTrendActions.actions.slice(0, 3).map(a => ({ styleId: a.styleId, reason: a.reason, score: a.finalScore })) })}

        STRATEGY MEMORIES (recent lessons):
        ${JSON.stringify(opCtx.memories.slice(0, 5).map(m => ({ type: m.action_type, score: m.outcome_score, lesson: m.lesson.slice(0, 120) })))}

        Output exactly one JSON object:
        {
          "toolCalls": [
            {
              "toolName": "discoverOpportunity",
              "arguments": {
                "targetType": "style" | "tag" | "candidate" | "global",
                "targetId": "string",
                "title": "string",
                "summary": "string",
                "score": 0.0
              }
            },
            {
              "toolName": "diagnoseAnomaly",
              "arguments": {
                "targetType": "style" | "tag" | "global",
                "targetId": "string",
                "title": "string",
                "summary": "string",
                "score": 0.0
              }
            },
            {
              "toolName": "continueObservation",
              "arguments": {
                "note": "string"
              }
            },
            {
              "toolName": "recordActionProposal",
              "arguments": {
                "proposalType": "adjust_recommendation" | "list_candidate" | "unlist_to_candidate",
                "targetType": "style" | "candidate",
                "targetIds": ["string"],
                "intendedAction": "string",
                "hypothesis": "string",
                "expectedMetrics": [{ "metric": "tryon_count" | "favorite_count" | "conversion_score", "direction": "increase" | "decrease" | "maintain", "minDelta": 0.0 }],
                "rollbackCondition": "string",
                "reviewWindowHours": 12,
                "confidence": 0.0
              }
            }
          ]
        }

        Rules:
        - score and confidence must be numbers from 0 to 1.
        - Call at least one finding tool: discoverOpportunity, diagnoseAnomaly, or continueObservation.
        - You may record tag trends with discoverOpportunity or diagnoseAnomaly.
        - Only recordActionProposal creates proposals. Its targetType must be executable "style" or "candidate" only.
        - Do not call execution tools. You are not allowed to call adjustRecommendation, decideStyleStatus, writeStrategyMemory, validateActionProposal, or completeAgentRun.
        - If a tag trend is useful but not mapped to concrete styles yet, call discoverOpportunity only and do not create a proposal.
        `
      }
    ];

    let findingIds: string[] = [];
    let proposalIds: string[] = [];
    let observationNote = 'No anomalous behavior detected. Overall metrics are stable.';

    try {
      const responseText = await callLlmModel(promptMessages);
      const toolCallPlan = parseAgentToolCallPlanResponse(responseText);
      const toolExecution = await executeAgentToolCalls(toolCallPlan.toolCalls, runId);
      findingIds = toolExecution.findingIds;
      proposalIds = toolExecution.proposalIds;
    } catch (e) {
      console.warn('Failed to call LLM or validate agent tool calls; no operational actions will be executed:', e);
      observationNote = 'LLM tool call plan was unavailable or failed schema validation. No operational action executed this run.';
    }

    if (findingIds.length === 0) {
      await tools.continueObservation(runId, observationNote);
    }

    // Phase 6 & 7: Record and Validate Proposals
    const proposalsToExecute: string[] = [];
    if (proposalIds.length > 0) {
      for (const proposalId of proposalIds) {
        const valRes = await tools.validateActionProposal(proposalId);
        if (valRes.status === 'approved' && valRes.executionTool) {
          proposalsToExecute.push(proposalId);
        }
      }
    }

    // Phase 8: Execute Actions
    console.log(`[Agent Cycle] Executing ${proposalsToExecute.length} approved actions`);
    const heatRanks = [...opCtx.styleHeat]
      .sort((a, b) => b.heat_score - a.heat_score)
      .filter(item => !!item.style_id)
      .map((item, idx) => ({
        styleId: item.style_id as string,
        rankNo: idx + 1,
        score: item.heat_score,
        reason: `Sorted rank based on heat score of ${item.heat_score}`,
      }));
    const executionResult = await tools.executeApprovedProposalBatch({
      agentRunId: runId,
      proposalIds: proposalsToExecute,
      heatRanks,
    });

    // Phase 10: Complete Run
    const summaryMsg = `Successfully processed rollup metrics. Found ${findingIds.length} items to report. Executed ${executionResult.executedCount} operational actions.`;
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
