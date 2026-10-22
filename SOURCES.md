# Animosity: Data Sources

How Animosity decides what counts as a fact. Every trait in `traits.json` carries a source tier, and the engine's confidence drops when key numbers come from lower tiers.

## Source tiers

| Tier | What it means | Engine treatment |
|---|---|---|
| 1 | Measured on real animals, peer-reviewed | Full weight |
| 2 | Modeled or estimated in peer-reviewed research | Full weight, lowers confidence slightly |
| 3 | Reference summary (Wikipedia, ADW), not yet traced to a paper | Lowers confidence; replace when possible |
| null | No reliable source found | Trait ignored; confidence drops; shown as "unknown" |

Never used as a source: YouTube compilations, fight forums, "who would win" wikis, AI model knowledge. Those are where the misconceptions come from.

## Tier 1: measured

**Erickson et al. (2012), crocodilian bite force.** PLoS ONE 7(3): e31781. doi:10.1371/journal.pone.0031781
- Directly measured adult bite forces in all 23 living crocodilian species (83 animals, force meter between the back teeth).
- Top value: a roughly 17-foot saltwater crocodile at about 16,400 N (about 3,700 pounds of force). Highest bite force ever directly measured in a living animal.
- Finding worth using in the engine: body size explains nearly all the variation in crocodilian bite force.

**PanTHERIA (Jones et al. 2009), mammal traits.** Ecology 90:2648. doi:10.1890/08-1494.1
- Species-level data set for all known extant mammals, compiled from the literature: body mass, head-body length, diet, activity cycle, habitat layer, and more.
- Use for: mass and length of mammals. Mammals only (no sharks or crocodiles).

**AnimalTraits (Herberstein et al. 2022), body mass.** Scientific Data. doi:10.1038/s41597-022-01364-9. Site: animaltraits.org
- Curated body mass (plus metabolic rate and brain size) for about 2,000 terrestrial species, each value traced to its original publication with sample sizes.
- Use for: body mass where a sourced, raw measurement matters. Terrestrial only.

**Seryodkin, Miquelle et al., tiger and bear interactions.** Studies from the Sikhote-Alin Reserve, Russian Far East, 1992 to 2013 (WCS publications PUB15720, 2015, and PUB24505, Biology Bulletin 2018).
- Bears used 62 of 353 tiger kills found in the non-denning season; in at least 8 cases bears displaced tigers from a kill. 44 recorded tiger and bear encounters.
- Why it matters: this is outcome data, not stats. Real encounter records beat trait math and should override it when they exist.

## Tier 2: modeled or estimated

**Wroe et al. (2008), great white shark bite force.** Journal of Zoology 276(4): 336 to 342. doi:10.1111/j.1469-7998.2008.00494.x
- Finite element model of a CT-scanned 2.4 m male shark's skull, scaled up. Roughly 0.3 tonnes of force for a 2.5 m, 240 kg shark; up to about 1.8 tonnes (about 18,000 N) for the largest animals around 6.5 m.
- Not measured in a live shark. Flag as modeled. Size matters a lot here, so match the estimate to the profile's length.

**Wroe, McHenry & Thomason (2005), "Bite club."** Proceedings of the Royal Society B. doi:10.1098/rspb.2004.2986
- First predictions of bite force across many living and fossil mammalian predators, plus the bite force quotient (bite force adjusted for body mass).
- Use for: mammal predator bite forces (lion, big cats, bears). Pair with Christiansen & Wroe (2007), Ecology, which expanded the sample.

**Hirt et al. (2017), top speed from body mass.** Nature Ecology & Evolution 1: 1116 to 1122. doi:10.1038/s41559-017-0241-4
- Model predicting maximum speed from body mass alone, tested on 474 species; the authors report close to 90 percent accuracy.
- Use for: a fallback speed when no measured value exists, and a sanity check on popular speed claims.

## Tier 3: reference summaries

**Animal Diversity Web (University of Michigan).** animaldiversity.org
- Species accounts covering behavior, hunting style, habitat, and natural history.
- Caution: accounts are written by students and reviewed by instructors; ADW itself says it cannot guarantee their accuracy. Use for behavior and temperament, then trace anything important to a paper.

**Wikipedia.** Use only as a pointer to the cited paper. Cite the paper, not the article.

## Known problem numbers

These circulate widely online and should not be treated as facts:

- **"psi" bite forces.** Most viral bite force figures are labeled psi (pressure) when they are really pounds of force. The croc's famous 3,700 is pounds of force, not psi. Animosity stores bite force in newtons.
- **Great white "4,000 psi."** This is the modeled estimate for a 6.5 m shark, mislabeled as psi. It does not apply to an average adult.
- **Gorilla "1,300 psi" and grizzly "975 psi."** No peer-reviewed measurement found yet. Treated as unknown until sourced.
- **Crocodile land speed.** Short bursts only; sustained speed on land is much lower.

## Open items

