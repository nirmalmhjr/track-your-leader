# Data pipeline

Builds the explorer's real data from free public sources, with no backend or database:
everyone politically exposed in every country since 1945 (heads of state and government,
ministers, legislators, regional and city leaders, judges, diplomats, central bankers, military
chiefs and party leaders) and their international trips. Everything is committed as static
files:

- `public/data/countries/<ISO3>.json`: each country's officials with full records (anyone who
  travelled, and the executive: heads, deputies, ministers) and their trips. The app loads a
  country's file when that country is opened.
- `public/data/index.json`: the compact list the app loads first. It holds the travellers and
  everyone in office today; former officials without trips are only in the country files.
- `data/warehouse/people/<ISO3>.json.gz`: everyone else (about 300,000 legislators, judges,
  diplomats…), compressed. `pnpm data:people` unpacks them into `public/data/people/`
  (git-ignored), and `pnpm build` runs it first.

```bash
pnpm data:collect                       # every source, every country, offices since 1945
pnpm data:collect --since=1980          # a shorter horizon (faster)
pnpm data:collect --countries=NPL,IND   # only some countries (others stay as stored)
pnpm data:collect --sources=colt,gov-uk # only some sources (others reuse stored claims)
pnpm data:collect --sources=none        # no trip source (all reuse stored claims)
pnpm data:sync                          # daily refresh of the featured countries (fast sources only)
pnpm data:export                        # rebuild public/data/index.json from the country files (offline)
pnpm data:people                        # unpack the people store into public/data/people/ (offline)
pnpm data:coverage                      # which leaders have years with few trips (offline)
pnpm data:audit                         # duplicates, gaps and suspect records (offline)
pnpm data:test                          # parser tests
```

Both commands accept `--refresh` (ignore the local HTTP cache), `--resume` (reuse every cached
response however old, so a run that was stopped picks up where it left off) and `--force` (write
even if counts dropped sharply — read the report first). A cold `data:collect` takes about an hour,
mostly polite waiting between requests.

Two GitHub Actions commit any changes, and the hosting platform redeploys on each commit:
`.github/workflows/data-sync.yml` runs `data:sync` every day, and
`.github/workflows/data-collect.yml` runs the full `data:collect` every Sunday. They share a
concurrency group, so they never write at the same time.

## Sources

