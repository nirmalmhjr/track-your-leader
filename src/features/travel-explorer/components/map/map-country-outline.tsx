import { cn } from "@/lib/utils";

const OUTLINE_STYLES = {
    hover: {
        border: "stroke-(--map-hover-border) [stroke-width:1.25]",
        casing: "stroke-(--map-hover-casing) [stroke-width:3.25]",
    },
    selected: {
        border: "stroke-(--map-selected-border) [stroke-width:1.5]",
        casing: "stroke-(--map-selected-casing) [stroke-width:3.5]",
    },
} as const;

const OUTLINE_PATH = "fill-none [stroke-linejoin:round] [vector-effect:non-scaling-stroke]";

interface MapCountryOutlineProps {
    path: string;
    variant: keyof typeof OUTLINE_STYLES;
}

/**
 * A country's outline: a line over a wider casing. The casing is transparent on the plain map
 * and a soft dark edge on terrain, where a single colour would vanish on some ground.
 */
export function MapCountryOutline({ path, variant }: MapCountryOutlineProps) {
    const styles = OUTLINE_STYLES[variant];
    return (
        <g aria-hidden className="pointer-events-none">
            <path className={cn(OUTLINE_PATH, styles.casing)} d={path} />
            <path className={cn(OUTLINE_PATH, styles.border)} d={path} />
        </g>
    );
}
