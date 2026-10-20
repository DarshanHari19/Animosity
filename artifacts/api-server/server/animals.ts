import { z } from "zod";
import traits from "./traits.json";
import { AnimalSchema } from "./schemas";

// ALL zero numbers are unknown placeholders, NOT scientific measurements.
// Empty sources mean these records (including categories) are not verified.
// Edit traits.json, cite reliable sources, and restart the backend.
export const animals = z.array(AnimalSchema).length(6).refine(
  (items) => new Set(items.map((animal) => animal.name)).size === items.length,
  "Animal names must be unique.",
).parse(traits);
