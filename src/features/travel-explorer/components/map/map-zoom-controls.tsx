"use client";

import { IconFocusCentered, IconMinus, IconPlus, IconWorld } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MapZoomControlsProps {
    bottom: number;
    onFrameSelection: (() => void) | null;
    onReset: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

function ControlButton({
    label,
    shortcut,
    onClick,
    children,
}: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        aria-label={label}
                        className="rounded-none"
                        onClick={onClick}
                        size="icon-sm"
                        variant="ghost"
                    />
                }
            >
                {children}
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2" side="left">
                {label}
                {shortcut ? <Kbd>{shortcut}</Kbd> : null}
            </TooltipContent>
        </Tooltip>
    );
}

/** Zoom, reset and re-frame controls, kept small and grouped in one corner. */
export function MapZoomControls({
    onZoomIn,
    onZoomOut,
    onReset,
    onFrameSelection,
    bottom,
}: MapZoomControlsProps) {
    const t = useTranslations("Explorer.map.controls");

    return (
        <div
            className="absolute right-3 z-10 flex flex-col overflow-hidden rounded-lg border bg-card shadow-md transition-[bottom] duration-300"
            style={{ bottom }}
        >
            <ControlButton label={t("zoomIn")} onClick={onZoomIn} shortcut="+">
                <IconPlus />
            </ControlButton>
            <Separator />
            <ControlButton label={t("zoomOut")} onClick={onZoomOut} shortcut="−">
                <IconMinus />
            </ControlButton>
            <Separator />
            {onFrameSelection ? (
                <>
                    <ControlButton
                        label={t("frameSelection")}
                        onClick={onFrameSelection}
                        shortcut="F"
                    >
                        <IconFocusCentered />
                    </ControlButton>
                    <Separator />
                </>
            ) : null}
            <ControlButton label={t("reset")} onClick={onReset} shortcut="0">
                <IconWorld />
            </ControlButton>
        </div>
    );
}
