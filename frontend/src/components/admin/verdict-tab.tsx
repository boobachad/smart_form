import { useState, useMemo, useEffect } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, GraduationCap, Ban, Lock, CheckCircle, XCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { TablePagination } from "./table-pagination";
import { type Candidate } from '@/types';
import { useTableState } from "@/hooks/use-table-state";
import { createTableComparator, type SortableColumn } from "@/lib/table-sorting";
import { apiRequest } from "@/lib/auth-client";


// Eligibility Rule Type (always minimum requirement: >=)
type EligibilityRule = {
    id: string;
    fieldId: string;
    metric: string; // 'rating', 'count', 'value'
    threshold: number;
};

// Sortable columns for type-safe sorting
const sortableColumns: SortableColumn<Candidate & { isEligible: boolean }>[] = [
    { id: 'id', getValue: (c) => Number(c.id) },
    { id: 'name', getValue: (c) => c.name },
];

// The Verdict Tab decides ELIGIBILITY based on multi-field criteria
export const VerdictTab = ({ formId }: { formId?: string }) => {
    const [candidatesData, setCandidatesData] = useState<Candidate[]>([]);
    const [formSchema, setFormSchema] = useState<import("@/lib/types").FormField[]>([]);

    useEffect(() => {
        if (!formId) return;
        const loadData = async () => {
            try {
                const subsRes = await apiRequest(`/forms/${formId}/submissions`) as Record<string, any>;
                setCandidatesData(subsRes.submissions || []);

                const formRes = await apiRequest(`/forms/${formId}/manage`) as Record<string, any>;
                if (formRes.form && formRes.form.fields) {
                    setFormSchema(formRes.form.fields);
                }
            } catch (err) { console.error(err); }
        };
        loadData();
    }, [formId]);

    const [rules, setRules] = useState<EligibilityRule[]>([
        // Initialize empty or fetch saved rules
    ]);

    const [sOverrides, setSOverrides] = useState<Record<number, 'eligible' | 'ineligible'>>({});
    const [statusFilter, setStatusFilter] = useState('all');

    const setOverride = (id: number, status: 'eligible' | 'ineligible') => {
        setSOverrides(prev => ({ ...prev, [id]: status }));
    };

    const clearOverride = (id: number) => {
        const next = { ...sOverrides };
        delete next[id];
        setSOverrides(next);
    };

    // Add/Remove Rules
    const addRule = ({ fieldId, metric }: { fieldId: string; metric: string }) => {
        const defaultThreshold = metric === 'rating' ? 1600 : 200;
        setRules([...rules, {
            id: Date.now().toString(),
            fieldId,
            metric,
            threshold: defaultThreshold
        }]);
    };

    const removeRule = (id: string) => {
        setRules(rules.filter(r => r.id !== id));
    };

    const updateRule = (id: string, updates: Partial<EligibilityRule>) => {
        setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const platforms = useMemo(() => {
        interface Platform {
            id: string;
            name: string;
            icon: string;
            metrics: Array<{ id: string; label: string; metric: string }>;
        }

        const platformMap = new Map<string, Platform>();

        formSchema
            .filter((f: import("@/lib/types").FormField) => f.type === 'smart_field')
            .forEach((field: import("@/lib/types").FormField) => {
                const fieldId = field.id;
                let platformId: string | null = null;
                let platformName = '';
                let platformIcon = '';
                let metricLabel = '';
                let metricType = '';

                if (fieldId.includes('leetcode')) {
                    platformId = 'leetcode';
                    platformName = 'LeetCode';
                    platformIcon = '💻';
                    metricLabel = fieldId.includes('rating') || field.verification_config?.targets?.includes('rating') ? 'Rating' : 'Solved';
                    metricType = fieldId.includes('rating') || field.verification_config?.targets?.includes('rating') ? 'rating' : 'count';
                } else if (fieldId.includes('codeforces')) {
                    platformId = 'codeforces';
                    platformName = 'Codeforces';
                    platformIcon = '🏆';
                    metricLabel = 'Rating';
                    metricType = 'rating';
                } else if (fieldId.includes('github')) {
                    platformId = 'github';
                    platformName = 'GitHub';
                    platformIcon = '🐙';
                    metricLabel = 'Followers';
                    metricType = 'count';
                }

                if (platformId) {
                    if (!platformMap.has(platformId)) {
                        platformMap.set(platformId, {
                            id: platformId,
                            name: platformName,
                            icon: platformIcon,
                            metrics: []
                        });
                    }
                    platformMap.get(platformId)!.metrics.push({
                        id: fieldId,
                        label: metricLabel || field.label,
                        metric: metricType
                    });
                }
            });

        return Array.from(platformMap.values());
    }, [formSchema]);


    const processedData = useMemo(() => {
        if (!candidatesData || candidatesData.length === 0) return [];

        return candidatesData.map((respondent: Candidate) => {
            const rulesPass = rules.every(rule => {
                const fieldData = respondent.verification_result?.field_results?.[rule.fieldId];
                const claimedData = respondent.snapshot?.[rule.fieldId];

                let value: number;
                if (rule.metric === 'rating') {
                    value = fieldData?.verified_metrics?.rating ?? claimedData?.stats?.rating ?? 0;
                } else if (rule.metric === 'count') {
                    value = fieldData?.verified_metrics?.count ?? claimedData?.stats?.count ?? 0;
                } else {
                    value = fieldData?.verified_value ?? claimedData?.value ?? 0;
                }

                // Always use >= (minimum requirement)
                return value >= rule.threshold;
            });

            const calculatedEligible = rules.length > 0 ? rulesPass : true;

            const overrideStatus = sOverrides[Number(respondent.id)];
            const isOverridden = overrideStatus !== undefined;
            const isEligible = isOverridden ? (overrideStatus === 'eligible') : calculatedEligible;

            return {
                ...respondent,
                isEligible,
                isOverridden,
                overrideStatus
            };
        });
    }, [candidatesData, rules, sOverrides]);

    const table = useTableState<Candidate & { isEligible: boolean; isOverridden?: boolean }>({
        data: processedData,
        filterFn: (item, text) => {
            const lower = text.toLowerCase();
            const matchesText = item.name.toLowerCase().includes(lower) || String(item.id).includes(lower);

            // Apply statusFilter
            if (statusFilter === 'eligible') return matchesText && item.isEligible;
            if (statusFilter === 'ineligible') return matchesText && !item.isEligible;
            return matchesText;
        },
        sortFn: (a, b, descriptor) => {
            const comparator = createTableComparator(sortableColumns, descriptor);
            return comparator(a, b);
        },
    });

    const eligibleCount = processedData.filter((d: unknown) => (d as { isEligible: boolean }).isEligible).length;
    const ineligibleCount = processedData.filter((d: unknown) => !(d as { isEligible: boolean }).isEligible).length;

    // Bulk Actions
    const handleBulkMarkEligible = () => {
        table.selectedItems.forEach((c: unknown) => setOverride(Number((c as { id: string | number }).id), 'eligible'));
        table.clearSelection();
    };

    const handleBulkMarkIneligible = () => {
        table.selectedItems.forEach((c: unknown) => setOverride(Number((c as { id: string | number }).id), 'ineligible'));
        table.clearSelection();
    };

    const handleBulkClearOverrides = () => {
        table.selectedItems.forEach((c: unknown) => clearOverride(Number((c as { id: string | number }).id)));
        table.clearSelection();
        toast.success(`Cleared overrides for ${table.selectedItems.length} candidate(s)`);
    };

    return (
        <div className="space-y-6">

            <div className="relative mb-8 p-8 rounded-3xl border border-violet-500/20 shadow-2xl overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 blur-[100px] rounded-full pointer-events-none group-hover:bg-violet-500/30" />
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent dark: dark: mb-2">
                        Verdict Control_
                    </h1>
                    <p className="text-muted-foreground/80 font-mono uppercase tracking-widest text-sm">
                        Automated Eligibility & Compliance Engine
                    </p>
                </div>
            </div>

            <div className="bg-card/50 p-6 rounded-2xl border-2 border-primary/10 hover:border-primary/30 shadow-xl shadow-indigo-500/5 space-y-6 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-foreground">Eligibility Criteria</div>
                            <div className="text-xs text-muted-foreground">Click fields below to add criteria • All conditions must be met</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="text-2xl font-bold text-[var(--color-success-fg)]">{eligibleCount}</div>
                                <div className="text-xs text-muted-foreground">Eligible</div>
                            </div>
                            <div className="h-6 w-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className="text-2xl font-bold text-[var(--color-error-fg)]">{ineligibleCount}</div>
                                <div className="text-xs text-muted-foreground">Ineligible</div>
                            </div>
                        </div>
                    </div>

                    {rules.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Criteria • Minimum Requirements</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {rules.map((rule) => {
                                    // Find the platform and metric for this rule
                                    let fieldLabel = '';
                                    let metricLabel = '';

                                    for (const platform of platforms) {
                                        const metric = platform.metrics.find(m => m.id === rule.fieldId);
                                        if (metric) {
                                            fieldLabel = platform.name;
                                            metricLabel = metric.label;
                                            break;
                                        }
                                    }

                                    return (
                                        <div key={rule.id} className="group relative flex items-center justify-between gap-3 p-4 bg-background/50 border border-primary/20 hover:border-primary/50 rounded-xl shadow-sm hover:shadow-md backdrop-blur-md">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-foreground truncate">
                                                    {fieldLabel}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                    {metricLabel} ≥
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    value={rule.threshold}
                                                    onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                                                    className="h-9 w-24 px-3 text-lg font-bold text-center border-2 border-primary/30 dark:border-primary/40 bg-background focus-visible:ring-primary/50 focus-visible:border-primary"
                                                />
                                                <button
                                                    onClick={() => removeRule(rule.id)}
                                                    className="opacity-0 group-hover:opacity-100 absolute top-1 right-1"
                                                >
                                                    <XCircle className="w-4 h-4 text-destructive hover:text-destructive/80" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Available Platforms {rules.length > 0 && '• Click to add more'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {platforms.map(platform => {
                                return (
                                    <div key={platform.id} className="p-4 rounded-xl border border-white/10 bg-black/5 dark:bg-white/5 hover:bg-primary/5 hover:border-primary/50 hover:scale-[1.02] group/card shadow-lg hover:shadow-primary/20 cursor-pointer">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">{platform.icon}</span>
                                            <div className="text-sm font-bold text-foreground">{platform.name}</div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            {platform.metrics.map(metric => {
                                                const isAdded = rules.some(r => r.fieldId === metric.id);
                                                const isRating = metric.metric === 'rating';

                                                return (
                                                    <button
                                                        key={metric.id}
                                                        onClick={() => !isAdded && addRule({ fieldId: metric.id, metric: metric.metric })}
                                                        disabled={isAdded}
                                                        className={`w-full px-3 py-1.5 text-xs font-medium rounded ${isAdded ? 'bg-muted/50 text-muted-foreground cursor-not-allowed' : isRating ? 'bg-[var(--color-info-subtle)] text-[var(--color-info-fg)] hover:bg-[var(--color-info-muted)]' : 'bg-[var(--color-success-subtle)] text-[var(--color-success-fg)] hover:bg-[var(--color-success-muted)]'}`}
                                                    >
                                                        {metric.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {table.selectionCount > 0 && (
                <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg p-3 flex items-center justify-between animate-in slide-in-">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{table.selectionCount} candidate(s) selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={handleBulkMarkEligible}
                            className="h-8 bg-[var(--color-success)] hover:bg-[var(--color-success-fg)]"
                        >
                            <CheckCircle className="w-3 h-3 mr-2" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            className="h-8"
                            onClick={handleBulkMarkIneligible}
                        >
                            <XCircle className="w-3 h-3 mr-2" />
                            Reject
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={handleBulkClearOverrides}
                        >
                            Clear Overrides
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={table.clearSelection}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* 2. The Decision Table */}
            <TableCard.Root>
                <TableCard.Header
                    title="Verdict Decisions"
                    badge={`${table.processedData.length} candidates`}
                    description="Review eligibility and set verdicts"
                    contentTrailing={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 border-r border-border pr-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Candidates</SelectItem>
                                        <SelectItem value="eligible">Eligible Only</SelectItem>
                                        <SelectItem value="ineligible">Ineligible Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Input
                                placeholder="Search by name or ID..."
                                value={table.filterText}
                                onChange={(e) => { table.setFilterText(e.target.value); table.resetToFirstPage(); }}
                                className="h-8 w-[200px]"
                            />
                            <Button variant="outline" size="sm" className="h-8 border-[var(--color-success-border)] text-[var(--color-success-fg)] hover:bg-[var(--color-success-subtle)]">
                                <Download className="w-3 h-3 mr-2" /> Export
                            </Button>
                        </div>
                    }
                />

                <Table
                    aria-label="Verdict Decisions"
                    selectionMode="multiple"
                    selectionBehavior="toggle"
                    selectedKeys={table.selectedKeys}
                    onSelectionChange={table.setSelectedKeys}
                    sortDescriptor={table.sortDescriptor}
                    onSortChange={table.setSortDescriptor}
                >
                    <Table.Header>
                        <Table.Head id="id" label="Roll No" allowsSorting />
                        <Table.Head id="name" label="Student Name" allowsSorting />
                        <Table.Head id="verdict" label="Verdict" />
                        <Table.Head id="actions" label="Actions" />
                    </Table.Header>
                    <Table.Body>
                        {table.paginatedData.map((studentItem: unknown) => {
                            const student = studentItem as Record<string, any>;
                            return (
                                <Table.Row
                                    key={student.id}
                                    id={String(student.id)}
                                    className={student.isOverridden ? "bg-warning/5 hover:bg-warning/10 dark:bg-warning/10 dark:hover:bg-warning/20" : ""}
                                >
                                    <Table.Cell className="font-mono text-muted-foreground">{student.id}</Table.Cell>
                                    <Table.Cell className="font-medium">
                                        {student.name}
                                        {student.isOverridden && (
                                            <span className="ml-2 text-[10px] text-warning dark:text-warning font-bold uppercase tracking-wider border border-warning/20 dark:border-warning/50 px-1 rounded bg-warning/10 dark:bg-warning/20">
                                                Manual
                                            </span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Select
                                            value={student.isEligible ? 'eligible' : 'ineligible'}
                                            onValueChange={(val: 'eligible' | 'ineligible') => setOverride(Number(student.id), val)}
                                        >
                                            <SelectTrigger className={`w-[140px] h-8 text-xs font-bold rounded-full border-2 ${student.isEligible ? 'bg-emerald-100 border-emerald-500 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-100' : 'bg-rose-100 border-rose-500 text-rose-800 dark:bg-rose-900/30 dark:border-rose-500 dark:text-rose-100'}`}>
                                                <div className="flex items-center gap-2">
                                                    {student.isEligible
                                                        ? (student.isOverridden ? <Lock className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />)
                                                        : <Ban className="w-3 h-3" />
                                                    }
                                                    <SelectValue />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="eligible">Eligible</SelectItem>
                                                <SelectItem value="ineligible">Ineligible</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {student.isOverridden && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                title="Reset to Calculated"
                                                onClick={() => clearOverride(Number(student.id))}
                                            >
                                                <span className="text-xs font-bold">✕</span>
                                            </Button>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            );
                        })}
                    </Table.Body>
                </Table>

                <TablePagination
                    page={table.page}
                    totalPages={table.totalPages}
                    pageSize={table.pageSize}
                    totalItems={table.processedData.length}
                    selectionCount={table.selectionCount}
                    onPageChange={table.setPage}
                    onPageSizeChange={table.setPageSize}
                />
            </TableCard.Root>
        </div>
    );
};
