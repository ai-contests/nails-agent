import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// data-model §4.1 nail_styles
export const nailStyles = sqliteTable(
  'nail_styles',
  {
    style_id: text('style_id').primaryKey(),
    source_type: text('source_type'), // internal_seed | agent_listed | null
    status: text('status').notNull(), // listed | candidate
    image_url: text('image_url').notNull(),
    enhanced_image_url: text('enhanced_image_url'),
    color_tags: text('color_tags').notNull().default('[]'), // JSON array string
    length_tags: text('length_tags').notNull().default('[]'),
    visual_feature_id: text('visual_feature_id'),
    is_available_for_tryon: integer('is_available_for_tryon', { mode: 'boolean' }).notNull().default(true),
    listed_at: text('listed_at'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  t => ({
    idxStatus: index('idx_nail_styles_status').on(t.status),
    idxSource: index('idx_nail_styles_source_type').on(t.source_type),
    idxListedAt: index('idx_nail_styles_listed_at').on(t.listed_at),
  }),
);

// data-model §4.2 nail_visual_features
export const nailVisualFeatures = sqliteTable(
  'nail_visual_features',
  {
    visual_feature_id: text('visual_feature_id').primaryKey(),
    style_id: text('style_id').notNull().references(() => nailStyles.style_id),
    primary_color_family: text('primary_color_family').notNull(),
    primary_color_name: text('primary_color_name').notNull(),
    primary_color_rgb: text('primary_color_rgb').notNull(), // JSON [r,g,b]
    dominant_palette: text('dominant_palette').notNull(), // JSON [[r,g,b], ...]
    color_confidence: real('color_confidence'),
    secondary_color_family: text('secondary_color_family'),
    secondary_color_name: text('secondary_color_name'),
    secondary_color_rgb: text('secondary_color_rgb'), // JSON [r,g,b] or null
    secondary_color_confidence: real('secondary_color_confidence'),
    nail_crop_url: text('nail_crop_url'),
    length_tag: text('length_tag').notNull(), // short | medium | long | unknown
    length_ratio: real('length_ratio'),
    length_confidence: real('length_confidence'),
    extractor_version: text('extractor_version').notNull(),
    raw_features: text('raw_features').notNull().default('{}'),
    created_at: text('created_at').notNull(),
  },
  t => ({
    idxStyle: index('idx_visual_features_style_id').on(t.style_id),
    idxColor: index('idx_visual_features_primary_color_family').on(t.primary_color_family),
    idxLength: index('idx_visual_features_length_tag').on(t.length_tag),
  }),
);
