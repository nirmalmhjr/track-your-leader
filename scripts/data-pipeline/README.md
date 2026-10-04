# Data pipeline

Builds the explorer's real data — officials and their international trips — from free public
sources, with no backend or database. Everything collected lands in a committed **warehouse**
(`data/warehouse/`, every country and year); the app's bundled files are a slice of it.

```bash
pnpm data:collect                       # every source, every country, offices since 1945
pnpm data:collect --since=1980          # a shorter horizon (faster)
pnpm data:collect --countries=NPL,IND   # only some countries (others stay as stored)
pnpm data:collect --sources=colt,gov-uk # only some sources (others reuse stored claims)
pnpm data:sync                          # daily refresh of the app's countries (fast sources only)
pnpm data:test                          # parser tests
```

Both commands accept `--refresh` (ignore the local HTTP cache) and `--force` (write even if
counts dropped sharply — read the report first). A cold `data:collect` takes about an hour,
mostly polite waiting between requests.

A GitHub Action (`.github/workflows/data-sync.yml`) runs `data:sync` every day and commits any
changes; the hosting platform redeploys on that commit. `data:collect` is run by hand for now.

## Sources

| What | Source | Licence |
| --- | --- | --- |
| Heads of state and government, foreign/finance/defence ministers, deputy PMs and vice presidents, with terms | Wikidata | CC0 |
| Current cabinets (ministers, deputies) | CIA World Leaders (`page-data.json` behind each country page) | Public domain |
| US cabinet (the CIA doesn't list the US) | Wikidata, offices listed in `config.ts` | CC0 |
| Photos, parties, Wikidata ids | Wikidata / Wikimedia Commons | CC0 / per file |
| Short biographies | Wikipedia article intros | CC BY-SA |
| Trips of well-known leaders and foreign ministers | Wikipedia "List of international … trips made by …" pages | CC BY-SA |
| Trips of heads of state and government of 200+ countries since 1945 | [COLT](https://doi.org/10.7910/DVN/HJK7DN) (Diplometrics, University of Denver), Harvard Dataverse | CC0 |
| Trips of US presidents and secretaries of state | [US Office of the Historian](https://github.com/HistoryAtState/travels) | Public domain (CC0) |
| Trips of every UK minister, quarterly since about 2010 | GOV.UK ministerial transparency CSVs | Open Government Licence v3.0 |
| Trips of Canadian ministers | [Proactive Disclosure – Travel Expenses](https://open.canada.ca/data/en/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce) | Open Government Licence – Canada |
| Current trips of Nepal's President, VP, PM and Foreign Minister | [mofa.gov.np](https://mofa.gov.np) press releases | Government website |
| Coordinates of cities and capitals | Wikidata | CC0 |

Wikipedia, GOV.UK and Canada's data require attribution; the app's panel footer credits the
sources and each trip links to where it came from. Please cite COLT as: Diplometrics, *Country
and Organization Leader Travel (COLT)*, Harvard Dataverse, doi:10.7910/DVN/HJK7DN.

Looked at and left out for now: India's MEA visit lists (loaded by JavaScript; needs its data
endpoint), Japan's MOFA pages, Nepal's older MoFA archive (fails certificate checks), the
kdiplo Korean dataset (unclear licence; COLT covers Korea) and GDELT (too noisy without AI).

## How it works

```
collect.ts / run.ts → pipeline.ts
├─ extract/countries.ts           every sovereign state + every government the CIA lists
├─ extract/leaders.extract.ts     Wikidata: leaders' and ministers' terms since --since
├─ extract/cabinets.extract.ts    CIA list per country (skipped if older than the current leader)
├─ extract/roster.ts              remembers who joined/left a cabinet and when (state/roster.json)
├─ extract/identity.ts            links cabinet members to Wikidata people (name + citizenship)
├─ extract/claims/*.claims.ts     one per source: its trips as "claims" (who, when, where)
│  ├─ wikipedia  trip-pages.discover → trip-tables.parse → trip-dates.parse
│  ├─ colt       sources/colt.ts streams the spreadsheet
│  ├─ historian  sources/state-historian.ts reads the XML per person
│  ├─ uk         sources/gov-uk.ts finds every quarterly CSV
│  ├─ canada     sources/canada-open-data.ts streams the national CSV
│  └─ nepal-mofa sources/nepal-mofa.ts reads press releases about visits abroad
├─ extract/places.resolve.ts      countries, capitals and cities → coordinates via Wikidata
├─ extract/travellers.match.ts    who made each trip: Wikidata id → name → family name + office →
│                                 office + date; unknown named travellers become new officials
├─ extract/officials.extract.ts   photos, parties, biographies, stable ids
├─ extract/trips.merge.ts         the same trip from several sources becomes one trip
├─ extract/app-export.ts          the app's slice: tracked countries, since appSinceYear
└─ validate/guard.ts              refuses to write if counts drop by more than 20 %
```

Folders: `sources/` talk to one website each, `extract/` turn raw data into records, `lib/`
holds shared helpers (polite HTTP with caching and retries, text, JSON files, the warehouse).

Outputs:

- `data/warehouse/officials/<ISO3>.json`, `trips/<ISO3>.json` — everything, per country.
- `data/warehouse/claims/<source>.json.gz` — each source's trips before merging, so a run that
  skips a source reuses them.
- `data/warehouse/places/cities.json` — every city name looked up (found or not), so each is
  asked once.
- `data/warehouse/report.json` — what needs a human look: per-source counts, rows that couldn't
  be read, unmatched names, stale cabinets, trip pages found.
- `src/features/travel-explorer/data/generated/*.json` — the app's slice (tracked countries,
  since `appSinceYear`), validated against `generated-data.schema.ts` on both sides.
- `state/roster.json` — the pipeline's memory of cabinets between runs. Commit it.

## Behaviour worth knowing

- **Trip status is not stored.** The app derives completed / upcoming from today's date. The
  data only says when a source marks a trip as cancelled or as future/planned.
- **Loose dates stay loose.** "June 2027" is stored with month precision and shown that way.
- **No invented cities.** When a source names only the country (most COLT rows), the trip is
  drawn at the capital but stored with `precision: "country"` and labelled with the country.
- **Same trip, one record.** Claims for the same person, destination country and overlapping
  dates merge. Details come from the most trusted source: official government records, then
  Wikipedia and Nepal's MoFA, then COLT. Every source stays listed on the trip.
- **New officials from trip sources.** A named traveller no known official matches (a UK junior
  minister, a 1950s leader) becomes an official described by the sources: one position per
  title, from their first to their last reported trip (still open if that was within a year).
- **Unknown start dates stay unknown.** Ministers already in office on the first run get no
  start date unless Wikidata has one; later appointments get the day they first appear.
- **Historical countries map to successors.** The Soviet Union counts as Russia, Yugoslavia as
  Serbia, Czechoslovakia as Czechia, East and West Germany as Germany.

## Common fixes

- *A leader's trips are missing*: check `report.json → tripPages`. If the page wasn't found,
  add it in `extract/trip-pages.overrides.ts`.
- *A country's cabinet is "stale"*: the CIA hasn't updated it since a change of government.
  It recovers automatically when they do; leaders still come from Wikidata meanwhile.
- *Show another country in the app*: add it to `TRACKED_COUNTRIES` and run `pnpm data:sync`.
  Its data is already in the warehouse.
- *Wikimedia contact*: set `DATA_PIPELINE_CONTACT` (your site or repository URL) locally and
  as a GitHub Actions secret so Wikimedia can reach you about the bot's traffic. Without it,
  Wikipedia rate-limits the pipeline heavily.
