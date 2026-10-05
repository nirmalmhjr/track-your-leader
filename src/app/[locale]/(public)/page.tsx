import { preload } from "react-dom";

import { TravelExplorer } from "@/features/travel-explorer/components/travel-explorer";
import { WORLD_TOPOLOGY_URL } from "@/features/travel-explorer/constants/explorer.constants";

export default function HomePage() {
    // Start downloading the map outlines with the page rather than once the map's code has run.
    preload(WORLD_TOPOLOGY_URL, { as: "fetch", crossOrigin: "anonymous" });
    return <TravelExplorer />;
}
