import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

interface SmartTableToolbarProps<TData> {
    table: Table<TData>;
    searchColumn?: string; // Column key to filter by (default: global filter logic)
    searchPlaceholder?: string;
    children?: React.ReactNode; // For extra actions like "Request Correction"
}

export function SmartTableToolbar<TData>({
    table,
    searchColumn,
    searchPlaceholder = "Filter...",
    children,
}: SmartTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0 || !!table.getState().globalFilter;

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                <Input
                    placeholder={searchPlaceholder}
                    value={
                        (searchColumn
                            ? (table.getColumn(searchColumn)?.getFilterValue() as string)
                            : (table.getState().globalFilter as string)
                        ) ?? ""
                    }
                    onChange={(event) => {
                        if (searchColumn) {
                            table.getColumn(searchColumn)?.setFilterValue(event.target.value)
                        } else {
                            table.setGlobalFilter(event.target.value)
                        }
                    }}
                    className="h-8 w-[150px] lg:w-[250px] bg-card text-foreground"
                />
                {isFiltered && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            table.resetColumnFilters()
                            table.setGlobalFilter("")
                        }}
                        className="h-8 px-2 lg:px-3"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
            <div className="flex items-center space-x-2">
                {children}
                <DataTableViewOptions table={table} />
            </div>
        </div>
    );
}