| What | Source | Licence |
| --- | --- | --- |
| Heads of state and government, foreign/finance/defence ministers, deputy PMs and vice presidents, with terms | Wikidata | CC0 |
| Everyone else who held a public office since 1945: every ministry, legislators, governors, mayors of capitals and cities of 100,000+, judges, ambassadors, central bankers, military chiefs, party leaders | Wikidata, queried in bulk through [QLever](https://qlever.dev) | CC0 |
| Current cabinets (ministers, deputies) | CIA World Leaders (`page-data.json` behind each country page) | Public domain |
| US cabinet (the CIA doesn't list the US) | Wikidata, offices listed in `config.ts` | CC0 |
| Photos, parties, Wikidata ids | Wikidata / Wikimedia Commons | CC0 / per file |
| Photos Wikidata lacks: the lead image of the person's article on 23 Wikipedias (free licences only), their Commons category, or their official parliamentary portrait | Wikipedia `pageimages`, Wikimedia Commons, [unitedstates/images](https://github.com/unitedstates/images) (US Congress), UK Parliament Members API | Per file (free) / public domain / CC BY 3.0 |
| Short biographies | Wikipedia article intros | CC BY-SA |
| Trips of well-known leaders and foreign ministers | Wikipedia trip-list pages in English, Spanish, French, Portuguese, German, Indonesian, Korean, Arabic and Persian ("List of … trips made by …", "Lista de viagens presidenciais de …", "이재명의 대통령 순방 목록"…) | CC BY-SA |
| Every in-person speech at the UN General Assembly's general debate, 2008 on | Wikipedia's article for each session | CC BY-SA |
| Health ministers (and other members of government) at every World Health Assembly, 1999 on | WHO "List of delegates and other participants" PDFs | WHO, reproduction with attribution |
| Visits outside the UK registered by sitting MPs | [UK Parliament interests API](https://interests-api.parliament.uk) | Open Parliament Licence |
| Australian parliamentarians' international travel, 2017 on | [IPEA](https://www.ipea.gov.au) expenditure files on data.gov.au | CC BY 3.0 AU |
| Trips of monarchs, and state visits they hosted | Wikipedia "List of official overseas trips made by …", "List of state visits made (and received) by …" pages | CC BY-SA |
| Trips of heads of state and government of 200+ countries since 1945 | [COLT](https://doi.org/10.7910/DVN/HJK7DN) (Diplometrics, University of Denver), Harvard Dataverse | CC0 |
| Trips of US presidents and secretaries of state | [US Office of the Historian](https://github.com/HistoryAtState/travels) | Public domain (CC0) |
| Visits to the US by foreign leaders of every country, since 1874 | [US Office of the Historian](https://github.com/HistoryAtState/visits) | Public domain (CC0) |
| Summit attendance since 1945 (Non-Aligned Movement, Arab League, Commonwealth, G7/G20, BRICS, SCO, SAARC, ASEAN, APEC, NATO, Summit of the Americas…) | Wikipedia summit pages, attendee lists with flags | CC BY-SA |
| High-level visits between pairs of countries | Wikipedia "<country>–<country> relations" pages, visit lists under "visits from X to Y" headings | CC BY-SA |
| Leaders missing from office records (e.g. King Zahir Shah) | Wikidata "head of state" / "head of government" statements on country items and sole predecessor states | CC0 |
| Trips of every UK minister, quarterly since about 2010 | GOV.UK ministerial transparency CSVs | Open Government Licence v3.0 |
| Trips of Canadian ministers | [Proactive Disclosure – Travel Expenses](https://open.canada.ca/data/en/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce) | Open Government Licence – Canada |
| Current trips of Nepal's President, VP, PM and Foreign Minister | [mofa.gov.np](https://mofa.gov.np) press releases | Government website |
| Every foreign leader and minister received in India (monarchs included), and India's PM, President, VP and External Affairs Minister abroad, 2005 on | [mea.gov.in](https://www.mea.gov.in/incoming-visits) incoming and outgoing visit lists | All rights reserved: only facts (who, where, when) are kept, linked to MEA's page, no text copied |
| Foreign leaders' visits to Russia (and meetings abroad), 2000 on: every in-person meeting of the Russian President with a foreign leader, with its date and place | [en.kremlin.ru](http://en.kremlin.ru/events/president/news) event list | CC BY 4.0 |
| Danish monarchs' state and official visits abroad, and state visits to Denmark, 1972 on | [kongehuset.dk](https://www.kongehuset.dk/monarkiet-i-danmark/stats-og-officielle-besog) list | Facts only (who, where, when), linked to the page |
| Coordinates of cities and capitals | Wikidata | CC0 |

Wikipedia, GOV.UK and Canada's data require attribution; the app's panel footer credits the
sources and each trip links to where it came from. Please cite COLT as: Diplometrics, *Country
and Organization Leader Travel (COLT)*, Harvard Dataverse, doi:10.7910/DVN/HJK7DN.

Looked at and left out for now:

- India's MEA visit lists (loaded by JavaScript; needs its data endpoint), Japan's MOFA pages,
  Nepal's older MoFA archive (fails certificate checks).
- The kdiplo Korean dataset (unclear licence; COLT covers Korea), GDELT (too noisy without AI).
- ICEWS event data (no licence granted: "limited information on how it can be used"; ends 2022).
- EveryPolitician (frozen since 2019, no licence file, and legislators rather than travellers).
- [WhoGov](https://politicscentre.nuffield.ox.ac.uk/whogov-dataset/) (every cabinet member
  1966–2025): download behind a name-and-email form, and no licence stated, which rules it out
  if the site ever earns money. The
  [UN General Debate speakers](https://doi.org/10.7910/DVN/0TJX8Y) dataset is also behind a
  form; Wikipedia's session articles give the same speakers from 2008.
- [OpenSanctions](https://www.opensanctions.org/datasets/peps/) politically exposed persons:
  CC BY-NC (non-commercial only), so the people list is built from Wikidata instead.
- World Health Assembly lists for 2000, 2001, 2008 and 2009 (no file under any known name) and
  2005 (no text layer).
- The Kremlin's trip list (CC BY 4.0) covers only the Russian president's own trips, which
  COLT and Wikipedia already list.

## How it works

```
collect.ts / run.ts → pipeline.ts
├─ extract/countries.ts           every sovereign state + every government the CIA lists
├─ extract/leaders.extract.ts     Wikidata: leaders' and ministers' terms since --since
├─ extract/cabinets.extract.ts    CIA list per country (skipped if older than the current leader)
├─ extract/roster.ts              remembers who joined/left a cabinet and when (state/roster.json)
├─ extract/identity.ts            links cabinet members to Wikidata people (name + citizenship)
├─ extract/people.extract.ts      everyone politically exposed, via QLever: office classes, who held
│                                 which office in each country, names, photos, parties
├─ extract/people.assemble.ts     folds them into the officials; travellers and the executive get
│                                 full records, everyone else goes to the people store
├─ extract/claims/*.claims.ts     one per source: its trips as "claims" (who, when, where)
│  ├─ wikipedia  trip-pages.discover → trip-tables.parse → trip-dates.parse
│  ├─ colt       sources/colt.ts streams the spreadsheet
│  ├─ historian  sources/state-historian.ts reads the XML per person
│  ├─ historian-visits  sources/historian-visits.ts reads the XML per decade
│  ├─ uk         sources/gov-uk.ts finds every quarterly CSV
│  ├─ uk-parliament  sources/uk-parliament.ts pages through MPs' registered visits
│  ├─ au-ipea    sources/au-ipea.ts streams every quarter's expenses
│  ├─ un-general-debate  Wikipedia's session articles, speaker by speaker
│  ├─ who-assembly  sources/who-assembly.ts reads each delegate list (PDF) via un-delegations.parse
│  ├─ canada     sources/canada-open-data.ts streams the national CSV
│  ├─ nepal-mofa sources/nepal-mofa.ts reads press releases about visits abroad
│  ├─ india-mea  sources/india-mea.ts reads India's incoming and outgoing visit lists
│  ├─ kremlin    sources/kremlin.ts pages through the Kremlin's events; visitor-titles reads who
│  └─ danish-court  sources/danish-court.ts reads the Royal House's list of visits
├─ extract/places.resolve.ts      countries, capitals and cities → coordinates via Wikidata
├─ extract/travellers.match.ts    who made each trip: Wikidata id → name → family name + office →
│                                 office + date; unknown named travellers become new officials
├─ extract/officials.extract.ts   photos, parties, biographies, stable ids
├─ extract/trips.merge.ts         the same trip from several sources becomes one trip
├─ extract/app-index.ts           public/data/index.json: every country, official and trip, compact
├─ extract/coverage.ts            data/warehouse/coverage.json: leaders' years with few trips
└─ validate/guard.ts              refuses to write if counts drop by more than 20 %
```

Folders: `sources/` talk to one website each, `extract/` turn raw data into records, `lib/`
holds shared helpers (polite HTTP with caching and retries, text, JSON files, the warehouse).

Outputs:

- `public/data/countries/<ISO3>.json` — each country's officials and merged trips, served to
  the app as they are.
- `public/data/index.json` — every country, official and trip in compact form (arrays and
  numbered enums, one record per line so git diffs stay small), loaded by the app at startup.
  The format lives in `src/features/travel-explorer/data/travel-index.ts`.
- `data/warehouse/claims/<source>.json.gz` — each source's trips before merging, so a run that
  skips a source reuses them.
- `data/warehouse/places/cities.json` — every city name looked up (found or not), so each is
  asked once.
- `data/warehouse/report.json` — what needs a human look: per-source counts, rows that couldn't
  be read, unmatched names, stale cabinets, trip pages found.
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
- **Leaders are matched by office too.** A head of state or government whose name a source
  spells differently ("Salih" for "Saleh") is matched to whoever held that office on the
  trip's date, when exactly one person did. A surname alone ("President Betancourt") matches
  the one official of that country with that surname who held the role, for terms Wikidata
  is missing.
- **Shared monarchs are filed once.** Commonwealth realms, the Cook Islands and Niue don't
  track their head of state, so the British monarch and the royal trips sit under the UK.
- **New officials from trip sources.** A named traveller no known official matches (a UK junior
  minister, a 1950s leader) becomes an official described by the sources: one position per
  title, from their first to their last reported trip (still open if that was within a year).
- **Unknown start dates stay unknown.** Ministers already in office on the first run get no
  start date unless Wikidata has one; later appointments get the day they first appear.
- **Dates nobody recorded stay unknown.** A Wikidata term with no dates at all, or one in an
  office many people hold at once (legislators, mayors, judges) that started over 25 years ago
  with no end, is marked `undated`: neither current nor known to have ended. A term with a start
  and no end closes at the person's death.
- **Embassies belong to the sending state.** Wikidata files "ambassador of the UK to Nepal"
  under Nepal; a diplomatic post only counts for a country its holder is a citizen of.
- **Delegates named by initials** (WHO lists: "Mr G. Pokharel, Minister of Health") are matched
  by family name and office on the date, and never become new officials.
- **Historical countries map to successors.** The Soviet Union counts as Russia, Yugoslavia as
  Serbia, Czechoslovakia as Czechia, East and West Germany as Germany.

## Common fixes

- *A leader's trips are missing*: check `report.json → tripPages`. If the page wasn't found,
  add it in `extract/trip-pages.overrides.ts`.
- *State visits a monarch received*: on pages titled "…received by …", or under headings such
  as "State visits received", each row becomes a trip of the visiting country's head of state
  on that date. Rows under such headings on other trip pages are skipped (the visitor could be
  a head of government).
- *A country's cabinet is "stale"*: the CIA hasn't updated it since a change of government.
  It recovers automatically when they do; leaders still come from Wikidata meanwhile.
- *A country's capital or description*: the app uses Wikidata's capital. To show a curated one
  (and a government description), add the country to `TRACKED_COUNTRIES`; `pnpm data:sync`
  refreshes those countries daily.
- *Wikimedia contact*: the bot's User-Agent names the project's repository so Wikimedia can
  reach you about its traffic; without a contact, Wikipedia rate-limits the pipeline heavily.
  Set `DATA_PIPELINE_CONTACT` (a site URL, never an email) to name something else.
