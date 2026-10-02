"use client";

import type { ReactNode } from "react";
import { useCallback, useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface CheckboxOption<TValue extends string> {
    adornment?: ReactNode;
    label: string;
    value: TValue;
}

interface CheckboxOptionListProps<TValue extends string> {
    columns?: 1 | 2;
    legend: string;
    onChange: (next: TValue[]) => void;
    options: readonly CheckboxOption<TValue>[];
    selected: readonly TValue[];
}

function CheckboxOptionItem<TValue extends string>({
    id,
    option,
    isChecked,
    onToggle,
}: {
    id: string;
    option: CheckboxOption<TValue>;
    isChecked: boolean;
    onToggle: (value: TValue, isChecked: boolean) => void;
}) {
    const handleChange = useCallback(
        (checked: boolean) => onToggle(option.value, checked),
        [onToggle, option.value]
    );

    return (
        <Field className="gap-2" orientation="horizontal">
            <Checkbox checked={isChecked} id={id} onCheckedChange={handleChange} />
            <FieldLabel className="flex-1 font-normal" htmlFor={id}>
                <span className="flex min-w-0 items-center gap-2">
                    {option.adornment}
                    <span className="truncate">{option.label}</span>
                </span>
            </FieldLabel>
        </Field>
    );
}

/**
 * Multi-select group of checkboxes. Selecting nothing means "no restriction", which keeps
 * every filter optional and additive.
 */
export function CheckboxOptionList<TValue extends string>({
    legend,
    options,
    selected,
    onChange,
    columns = 1,
}: CheckboxOptionListProps<TValue>) {
    const groupId = useId();

    const toggle = useCallback(
        (value: TValue, isChecked: boolean) =>
            onChange(
                isChecked
                    ? [...selected, value]
                    : selected.filter((candidate) => candidate !== value)
            ),
        [onChange, selected]
    );

    return (
        <FieldSet className="gap-2">
            <FieldLegend className="mb-1 font-medium text-muted-foreground" variant="label">
                {legend}
            </FieldLegend>
            <div className={cn("grid gap-x-3 gap-y-2", columns === 2 && "grid-cols-2")}>
                {options.map((option) => (
                    <CheckboxOptionItem
                        id={`${groupId}-${option.value}`}
                        isChecked={selected.includes(option.value)}
                        key={option.value}
                        onToggle={toggle}
                        option={option}
                    />
                ))}
            </div>
        </FieldSet>
    );
}
