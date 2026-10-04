# Moving the data to MongoDB and an API

Today the explorer reads static files the pipeline publishes: `public/data/index.json` (every
country, official and trip, compact) and `public/data/countries/<ISO3>.json` (one country's full
records). This document describes how to move that data into MongoDB and serve it through an
API, one call per panel section, without rewriting the app.

## What is already in place

- **One data seam in the app.** Components never fetch data themselves. They read
  `useExplorerData()` (`src/features/travel-explorer/hooks/use-explorer-data.tsx`), which loads
  through a `TravelDataClient` (`src/features/travel-explorer/data/travel-data-client.ts`). An
  API client implements the same interface and replaces `staticFileClient` in one line.
- **Stable ids.** Officials have readable ids that survive pipeline runs (`narendra-modi`); trips
  have `<officialId>--<startDate>--<destination ISO3>`. Use them as `_id` in MongoDB so the
  pipeline can upsert and shared links keep working.
- **Validated shapes.** `src/features/travel-explorer/data/generated-data.schema.ts` (Zod) defines
  officials and trips; validate API responses with the same schemas.

## Collections

| Collection | One document per | Shape | Indexes |
| --- | --- | --- | --- |
| `countries` | country | `{ _id: "NPL", name, capital: Place, governmentSystem, region }` | `_id` |
| `officials` | person | the official record in `countries/<ISO3>.json` (`fullName`, `positions[]`, `party`, `photoUrl`, `summary`, `sources[]`, `aliases[]`, `wikidataId`) plus `countryCode` | `countryCode`; `wikidataId`; text index on `fullName` + `aliases` |
| `trips` | merged trip | the trip record (`officialId`, `startDate`, `endDate`, `datePrecision`, `destination`, `type`, `purpose`, `eventName`, `engagements[]`, `sources[]`, `statusHint`) plus `originCountryCode` | `{ officialId: 1, startDate: -1 }`; `{ originCountryCode: 1, startDate: -1 }`; `{ "destination.countryCode": 1, startDate: -1 }` |
| `claims` | trip as one source reported it | the pipeline's `TripClaim` (`scripts/data-pipeline/types.ts`) | `{ source: 1, "traveller.countryCode": 1 }` |
| `pipeline_state` | source | bookmarks for the incremental daily sync (last revision ids, ETags, dataset versions) | `_id` = source id |

Size today: about 14,500 officials and 95,000 trips, roughly 100 MB as JSON, which fits a free
MongoDB Atlas cluster (M0, 512 MB storage) with room to grow.

Status (completed / upcoming / planned / cancelled) is **not stored**: it depends on today's
date. Compute it in the API (or keep computing it in the app, as `resolveTravelStatus` does).

## Endpoints, by panel section

All list endpoints accept the filters the app already keeps in the URL
(`src/features/travel-explorer/hooks/use-explorer-state.ts`): `from`, `to`, `type`, `status`,
`region`, `dest`, `portfolio`, `roles`, `tenure`, `party`, `q`, `city`, `prev`.

| Section | Call | Returns |
| --- | --- | --- |
| World map shading, world stats, country list | `GET /stats/world?…filters` | trips per origin country, totals, upcoming count |
| Search (⌘K) | `GET /search?q=nep&limit=20` | ranked countries and officials (name, title, country, photo) |
| Country header and stats | `GET /countries/:code` | country, counts of officials, trips, destinations, upcoming |
| Officials tab | `GET /countries/:code/officials?…filters&sort=rank` | officials with trip counts and last/next trip |
| Trips tab | `GET /countries/:code/trips?…filters&page=` | trips, newest first, paginated |
| Visitors tab | `GET /countries/:code/visitors?…filters&page=` | trips whose destination is the country |
| Map routes for a country | `GET /countries/:code/routes?…filters` | destinations with counts and coordinates |
| Official page | `GET /officials/:id` and `GET /officials/:id/trips?…filters` | person, then their trips |
| Trip page | `GET /trips/:id` | one trip with sources |

Paginate trip lists (the UK alone has 5,000+ trips). Cache responses briefly (the data changes
once a day) with `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.

## Loading the data

Add a final pipeline step (a "sink") after the country files are written:

1. For each changed `public/data/countries/<ISO3>.json`, upsert its officials and trips by `_id`
   (`bulkWrite` with `replaceOne` + `upsert: true`), and delete that country's documents whose
   ids are no longer in the file.
2. Upsert each source's claims and the source bookmarks.
3. Keep the connection string in an environment variable (`MONGODB_URI`, also a GitHub Actions
   secret); never commit it.

The static files can stay as a fallback and a readable history in git.

## Switching the app over

1. Build the API (Next.js route handlers in `src/app/api/…`, or a separate service).
2. Add `apiClient` implementing `TravelDataClient`; set `travelDataClient = apiClient`.
3. Move filtering from the browser to the API section by section: the index-based provider can
   keep serving the map while the panel tabs switch to their endpoints.
