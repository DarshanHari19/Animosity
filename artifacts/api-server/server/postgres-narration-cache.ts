import { db, narrationCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NarrationCache } from "./narration-cache";

/** Schema is applied in development by Drizzle, and in production by Publish. No startup DDL. */
export const postgresNarrationCache: NarrationCache = {
  async get(key) {
    const [row] = await db.select({ beats: narrationCacheTable.beats })
      .from(narrationCacheTable).where(eq(narrationCacheTable.key, key)).limit(1);
    return row?.beats ?? null;
  },
  async put(key, buildId, beats) {
    // The first validated narration wins; never replace it with a later generation.
    await db.insert(narrationCacheTable).values({ key, buildId, beats }).onConflictDoNothing();
  },
};
