import { animals } from "../animals";
import type { Animal } from "../schemas";

// Deprecated pre-upgrade inputs retained ONLY to replay recorded narration
// regressions. These are NOT current measurements, selectable data or scoring
// expectations. Keeping the original inputs preserves numeric-citation checks.
const oldMasses = [190, 270, 450, 180, 1500, 750, 2300];
const oldBites = [5500, null, 16400, null, null, null, null];
const oldBiteTiers = [2, null, 1, null, null, null, null] as const;
export const historicalAnimals: Animal[] = animals.map((animal, index) => ({
  ...animal,
  mass_kg: oldMasses[index]!,
  bite_force_n: oldBites[index]!,
  bite_point: oldBites[index] === null ? null : animal.bite_point,
  field_sources: {
    ...animal.field_sources,
    mass_kg: { ...animal.field_sources.mass_kg!, tier: 3 },
    bite_force_n: { ...animal.field_sources.bite_force_n!, tier: oldBiteTiers[index]! },
  },
}));
