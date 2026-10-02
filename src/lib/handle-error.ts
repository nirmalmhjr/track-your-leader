import { isAxiosError } from "axios";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

interface ApiErrorResponse {
    title?: string;
    message?: string;
    errors?: ApiFieldError[];
}

interface ApiFieldError {
    key?: string[] | string;
    message?: string[] | string;
}

/**
 * Normalize unknown backend error format into arrays
 */
function normalizeArray(value?: string[] | string): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

interface HandleApiErrorOptions<T extends FieldValues> {
    error: unknown;
    form?: UseFormReturn<T>;
    fallbackMessage?: string;
}

function escapeAttributeValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function scrollToFirstErrorField<T extends FieldValues>(
    form: UseFormReturn<T>,
    field: Path<T>
): void {
    if (typeof window === "undefined") {
        return;
    }

    window.requestAnimationFrame(() => {
        form.setFocus(field);

        const escapedField = escapeAttributeValue(field);
        const fieldElement = document.querySelector<HTMLElement>(
            `[name="${escapedField}"], [id="${escapedField}"]`
        );

        const target = fieldElement ?? document.activeElement;

        if (target instanceof HTMLElement) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });
}

/**
 * Main API error handler
 */
export function handleApiError<T extends FieldValues>({
    error,
    form,
    fallbackMessage = "An unexpected error occurred. Please try again.",
}: HandleApiErrorOptions<T>): void {
    console.error(error);

    if (!isAxiosError(error)) {
        toast.error(fallbackMessage);
        return;
    }

    const responseData = error.response?.data as ApiErrorResponse | undefined;

    if (!responseData) {
        toast.error(fallbackMessage);
        return;
    }

    const { errors, message } = responseData;

    if (!Array.isArray(errors) || errors.length === 0) {
        toast.error(message ?? fallbackMessage);
        return;
    }

    const summaryMessages: string[] = [];
    let firstErrorField: Path<T> | null = null;

    for (const { key, message } of errors) {
        const fields = normalizeArray(key);
        const messages = normalizeArray(message);
        const msg = messages.join(", ");

        if (fields.length === 0) {
            // No field associated, show as global toast
            summaryMessages.push(msg);
            continue;
        }

        for (const field of fields) {
            if (form?.getValues(field as Path<T>) === undefined) {
                summaryMessages.push(msg);
            } else {
                const fieldPath = field as Path<T>;
                form.setError(fieldPath, { message: msg });
                firstErrorField ??= fieldPath;
            }
        }
    }

    if (form && firstErrorField) {
        scrollToFirstErrorField(form, firstErrorField);
    }

    if (summaryMessages.length) {
        toast.error(`Validation error: ${summaryMessages.join(", ")}`);
    }
}
