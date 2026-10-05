import { fetchText } from "../lib/http";

/**
 * QLever: a fast SPARQL engine run by the University of Freiburg over a complete, live-updated
 * copy of Wikidata (CC0). Used for the bulk questions the Wikidata query service times out on,
 * such as everyone who held any public office in a country. Results come as tab-separated
 * values, which are much smaller than SPARQL JSON for hundreds of thousands of rows.
 */

const ENDPOINT = "https://qlever.dev/api/wikidata";

const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
`;

const ENTITY_IRI = /^<http:\/\/www\.wikidata\.org\/entity\/([QP]\d+)>$/;
const IRI = /^<(.*)>$/;
/** `"value"`, `"value"@en` or `"value"^^<datatype>`. */
const LITERAL = /^"((?:[^"\\]|\\.)*)"(?:@[\w-]+|\^\^<[^>]+>)?$/;
const ESCAPE = /\\(.)/g;
const VARIABLE_MARK = /^\?/;
const ESCAPES: Readonly<Record<string, string>> = { n: "\n", r: "\r", t: "\t" };

export type QleverRow = Readonly<Record<string, string | undefined>>;

/**
 * Reads one TSV cell: Wikidata entity IRIs become their id (`Q42`), other IRIs their address,
 * literals their unescaped text (language tags and datatypes dropped). Empty cells are unbound.
 *
 * @param cell - Raw cell text.
 * @returns The value, or `undefined` when unbound.
 */
export const parseQleverCell = (cell: string): string | undefined => {
    if (cell === "") {
        return undefined;
    }
    const entity = cell.match(ENTITY_IRI);
    if (entity) {
        return entity[1];
    }
    const iri = cell.match(IRI);
    if (iri) {
        return iri[1];
    }
    const literal = cell.match(LITERAL);
    if (literal) {
        return literal[1].replace(
            ESCAPE,
            (_, character: string) => ESCAPES[character] ?? character
        );
    }
    return cell;
};

/**
 * Parses a SPARQL TSV result into rows keyed by variable name.
 *
 * @param text - Response body; the first line names the variables (`?person`).
 * @returns One record per row.
 */
export const parseQleverTsv = (text: string): QleverRow[] => {
    const [header, ...lines] = text.split("\n");
    const names = (header ?? "").split("\t").map((name) => name.replace(VARIABLE_MARK, "").trim());
    return lines
        .filter((line) => line.length > 0)
        .map((line) => {
            const cells = line.split("\t");
            return Object.fromEntries(
                names.map((name, index) => [name, parseQleverCell(cells[index] ?? "")])
            );
        });
};

/**
 * Runs a query on QLever's Wikidata copy. Common prefixes (wd, wdt, p, ps, pq, rdfs, schema)
 * are added.
 *
 * @param query - SPARQL text without prefixes.
 * @param ttlHours - How long a cached answer is reused.
 * @returns One record per row, keyed by variable name.
 */
export const runQlever = async (query: string, ttlHours?: number): Promise<QleverRow[]> =>
    parseQleverTsv(
        await fetchText(ENDPOINT, {
            form: { query: `${PREFIXES}${query}` },
            headers: { Accept: "text/tab-separated-values" },
            ttlHours,
        })
    );
