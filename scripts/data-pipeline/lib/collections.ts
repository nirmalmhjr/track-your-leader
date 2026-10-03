/**
 * Splits a list into consecutive chunks.
 *
 * @param items - Items to split.
 * @param size - Maximum chunk length.
 * @returns The chunks, in order.
 */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

/**
 * Maps over items with at most `limit` calls in flight. Results keep the input order.
 *
 * @param items - Items to process.
 * @param limit - Maximum number of concurrent calls.
 * @param mapper - Async function applied to each item.
 * @returns The mapped results.
 */
export const mapWithConcurrency = async <T, R>(
    items: readonly T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let next = 0;

    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next;
            next += 1;
            // biome-ignore lint/performance/noAwaitInLoops: each worker handles one item at a time by design.
            results[index] = await mapper(items[index], index);
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

/**
 * Groups items by a key, keeping insertion order.
 *
 * @param items - Items to group.
 * @param keyOf - Returns the group key of an item.
 * @returns A map from key to the items sharing it.
 */
export const groupBy = <T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> => {
    const groups = new Map<K, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        const group = groups.get(key);
        if (group) {
            group.push(item);
        } else {
            groups.set(key, [item]);
        }
    }
    return groups;
};
