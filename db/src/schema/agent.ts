import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { nailStyles } from './styles.ts';

// data-model §8.1 agent_runs
export const agentRuns = sqliteTable('agent_runs', {
  agent_run_id: text('agent_run_id').primaryKey(),
  trigger_type: text('trigger_type').notNull(),
  status: text('status').notNull(),
  is_warmup_run: integer('is_warmup_run', { mode: 'boolean' }).notNull().default(false),
  input_summary: text('input_summary').notNull().default('{}'),
  output_summary: text('output_summary').notNull().default('{}'),
  chat_summary: text('chat_summary'),
  error_message: text('error_message'),
  started_at: text('started_at').notNull(),
  completed_at: text('completed_at'),
});

// data-model §8.2 agent_findings
export const agentFindings = sqliteTable('agent_findings', {
  finding_id: text('finding_id').primaryKey(),
  agent_run_id: text('agent_run_id').notNull().references(() => agentRuns.agent_run_id),
  finding_type: text('finding_type').notNull(),
  target_type: text('target_type').notNull(),
  target_id: text('target_id'),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  evidence: text('evidence').notNull().default('{}'),
  score: real('score'),
  created_at: text('created_at').notNull(),
});

// data-model §8.3 agent_decisions
export const agentDecisions = sqliteTable('agent_decisions', {
  decision_id: text('decision_id').primaryKey(),
  agent_run_id: text('agent_run_id').notNull().references(() => agentRuns.agent_run_id),
  action_type: text('action_type').notNull(),
  target_type: text('target_type').notNull(),
  target_id: text('target_id'),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  status: text('status').notNull(),
  execution_result: text('execution_result').notNull().default('{}'),
  requires_review: integer('requires_review', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull(),
  executed_at: text('executed_at'),
});

// data-model §8.4 agent_decision_items
export const agentDecisionItems = sqliteTable('agent_decision_items', {
  decision_item_id: text('decision_item_id').primaryKey(),
  decision_id: text('decision_id').notNull().references(() => agentDecisions.decision_id),
  style_id: text('style_id').references(() => nailStyles.style_id),
  item_action_type: text('item_action_type').notNull(),
  from_status: text('from_status'),
  to_status: text('to_status'),
  rank_before: integer('rank_before'),
  rank_after: integer('rank_after'),
  metrics_before: text('metrics_before').notNull().default('{}'),
  reason: text('reason').notNull(),
  created_at: text('created_at').notNull(),
});

// data-model §8.5 agent_evidence_links
export const agentEvidenceLinks = sqliteTable('agent_evidence_links', {
  evidence_link_id: text('evidence_link_id').primaryKey(),
  decision_id: text('decision_id').notNull().references(() => agentDecisions.decision_id),
  source_type: text('source_type').notNull(),
  source_id: text('source_id').notNull(),
  role: text('role').notNull(),
  note: text('note'),
  created_at: text('created_at').notNull(),
});

// data-model §8.6 agent_pending_reviews
export const agentPendingReviews = sqliteTable('agent_pending_reviews', {
  pending_review_id: text('pending_review_id').primaryKey(),
  decision_id: text('decision_id').notNull().references(() => agentDecisions.decision_id),
  style_id: text('style_id').references(() => nailStyles.style_id),
  review_type: text('review_type').notNull(),
  status: text('status').notNull(),
  before_metrics: text('before_metrics').notNull().default('{}'),
  expected_effect: text('expected_effect'),
  review_window_start: text('review_window_start').notNull(),
  review_window_end: text('review_window_end').notNull(),
  result_metrics: text('result_metrics'),
  result_summary: text('result_summary'),
  memory_id: text('memory_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

// data-model §8.7 strategy_memories
export const strategyMemories = sqliteTable('strategy_memories', {
  memory_id: text('memory_id').primaryKey(),
  memory_type: text('memory_type').notNull(),
  source_pending_review_id: text('source_pending_review_id'),
  source_decision_id: text('source_decision_id'),
  tag_signature: text('tag_signature'),
  style_id: text('style_id'),
  action_type: text('action_type').notNull(),
  before_metrics: text('before_metrics').notNull().default('{}'),
  after_metrics: text('after_metrics').notNull().default('{}'),
  outcome_score: real('outcome_score').notNull(),
  lesson: text('lesson').notNull(),
  created_at: text('created_at').notNull(),
});

// data-model §8.8 agent_chat_sessions
export const agentChatSessions = sqliteTable('agent_chat_sessions', {
  chat_session_id: text('chat_session_id').primaryKey(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

// data-model §8.9 agent_chat_messages
export const agentChatMessages = sqliteTable('agent_chat_messages', {
  message_id: text('message_id').primaryKey(),
  chat_session_id: text('chat_session_id').notNull().references(() => agentChatSessions.chat_session_id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  related_run_ids: text('related_run_ids').notNull().default('[]'),
  related_finding_ids: text('related_finding_ids').notNull().default('[]'),
  related_decision_ids: text('related_decision_ids').notNull().default('[]'),
  related_memory_ids: text('related_memory_ids').notNull().default('[]'),
  created_at: text('created_at').notNull(),
});

// agent-cycle §15.1 agent_action_proposals
export const agentActionProposals = sqliteTable('agent_action_proposals', {
  proposal_id: text('proposal_id').primaryKey(),
  agent_run_id: text('agent_run_id').notNull().references(() => agentRuns.agent_run_id),
  proposal_type: text('proposal_type').notNull(), // adjust_recommendation | list_candidate | unlist_to_candidate | start_experiment | no_action
  target_type: text('target_type').notNull(), // style | candidate | tag | tag_combo | global
  target_ids: text('target_ids').notNull().default('[]'), // JSON array string
  intended_action: text('intended_action').notNull(),
  hypothesis: text('hypothesis').notNull(),
  expected_metrics: text('expected_metrics').notNull().default('[]'), // JSON array string
  rollback_condition: text('rollback_condition').notNull(),
  review_window_hours: integer('review_window_hours'),
  confidence: real('confidence'),
  status: text('status').notNull(), // pending_check | approved | rejected | executed | skipped
  check_result: text('check_result'), // JSON object string
  execution_tool: text('execution_tool'),
  execution_payload: text('execution_payload'), // JSON object string
  decision_id: text('decision_id').references(() => agentDecisions.decision_id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});


