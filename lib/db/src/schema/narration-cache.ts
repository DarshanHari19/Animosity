import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const narrationCacheTable = pgTable("narration_cache", {
  key: text("key").primaryKey(),
  buildId: text("build_id").notNull(),
  beats: jsonb("beats").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertNarrationCacheSchema = createInsertSchema(narrationCacheTable).omit({ createdAt: true });
export type InsertNarrationCache = z.infer<typeof insertNarrationCacheSchema>;
export type NarrationCacheRow = typeof narrationCacheTable.$inferSelect;
