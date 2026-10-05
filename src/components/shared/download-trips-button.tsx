"use client";

import { IconDownload } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { saveTextFile } from "@/lib/download-file";
import { buildTripsCsv, TRIPS_CSV_MIME_TYPE, type TripsCsvInput } from "@/lib/travel/trips-csv";

/** One file the button can produce. */
export interface TripDownload {
    /** Trips in the file, for the menu labels. */
    count: number;
    fileName: string;
    /** Provides the trips; may fetch them when they aren't loaded yet. */
    load: () => TripsCsvInput | Promise<TripsCsvInput>;
}

interface DownloadTripsButtonProps {
    /** Every trip in scope, ignoring the visitor's filters. */
    all: TripDownload;
    className?: string;
    /** Only the trips matching the visitor's filters; offered alongside `all` when it differs and isn't empty. */
    filtered?: TripDownload;
    /** Visible label; defaults to "Download". */
    label?: string;
    /** Data the file needs is still loading elsewhere. */
    pending?: boolean;
    size?: "xs" | "sm";
    variant?: "ghost" | "outline";
}

/**
 * Saves trips as a CSV spreadsheet. Downloads straight away, or, when filters narrow the list,
 * asks whether to save the matching trips or all of them.
 */
export function DownloadTripsButton({
    all,
    filtered,
    label,
    pending = false,
    size = "sm",
    variant = "outline",
    className,
}: DownloadTripsButtonProps) {
    const t = useTranslations("Downloads");
    const format = useTravelFormat();
    const [preparing, setPreparing] = useState(false);
    const busy = pending || preparing;

    const save = useCallback(
        async ({ fileName, load }: TripDownload) => {
            setPreparing(true);
            try {
                const input = await load();
                const csv = buildTripsCsv({ ...input, baseUrl: window.location.origin });
                saveTextFile(fileName, csv, TRIPS_CSV_MIME_TYPE);
            } catch {
                // Loading a country's records can fail on a flaky connection; the visitor can retry.
                toast.error(t("failed"));
            } finally {
                setPreparing(false);
            }
        },
        [t]
    );
    const saveAll = useCallback(() => save(all), [all, save]);
    const saveFiltered = useCallback(async () => {
        if (filtered) {
            await save(filtered);
        }
    }, [filtered, save]);

    const content = (
        <>
            {busy ? (
                <Spinner aria-label={t("preparing")} data-icon="inline-start" />
            ) : (
                <IconDownload aria-hidden data-icon="inline-start" />
            )}
            {label ?? t("download")}
        </>
    );
    const buttonProps = { "aria-busy": busy, className, disabled: busy, size, variant } as const;

    // An empty or identical filtered file adds nothing over the full one.
    const offersFiltered = filtered && filtered.count > 0 && filtered.count !== all.count;
    if (!offersFiltered) {
        return (
            <Button {...buttonProps} onClick={saveAll}>
                {content}
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger disabled={busy} render={<Button {...buttonProps} />}>
                {content}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto max-w-72">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("menuLabel")}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={saveFiltered}>
                        {t("matching", {
                            count: filtered.count,
                            countLabel: format.number(filtered.count),
                        })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={saveAll}>
                        {t("all", { count: all.count, countLabel: format.number(all.count) })}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-muted-foreground text-xs leading-relaxed">
                    {t("note")}
                </p>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
