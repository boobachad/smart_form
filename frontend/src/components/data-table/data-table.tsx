"use client"

import * as React from "react"
import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
    type Row,
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    getExpandedRowModel,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ErrorDisplay } from "@/components/ui/error-display"
import { cx } from "@/lib/utils/cx"

import { SmartTablePagination } from "./data-table-pagination"
import { SmartTableToolbar } from "./data-table-toolbar"

interface SmartTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    /**
     * Render function for the expanded row content (Deep Inspection).
     */
    renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement
    /**
      * Optional children to render in the toolbar (like a "Request Correction" button)
      */
    toolbarActions?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
    /**
      * Controlled Row Selection State (Optional)
      */
    rowSelection?: Record<string, boolean>
    onRowSelectionChange?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export function SmartTable<TData, TValue>({
    columns,
    data,
    renderSubComponent,
    toolbarActions,
    rowSelection: controlledRowSelection,
    onRowSelectionChange: controlledOnRowSelectionChange
}: SmartTableProps<TData, TValue>) {
    const [internalRowSelection, setInternalRowSelection] = React.useState({})
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [expanded, setExpanded] = React.useState({})

    const rowSelection = controlledRowSelection ?? internalRowSelection
    const setRowSelection = controlledOnRowSelectionChange ?? setInternalRowSelection

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            expanded,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onExpandedChange: setExpanded,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        getExpandedRowModel: getExpandedRowModel(),
        getRowCanExpand: () => true,
    })

    return (
        <div className="space-y-4">
            <SmartTableToolbar table={table} >
                {toolbarActions ? toolbarActions(table) : null}
            </SmartTableToolbar>
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            className={cx(
                                                "sticky top-0 z-30 bg-background/95 backdrop-blur shadow-sm", // Sticky Header Styles
                                                (header.column.columnDef.meta as { headerClassName?: string })?.headerClassName
                                            )}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <React.Fragment key={row.id}>
                                    <TableRow
                                        data-state={row.getIsSelected() && "selected"}
                                        className={renderSubComponent ? "cursor-pointer" : ""}
                                        onClick={renderSubComponent ? row.getToggleExpandedHandler() : undefined}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className={(cell.column.columnDef.meta as { cellClassName?: string })?.cellClassName}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {row.getIsExpanded() && renderSubComponent && (
                                        <TableRow>
                                            <TableCell colSpan={row.getVisibleCells().length} className="p-0 bg-muted/30">
                                                {renderSubComponent({ row })}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="p-0 border-b-0 h-48">
                                    <ErrorDisplay type="empty" message="No results found." />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <SmartTablePagination table={table} />
        </div>
    )
}
