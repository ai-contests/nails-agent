import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { nailStyles } from './styles';

// data-model §7.1 recommendation_snapshots
export const recommendationSnapshots = sqliteTable(
  'recommendation_snapshots',
  {
    snapshot_id: text('snapshot_id').primaryKey(),
    snapshot_type: text('snapshot_type').notNull(), // global_main | similar_hand
    session_id: text('session_id'),
    generated_by: text('generated_by').notNull(), // system | agent
    agent_run_id: text('agent_run_id'),
    status: text('status').notNull(), // building | active | archived
    activated_at: text('activated_at'),
    expires_at: text('expires_at'),
    created_at: text('created_at').notNull(),
  },
  t => ({
    idxTypeStatus: index('idx_reco_snapshots_type_status').on(t.snapshot_type, t.status),
    idxSession: index('idx_reco_snapshots_session_id').on(t.session_id),
  }),
);

// data-model §7.2 recommendation_items
export const recommendationItems = sqliteTable(
  'recommendation_items',
  {
    item_id: text('item_id').primaryKey(),
    snapshot_id: text('snapshot_id').notNull().references(() => recommendationSnapshots.snapshot_id),
    style_id: text('style_id').notNull().references(() => nailStyles.style_id),
    rank_no: integer('rank_no').notNull(),
    score: real('score').notNull(),
    reason: text('reason').notNull().default(''),
    score_detail: text('score_detail').notNull().default('{}'),
  },
  t => ({
    idxSnapshotRank: index('idx_reco_items_snapshot_rank').on(t.snapshot_id, t.rank_no),
    idxStyle: index('idx_reco_items_style_id').on(t.style_id),
  }),
);
