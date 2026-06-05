import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { nailStyles } from './styles';

// data-model §7.3 style_heat_snapshots
export const styleHeatSnapshots = sqliteTable(
  'style_heat_snapshots',
  {
    heat_snapshot_id: text('heat_snapshot_id').primaryKey(),
    agent_run_id: text('agent_run_id'),
    style_id: text('style_id').notNull().references(() => nailStyles.style_id),
    window_start: text('window_start').notNull(),
    window_end: text('window_end').notNull(),
    view_count: integer('view_count').notNull().default(0),
    click_count: integer('click_count').notNull().default(0),
    tryon_count: integer('tryon_count').notNull().default(0),
    favorite_count: integer('favorite_count').notNull().default(0),
    heat_score: real('heat_score').notNull().default(0),
    growth_score: real('growth_score').notNull().default(0),
    conversion_score: real('conversion_score').notNull().default(0),
    created_at: text('created_at').notNull(),
  },
  t => ({
    idxRunWindow: index('idx_style_heat_run_window').on(t.agent_run_id, t.window_end),
    idxStyleWindow: index('idx_style_heat_style_window').on(t.style_id, t.window_end),
  }),
);

// data-model §7.4 tag_heat_snapshots
export const tagHeatSnapshots = sqliteTable(
  'tag_heat_snapshots',
  {
    tag_snapshot_id: text('tag_snapshot_id').primaryKey(),
    agent_run_id: text('agent_run_id'),
    tag_type: text('tag_type').notNull(), // color | length
    tag_value: text('tag_value').notNull(),
    window_start: text('window_start').notNull(),
    window_end: text('window_end').notNull(),
    style_count: integer('style_count').notNull().default(0),
    view_count: integer('view_count').notNull().default(0),
    click_count: integer('click_count').notNull().default(0),
    tryon_count: integer('tryon_count').notNull().default(0),
    favorite_count: integer('favorite_count').notNull().default(0),
    heat_score: real('heat_score').notNull().default(0),
    growth_score: real('growth_score').notNull().default(0),
    conversion_score: real('conversion_score').notNull().default(0),
    created_at: text('created_at').notNull(),
  },
  t => ({
    idxRunWindow: index('idx_tag_heat_run_window').on(t.agent_run_id, t.window_end),
    idxTypeValue: index('idx_tag_heat_type_value').on(t.tag_type, t.tag_value),
    idxWindow: index('idx_tag_heat_window').on(t.window_end),
  }),
);
