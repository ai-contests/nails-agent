import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';

// data-model §5.1 user_sessions
export const userSessions = sqliteTable(
  'user_sessions',
  {
    session_id: text('session_id').primaryKey(),
    client_id: text('client_id'),
    status: text('status').notNull(), // active | closed
    current_hand_image_id: text('current_hand_image_id'),
    created_at: text('created_at').notNull(),
    closed_at: text('closed_at'),
  },
  t => ({
    idxClient: index('idx_user_sessions_client_id').on(t.client_id),
    idxCreated: index('idx_user_sessions_created_at').on(t.created_at),
  }),
);

// data-model §5.2 user_hand_images
export const userHandImages = sqliteTable('user_hand_images', {
  hand_image_id: text('hand_image_id').primaryKey(),
  session_id: text('session_id').notNull().references(() => userSessions.session_id),
  image_url: text('image_url').notNull(),
  created_at: text('created_at').notNull(),
});

// data-model §5.3 user_hand_profiles
export const userHandProfiles = sqliteTable(
  'user_hand_profiles',
  {
    hand_profile_id: text('hand_profile_id').primaryKey(),
    session_id: text('session_id').notNull().references(() => userSessions.session_id),
    hand_image_id: text('hand_image_id').notNull().references(() => userHandImages.hand_image_id),
    hand_shape: text('hand_shape').notNull(), // slender_long | short_wide | square_palm | narrow_palm | unknown
    hand_shape_confidence: real('hand_shape_confidence'),
    skin_tone: text('skin_tone').notNull(),
    skin_tone_confidence: real('skin_tone_confidence'),
    skin_rgb: text('skin_rgb'),
    raw_metrics: text('raw_metrics').notNull().default('{}'),
    created_at: text('created_at').notNull(),
  },
  t => ({
    idxSession: index('idx_user_hand_profiles_session_id').on(t.session_id),
    idxShape: index('idx_user_hand_profiles_hand_shape').on(t.hand_shape),
    idxTone: index('idx_user_hand_profiles_skin_tone').on(t.skin_tone),
  }),
);