- [ ] Look up lion and brown bear values in Wroe et al. 2005 and Christiansen & Wroe 2007 tables
- [ ] Interpolate a great white estimate for a 3.8 m male from Wroe et al. 2008
- [ ] Replace Wikipedia mass and length values with PanTHERIA or AnimalTraits values
- [ ] Find fighting style and temperament references for each animal
- [ ] Verify functions_in (land, shallow_water, deep_water) for each animal; define "shallow water"
- [ ] Find sourced hide thickness and canine or tooth length values before any defense rule

## functions_in review

These references now support the environment levels in METHODOLOGY.md. They document habitat use, not fighting performance; levels remain model assumptions.

All seven supplied lists and all numerical measurements are retained unchanged.
This review applies the existing source tiers above: zoo, aquarium, museum and
park service pages are tier-3 reference summaries, not tier-2 research models.
Peer-reviewed primary observations qualify for tier 1 only when they directly
support the list as written. The two primary papers below do not validate their
respective retained lists, so those lists remain null rather than inheriting a
paper's tier.

### Lion — land — null

[San Francisco Zoo, African lion](https://www.sfzoo.org/african-lion/) describes
primarily terrestrial life. [Braczkowski et al. (2024), *Long-distance swimming by
African lions in Uganda*, Ecology and Evolution, doi:10.1002/ece3.11597](https://pmc.ncbi.nlm.nih.gov/articles/PMC11236087/)
documents swimming by male lions. The retained land-only list is contradicted
as an exhaustive locomotion claim; it remains an unresolved model assumption,
not a demonstrated inability to function in water. Swimming observations alone
do not establish water fighting capability.

### Grizzly bear — land, shallow_water — null

NPS Katmai's [Brown Bear FAQ, questions 2 and 5](https://www.nps.gov/katm/learn/photosmultimedia/brown-bear-frequently-asked-questions.htm)
documents river fishing and explains the grizzly/coastal brown bear distinction.
Its [Mammals page](https://www.nps.gov/katm/learn/nature/natscimamm.htm) describes
swimming and diving. These are same-species observations, not measurements of
this inland grizzly profile or the same population/subspecies. The retained
deep-water exclusion is an unresolved model assumption, not an inability to swim.

### Saltwater crocodile — land, shallow_water, deep_water — 3

[Australian Museum, Estuarine Crocodile](https://australian.museum/learn/animals/reptiles/estuarine-crocodile/)
describes coming onto land to scavenge, river/estuary use, shallow-water hunting
and open-ocean crossings. This supports broad environmental access, not equal
performance across environments or fighting ability. Ocean crossing does not
establish a measured diving-depth limit.

### Gorilla — land — null

[Denver Zoo, Western Lowland Gorilla](https://denverzoo.org/animals/western-lowland-gorilla/)
supports terrestrial knuckle walking. [Breuer, Ndoundou-Hockemba and Fishlock
(2005), *First Observation of Tool Use in Wild Gorillas*, PLoS Biology,
doi:10.1371/journal.pbio.0030380](https://pmc.ncbi.nlm.nih.gov/articles/PMC1236726/)
observes adult females wading with support. That does not establish adult male
swimming capability or an all-species boundary for the generic Gorilla profile.
The retained land-only list is an unresolved model assumption, not proof that
gorillas cannot enter shallow water.

### Hippopotamus — land, shallow_water — 3

[San Diego Zoo Wildlife Alliance, Hippo](https://animals.sandiegozoo.org/animals/hippo)
describes common/river hippos grazing and traveling on land, wallowing in shallow
water, and moving underwater by walking or pushing off from the bottom rather
than swimming. The retained mapping assumes reachable substrate and air;
omitting deep water does not establish that every deep river is inaccessible.

### Great white shark — shallow_water, deep_water — 3

[Aquarium of the Pacific, Great White Shark](https://www.aquariumofpacific.org/onlinelearningcenter/species/great_white_shark)
describes bays, surf and offshore habitat; [Monterey Bay Aquarium, White shark](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/white-shark)
describes surface-to-deep ocean use. These support aquatic habitat access, not
land locomotion. Shallow water must still allow clearance, full submersion, gill
ventilation and movement for the supplied adult size, not any puddle or wading
depth. No minimum clearance is defined by the enum.

### Rhinoceros — land, shallow_water — null

[Maryland Zoo, Southern White Rhinoceros](https://www.marylandzoo.org/animal/southern-white-rhinoceros/)
describes savannah life and wallowing in mud holes. White rhino is the
interpretation implied by the supplied measurement links, not all rhino species.
Wallowing alone does not verify unrestricted shallow-water locomotion or fighting;
safe depth and footing are unspecified, so the retained list remains unresolved.

### Model and narration limits

The environment labels have no numeric depth, current, salinity, duration or
substrate definition. Missing an environment from a list is not evidence of
physiological impossibility. Per METHODOLOGY.md Step 1, the engine still applies
these lists as hard gates even when their source tier is null. Habitat evidence
does not validate gate outcomes. Resolving these boundaries requires an explicit
definition of "function" and a separate model decision, not an inferred score or
invented measurements.

Updating these source tiers can change evidence-quality labels, not the supplied
lists, numerical inputs or scoring formula. functions_in is excluded from narrator
evidence entirely, regardless of tier. The TODO-reference safeguard remains in
place for other traits. None of the reviewed sources establishes hypothetical
matchup success.
