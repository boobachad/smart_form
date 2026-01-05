import type { SortDescriptor } from 'react-aria-components';

/**
 * Type-safe comparator function
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Column configuration for sorting
 */
export interface SortableColumn<T> {
    id: string;
    getValue: (item: T) => string | number;
    compare?: Comparator<T>;
}

/**
 * Creates a type-safe sorting comparator for table data
 * Eliminates duplicate sorting logic and type safety issues
 */
export function createTableComparator<T>(
    columns: SortableColumn<T>[],
    descriptor: SortDescriptor
): Comparator<T> {
    const column = columns.find(c => c.id === descriptor.column);

    if (!column) {
        // Fallback: no sorting
        return () => 0;
    }

    // Use custom comparator if provided
    if (column.compare) {
        return (a, b) => {
            const result = column.compare!(a, b);
            return descriptor.direction === 'ascending' ? result : -result;
        };
    }

    // Default comparator based on extracted values
    return (a, b) => {
        const aVal = column.getValue(a);
        const bVal = column.getValue(b);

        let result = 0;
        if (aVal < bVal) result = -1;
        else if (aVal > bVal) result = 1;

        return descriptor.direction === 'ascending' ? result : -result;
    };
}

/**
 * Generic sorting function for arrays
 * More efficient than Array.sort for stable sorting
 */
export function sortArray<T>(
    array: T[],
    comparator: Comparator<T>
): T[] {
    // Use native sort (V8 uses TimSort which is stable)
    return [...array].sort(comparator);
}

/**
 * Helper to create a comparator for numeric values
 */
export function compareNumbers(a: number, b: number): number {
    return a - b;
}

/**
 * Helper to create a comparator for string values (case-insensitive)
 */
export function compareStrings(a: string, b: string): number {
    return a.toLowerCase().localeCompare(b.toLowerCase());
}
