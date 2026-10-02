"use client";

import { ExplorerHeader } from "@/features/travel-explorer/components/header/explorer-header";
import { WorldMap } from "@/features/travel-explorer/components/map/world-map";
import { ExplorerPanel } from "@/features/travel-explorer/components/panel/explorer-panel";
import { ExplorerDataProvider } from "@/features/travel-explorer/hooks/use-explorer-data";

/**
 * Map-first explorer for the international travel of heads of state and senior officials.
 * The map is the primary navigation; the panel holds filters, people and travel details.
 */
export function TravelExplorer() {
    return (
        <ExplorerDataProvider>
            <div className="flex h-dvh flex-col bg-background">
                <ExplorerHeader />
                <main className="relative flex min-h-0 flex-1">
                    <ExplorerPanel />
                    <WorldMap />
                </main>
            </div>
        </ExplorerDataProvider>
    );
}
