import type { IsoDate, Official, Position } from "@/features/travel-explorer/types/travel.types";

/**
 * Checks whether a position was held on a date. Positions without a known start date count as
 * held from the beginning, so they still match trips made while the office was held.
 *
 * @param position - Position to test.
 * @param date - Calendar date to test against.
 * @returns `true` when the date falls inside the position's tenure.
 */
export const isPositionActiveOn = (position: Position, date: IsoDate): boolean =>
    (position.startDate === null || position.startDate <= date) &&
    (position.endDate === null || date < position.endDate);

/**
 * Title an official held on a date, falling back to the latest earlier position for trips made
 * after leaving office.
 *
 * @param official - Official who travelled.
 * @param date - First day of the trip.
 * @returns The position title to show next to the trip.
 */
export const resolvePositionTitle = (official: Official, date: IsoDate): string => {
    const active = official.positions.find((position) => isPositionActiveOn(position, date));
    const latestEarlier = official.positions.find(
        (position) => position.startDate !== null && position.startDate <= date
    );
    return (active ?? latestEarlier ?? official.positions[0]).title;
};
