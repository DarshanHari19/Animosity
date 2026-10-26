import { z } from "zod";
import traits from "./traits.json";
import { AnimalSchema } from "./schemas";

// Records come from user-provided profiles and citations. Verify each value
// and source before treating it as authoritative.
export const animals = z.array(AnimalSchema).length(12).refine(
  (items) => new Set(items.map((animal) => animal.name)).size === items.length,
  "Animal names must be unique.",
).parse(traits);
