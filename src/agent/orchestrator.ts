import * as tools from './tools';
import { callLlmModel, ChatMessage } from '../services/llm';
import { executeAgentToolCalls, parseAgentToolCallPlanResponse } from './agentToolRegistry';
import { evaluateReviewOutcome } from './reviewEvaluator';

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

        TOP STYLE HEAT (top 3):
        ${JSON.stringify(opCtx.styleHeat
          .sort((a: typeof opCtx.styleHeat[number], b: typeof opCtx.styleHeat[number]) => (b.heat_score ?? 0) - (a.heat_score ?? 0))
          .slice(0, 3)
          .map((s: typeof opCtx.styleHeat[number]) => ({ id: s.style_id, heat: s.heat_score, growth: s.growth_score, conv: s.conversion_score })))}

        TAG HEAT (top 3):
        ${JSON.stringify(opCtx.tagHeat
          .sort((a: typeof opCtx.tagHeat[number], b: typeof opCtx.tagHeat[number]) => (b.heat_score ?? 0) - (a.heat_score ?? 0))
          .slice(0, 3)
          .map((t: typeof opCtx.tagHeat[number]) => ({ tag: t.tag_type + ':' + t.tag_value, heat: t.heat_score, growth: t.growth_score })))}

        ACTIVE RECOMMENDATIONS (top 8):
        ${JSON.stringify((opCtx.activeRecommendationItems || []).slice(0, 8).map((r: typeof opCtx.activeRecommendationItems[number]) => ({ id: r.item.style_id, rank: r.item.rank_no })))}

        RISING TAG TRENDS (top 2):
        ${JSON.stringify({ trends: opCtx.tagTrendActions.trends.slice(0, 2), actions: opCtx.tagTrendActions.actions.slice(0, 2).map((a: typeof opCtx.tagTrendActions.actions[number]) => ({ styleId: a.styleId, score: a.finalScore })) })}

        STRATEGY MEMORIES (top 2):
        ${JSON.stringify(opCtx.memories.slice(0, 2).map((m: typeof opCtx.memories[number]) => ({ type: m.action_type, score: m.outcome_score, lesson: m.lesson.slice(0, 100) })))}

        Output JSON format:
        {
          "toolCalls": [
            { "toolName": "discoverOpportunity", "arguments": { "targetType": "style, tag, candidate, or global", "targetId": "string", "title": { "en": "string", "zh": "string" }, "summary": { "en": "string", "zh": "string" }, "score": number } },
            { "toolName": "diagnoseAnomaly", "arguments": { "targetType": "style, tag, or global", "targetId": "string", "title": { "en": "string", "zh": "string" }, "summary": { "en": "string", "zh": "string" }, "score": number } },
            { "toolName": "continueObservation", "arguments": { "note": "string" } },
            { "toolName": "recordActionProposal", "arguments": { "proposalType": "adjust_recommendation, list_candidate, or unlist_to_candidate", "targetType": "style or candidate", "targetIds": ["string"], "recommendationChanges": [{ "styleId": "string", "action": "promote or demote", "targetRank": number, "maxDelta": number, "reason": { "en": "string", "zh": "string" } }], "intendedAction": { "en": "string", "zh": "string" }, "hypothesis": { "en": "string", "zh": "string" }, "expectedMetrics": [{ "metric": "tryon_count, favorite_count, or conversion_score", "direction": "increase, decrease, or maintain", "minDelta": number }], "rollbackCondition": { "en": "string", "zh": "string" }, "reviewWindowHours": number, "confidence": number } }
          ]
        }

        Rules:
        - score/confidence must be 0.0 to 1.0.
        - Call at least one finding tool: discoverOpportunity, diagnoseAnomaly, or continueObservation.
        - Only recordActionProposal creates proposals (targetType must be "style" or "candidate").
        - Never call execution tools (e.g. adjustRecommendation, decideStyleStatus, writeStrategyMemory, etc.).
        - If a tag trend has no matched styles, call discoverOpportunity only; do not create proposal.
        `
      }
    ];

    let findingIds: string[] = [];
    let proposalIds: string[] = [];
    let observationNote = 'No anomalous behavior detected. Overall metrics are stable.';

    try {
      const responseText = await callLlmModel(promptMessages);
      console.log(`[Agent Cycle] LLM Response Content:\n${responseText}`);
      const toolCallPlan = parseAgentToolCallPlanResponse(responseText);
      const toolExecution = await executeAgentToolCalls(toolCallPlan.toolCalls, runId);
      findingIds = toolExecution.findingIds;
      proposalIds = toolExecution.proposalIds;
    } catch (e) {
      console.error('[Agent Cycle] Failed to call LLM or validate agent tool calls:', e);
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
