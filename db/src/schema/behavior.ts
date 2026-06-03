import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { nailStyles } from './styles.ts';
import { userSessions } from './sessions.ts';

// data-model §6.1 behavior_events
export const behaviorEvents = sqliteTable(
  'behavior_events',
  {
    event_id: text('event_id').primaryKey(),
    session_id: text('session_id'),
    style_id: text('style_id').notNull().references(() => nailStyles.style_id),
    event_type: text('event_type').notNull(),
    source_page: text('source_page').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    created_at: text('created_at').notNull(),
  },
  t => ({
    idxStyle: index('idx_behavior_events_style_id').on(t.style_id),
    idxSession: index('idx_behavior_events_session_id').on(t.session_id),
    idxType: index('idx_behavior_events_event_type').on(t.event_type),
    idxCreated: index('idx_behavior_events_created_at').on(t.created_at),
  }),
);

// data-model §6.2 session_favorites
export const sessionFavorites = sqliteTable(
  'session_favorites',
  {
    session_id: text('session_id').notNull().references(() => userSessions.session_id),
    style_id: text('style_id').notNull().references(() => nailStyles.style_id),
    is_active: integer('is_active', { mode: 'boolean' }).notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  t => ({ pk: primaryKey({ columns: [t.session_id, t.style_id] }) }),
);

// data-model §6.3 tryon_jobs
export const tryonJobs = sqliteTable(
  'tryon_jobs',
  {
    tryon_job_id: text('tryon_job_id').primaryKey(),
    session_id: text('session_id').notNull().references(() => userSessions.session_id),
    style_id: text('style_id').notNull().references(() => nailStyles.style_id),
    hand_image_id: text('hand_image_id').notNull(),
    status: text('status').notNull(),
    input_hand_image_url: text('input_hand_image_url').notNull(),
    style_image_url: text('style_image_url').notNull(),
    result_image_url: text('result_image_url'),
    error_message: text('error_message'),
    comfyui_workflow_id: text('comfyui_workflow_id'),
    created_at: text('created_at').notNull(),
    started_at: text('started_at'),
    finished_at: text('finished_at'),
  },
  t => ({
    idxSession: index('idx_tryon_jobs_session_id').on(t.session_id),
    idxStyle: index('idx_tryon_jobs_style_id').on(t.style_id),
    idxStatus: index('idx_tryon_jobs_status').on(t.status),
  }),
);
