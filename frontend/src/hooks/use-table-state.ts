import { useState, useMemo } from 'react';
import type { Selection, SortDescriptor } from 'react-aria-components';

/**
 * Configuration for table state hook
 */
export interface UseTableStateConfig<T> {
    data: T[];
    initialPageSize?: number;
    initialPage?: number;
    idProperty?: keyof T;
    filterFn?: (item: T, filterText: string) => boolean;
    sortFn?: (a: T, b: T, descriptor: SortDescriptor) => number;
}

/**
 * Return type for useTableState hook
 */
export interface UseTableStateReturn<T> {
    // Data
    processedData: T[];
    paginatedData: T[];
    selectedItems: T[];

    // State
    selectedKeys: Selection;
    setSelectedKeys: (keys: Selection) => void;
    sortDescriptor: SortDescriptor;
    setSortDescriptor: (descriptor: SortDescriptor) => void;
    page: number;
    setPage: (page: number | ((prev: number) => number)) => void;
    pageSize: number;
    setPageSize: (size: number) => void;
    filterText: string;
    setFilterText: (text: string) => void;

    // Computed
    totalPages: number;
    selectionCount: number;

    // Helpers
    clearSelection: () => void;
    resetToFirstPage: () => void;
}

/**
 * Reusable hook for managing table state (filtering, sorting, pagination, selection)
 * Eliminates 100+ lines of duplicate code across admin tabs
 */
export function useTableState<T extends Record<string, any>>(
    config: UseTableStateConfig<T>
): UseTableStateReturn<T> {
    const {
        data,
        initialPageSize = 10,
        initialPage = 1,
        idProperty = 'id' as keyof T,
        filterFn,
        sortFn,
    } = config;

    // State
    const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: String(idProperty),
        direction: 'ascending',
    });
    const [page, setPage] = useState(initialPage);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [filterText, setFilterText] = useState('');

    const processedData = useMemo(() => {
        let result = [...data];

        // Apply filter
        if (filterText && filterFn) {
            result = result.filter(item => filterFn(item, filterText));
        }

        // Apply sort
        if (sortDescriptor.column && sortFn) {
            result.sort((a, b) => sortFn(a, b, sortDescriptor));
        }

        return result;
    }, [data, filterText, sortDescriptor, filterFn, sortFn]);

    const totalPages = Math.ceil(processedData.length / pageSize);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, page, pageSize]);

    const selectedItems = useMemo(() => {
        if (selectedKeys === 'all') return paginatedData;
        return paginatedData.filter(item =>
            (selectedKeys as Set<string>).has(String(item[idProperty]))
        );
    }, [selectedKeys, paginatedData, idProperty]);

    // Computed values
    const selectionCount =
        selectedKeys === 'all'
            ? paginatedData.length
            : (selectedKeys as Set<string>).size;

    // Helper functions
    const clearSelection = () => setSelectedKeys(new Set());
    const resetToFirstPage = () => setPage(1);

    return {
        // Data
        processedData,
        paginatedData,
        selectedItems,

        // State
        selectedKeys,
        setSelectedKeys,
        sortDescriptor,
        setSortDescriptor,
        page,
        setPage,
        pageSize,
        setPageSize,
        filterText,
        setFilterText,

        // Computed
        totalPages,
        selectionCount,

        // Helpers
        clearSelection,
        resetToFirstPage,
    };
}
