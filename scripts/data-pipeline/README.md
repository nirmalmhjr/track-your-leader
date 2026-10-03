# Data pipeline

Builds the explorer's real data — officials and their international trips — from free public
sources, with no backend or database. The output is plain JSON committed to the repo; the app
imports it at build time.

```bash
pnpm data:sync            # fetch, parse, validate, write (a few minutes on a cold cache)
pnpm data:sync --refresh  # ignore the local HTTP cache
pnpm data:sync --force    # write even if counts dropped sharply (read the report first)
pnpm data:test            # parser tests
```

A GitHub Action (`.github/workflows/data-sync.yml`) runs the sync every day and commits any
changes; the hosting platform redeploys on that commit. It can also be started by hand from
the repository's **Actions** tab.

## Sources

| What | Source | Licence |
| --- | --- | --- |
| Heads of state and government, with term dates (since `sinceYear`) | Wikidata | CC0 |
| Current cabinets (ministers, deputies) | CIA World Leaders (`page-data.json` behind each country page) | Public domain |
| US cabinet (the CIA doesn't list the US) | Wikidata, offices listed in `config.ts` | CC0 |
| Photos, parties, Wikidata ids | Wikidata / Wikimedia Commons | CC0 / per file |
| Short biographies | Wikipedia article intros | CC BY-SA |
| Trips | Wikipedia "List of international … trips made by …" pages | CC BY-SA |
| City coordinates | Wikidata items of the linked cities | CC0 |

Wikipedia content requires attribution; the app's panel footer credits the sources.

## How it works

```
run.ts
├─ extract/leaders.extract.ts     Wikidata: leader offices per country → every term since sinceYear
├─ extract/cabinets.extract.ts    CIA list per country (skipped if older than the current leader)
├─ extract/roster.ts              remembers who joined/left a cabinet and when (state/roster.json)
├─ extract/identity.ts            links cabinet members to Wikidata people (name + citizenship)
├─ extract/officials.extract.ts   merges everything; adds photos, parties, biographies, stable ids
├─ extract/trips.extract.ts
│  ├─ trip-pages.discover.ts      finds each leader's / foreign minister's trip-list pages
│  ├─ trip-tables.parse.ts        reads tables by header text, expanding row/col spans
│  ├─ trip-dates.parse.ts         "15–16 June", "30 Nov – 2 Dec", "June 2027" → ISO dates
│  ├─ trip-type.classify.ts       purpose → state visit, summit, conference …
│  └─ places.resolve.ts           city/country links → coordinates via Wikidata
└─ validate/guard.ts              refuses to write if counts drop by more than 20 %
```

Folders: `sources/` talk to one website each, `extract/` turn raw data into app records,
`lib/` holds shared helpers (polite HTTP with caching and retries, text, JSON files).

Outputs:

- `src/features/travel-explorer/data/generated/officials.json`, `trips.json`, `meta.json` —
  read by the app and validated against `generated-data.schema.ts` on both sides.
- `state/roster.json` — the pipeline's memory between runs. Commit it.
- `state/report.json` — what needs a human look: unmatched names, stale cabinets, rows that
  couldn't be read, and how many trips each page produced.

## Behaviour worth knowing

- **Trip status is not stored.** The app derives completed / upcoming from today's date. The
  data only says when a source marks a trip as cancelled or as future/planned.
- **Loose dates stay loose.** "June 2027" is stored with month precision and shown that way.
- **Unknown start dates stay unknown.** Ministers already in office on the first run get no
  start date unless Wikidata has one; later appointments get the day they first appear.
- **Nothing is invented.** Rows whose date or place can't be read are skipped and listed in
  the report.
- **Only announced trips.** Everything comes from published lists; nothing is inferred.

## Common fixes

- *A leader's trips are missing*: check `state/report.json → tripPages`. If the page wasn't
  found, add it in `extract/trip-pages.overrides.ts`.
- *A country's cabinet is "stale"*: the CIA hasn't updated it since a change of government.
  It recovers automatically when they do; leaders still come from Wikidata meanwhile.
- *Track another country*: add it to `TRACKED_COUNTRIES` (app) and `COUNTRY_SOURCES`
  (`config.ts`), then run the sync.
- *Wikimedia contact*: set `DATA_PIPELINE_CONTACT` (your site URL) locally and as a GitHub
  Actions secret so Wikimedia can reach you about the bot's traffic.
