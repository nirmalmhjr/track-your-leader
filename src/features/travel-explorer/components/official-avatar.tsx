import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Official } from "@/features/travel-explorer/types/travel.types";
import { cn, getInitials } from "@/lib/utils";

interface OfficialAvatarProps {
    className?: string;
    official: Official;
    size?: "sm" | "default" | "lg" | "xl";
}

/** Profile photo with an initials fallback while photos are unavailable or loading. */
export function OfficialAvatar({ official, size = "default", className }: OfficialAvatarProps) {
    const isExtraLarge = size === "xl";

    return (
        <Avatar
            className={cn(isExtraLarge && "size-14", className)}
            size={isExtraLarge ? "lg" : size}
        >
            {official.photoUrl ? <AvatarImage alt="" src={official.photoUrl} /> : null}
            <AvatarFallback className={cn("font-medium", isExtraLarge && "text-base")}>
                {getInitials(official.fullName)}
            </AvatarFallback>
        </Avatar>
    );
}
