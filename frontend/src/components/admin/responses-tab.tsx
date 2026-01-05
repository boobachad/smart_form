import { useState, useEffect, useMemo } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Loader2, AlertCircle, Layers, Play, ArrowRight, GraduationCap, Ban, Lock, RotateCcw, Trash2, Download, AlertTriangle, CheckCircle2, X, Link2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CorrectionModal } from "./correction-config-modal";
import { ExportModal } from "./export-modal";
import { VerificationConfigModal } from "./verification-config-modal";
import { TablePagination } from "./table-pagination";
import { type Candidate } from '@/types';
import { cn } from "@/lib/utils";
import { ErrorDisplay } from "@/components/ui/error-display";
import { apiRequest } from "@/lib/auth-client";
import { useTableState } from "@/hooks/use-table-state";
import { useJobPolling } from "@/hooks/use-job-polling";
import { createTableComparator, type SortableColumn } from "@/lib/table-sorting";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const evaluateEligibility = (candidate: Candidate, formSchema: any[], override?: 'ELIGIBLE' | 'INELIGIBLE'): { status: 'ELIGIBLE' | 'INELIGIBLE', isProvisional: boolean, isOverridden: boolean } => {
    if (override) {
        return { status: override, isProvisional: false, isOverridden: true };
    }

    const smartFields = formSchema.filter(f => f.type === 'smart_field' && f.logic?.criteria);
    let isProvisional = false;

    for (const field of smartFields) {
        if (!field.logic?.criteria) continue;

        const fieldResult = candidate.verification_result?.field_results?.[field.id];
        const claimedSnapshot = candidate.snapshot[field.id];

        const hasVerifiedData = fieldResult && fieldResult.verified_metrics;
        if (!hasVerifiedData) {
            isProvisional = true;
        }

        for (const criterion of field.logic.criteria) {
            let value = 0;

            if (hasVerifiedData && fieldResult.verified_metrics && criterion.metric in fieldResult.verified_metrics) {
                value = fieldResult.verified_metrics[criterion.metric];
            } else if (claimedSnapshot?.stats && criterion.metric in claimedSnapshot.stats) {
                value = claimedSnapshot.stats[criterion.metric];
            } else if (claimedSnapshot?.value && typeof claimedSnapshot.value === 'number') {
                value = claimedSnapshot.value;
            }

            if (value < criterion.threshold) {
                return { status: 'INELIGIBLE', isProvisional, isOverridden: false };
            }
        }
    }
    return { status: 'ELIGIBLE', isProvisional, isOverridden: false };
};

const InteractiveVerdict = ({ candidate, formSchema, override, onOverride }: { candidate: Candidate, formSchema: any[], override?: 'ELIGIBLE' | 'INELIGIBLE', onOverride: (val: 'ELIGIBLE' | 'INELIGIBLE') => void }) => {
    const { status, isProvisional, isOverridden } = evaluateEligibility(candidate, formSchema, override);
    const isEligible = status === 'ELIGIBLE';

    return (
        <Select value={status} onValueChange={(val) => onOverride(val as 'ELIGIBLE' | 'INELIGIBLE')}>
            <SelectTrigger className={cn(
                "h-8 px-2 min-w-[140px] border shadow-sm  text-xs font-medium",
                isEligible
                    ? (isOverridden
                        ? "bg-warning/10 text-warning-foreground border-warning/30 dark:bg-warning/20 dark:text-warning dark:border-warning/50"
                        : (isProvisional ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" : "bg-[var(--color-success-muted)] text-[var(--color-success-fg)] border-[var(--color-success-border)]"))
                    : (isOverridden
                        ? "bg-warning/10 text-warning-foreground border-warning/30 dark:bg-warning/20 dark:text-warning dark:border-warning/50"
                        : "bg-[var(--color-error-muted)] text-[var(--color-error-fg)] border-[var(--color-error-border)]")
            )}>
                <div className="flex items-center gap-2">
                    {isOverridden ? <Lock className="w-3 h-3" /> : (isEligible ? <GraduationCap className="w-3 h-3" /> : <Ban className="w-3 h-3" />)}
                    <span className="truncate">
                        {isEligible ? "Eligible" : "Ineligible"}
                        {!isOverridden && isProvisional && " (Claimed)"}
                        {isOverridden && " (Manual)"}
                    </span>
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="ELIGIBLE">Eligible</SelectItem>
                <SelectItem value="INELIGIBLE">Ineligible</SelectItem>
            </SelectContent>
        </Select>
    );
};

type Job = {
    id: string;
    candidateIds: string[];
    targetFields: string[];
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED';
};

const SmartCellValue = ({ candidate, fieldId, metric, source }: { candidate: Candidate, fieldId: string, metric: string, source?: 'API' | 'MANUAL' }) => {
    const snapshotData = candidate.snapshot[fieldId];
    const verificationResult = candidate.verification_result?.field_results?.[fieldId];

    // Debug logging for verification result
    if (candidate.verification_result) {
        // Only log if we expect a result but don't find it for this field
        const hasResult = !!verificationResult;

        console.log(`[SmartCellValue] Admin Verification Check for ${fieldId}:`, {
            hasResult,
            allFieldKeys: Object.keys(candidate.verification_result.field_results || {}),
            thisFieldResult: verificationResult,
            outcome: verificationResult?.outcome
        });
    }

    // Extract value from snapshot (both SOURCE_API fetch and SOURCE_MANUAL are snapshot data)
    let displayValue = "-";

    // Debug logging to see data structure
    if (snapshotData) {
        console.log(`[SmartCellValue] fieldId=${fieldId} metric=${metric}`, {
            snapshotData,
            hasStats: !!snapshotData?.stats,
            statsValue: snapshotData?.stats?.[metric],
            value: snapshotData?.value,
            source: snapshotData?.meta?.source
        });
    }

    if (snapshotData?.stats?.[metric] !== undefined && snapshotData?.stats?.[metric] !== null) {
        displayValue = snapshotData.stats[metric];
    }
    // Fallback to snapshot value
    else if (snapshotData?.value) {
        displayValue = snapshotData.value;
    }

    // Determine Source from snapshot metadata
    const actualSource = snapshotData?.meta?.source || source;

    let sourceIcon = null;
    let sourceTooltip = "";

    if (actualSource === 'SOURCE_API' || actualSource === 'API') {
        sourceIcon = <Link2 className="w-3 h-3 text-blue-500" />;
        sourceTooltip = 'Fetched via API';
    } else if (actualSource === 'SOURCE_MANUAL' || actualSource === 'MANUAL') {
        sourceIcon = <Pencil className="w-3 h-3 text-warning" />;
        sourceTooltip = 'Manually Entered';
    }

    const SourceWrapper = ({ children }: { children: React.ReactNode }) => {
        if (!sourceIcon) return <>{children}</>;
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                            {sourceIcon}
                            {children}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{sourceTooltip}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    if (!verificationResult) {
        return (
            <SourceWrapper>
                <span className="text-muted-foreground">{displayValue}</span>
            </SourceWrapper>
        );
    }

    const verifiedVal = verificationResult.verified_metrics?.[metric] ?? verificationResult.verified_value;
    const outcome = verificationResult.outcome;

    let containerClass = "";
    let verifiedClass = "";
    let verifiedIcon = null;

    if (outcome === 'MATCH') {
        containerClass = "bg-[var(--color-success-subtle)] border border-[var(--color-success-border)]";
        verifiedClass = "text-[var(--color-success-fg)] font-medium";
    } else if (outcome === 'GROWTH') {
        containerClass = "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800";
        verifiedClass = "text-emerald-700 dark:text-emerald-400 font-bold";
        verifiedIcon = <ArrowRight className="w-3 h-3 rotate-[-45deg]" />;
    } else if (outcome === 'DISCREPANCY_DROP') {
        containerClass = "bg-[var(--color-error-subtle)] border border-[var(--color-error-border)]";
        verifiedClass = "text-[var(--color-error-fg)] font-bold";
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`flex items-center gap-2 whitespace-nowrap px-2 py-1 rounded ${containerClass}`}>
                        {sourceIcon}
                        <span className="text-muted-foreground text-sm">{displayValue}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className={`${verifiedClass} inline-flex items-center gap-1`}>
                            {verifiedVal}
                            {verifiedIcon}
                        </span>
                    </div>
                </TooltipTrigger>
                {sourceTooltip && <TooltipContent>{sourceTooltip}</TooltipContent>}
            </Tooltip>
        </TooltipProvider>
    );
};

const sortableColumns: SortableColumn<Candidate>[] = [
    { id: 'id', getValue: (c) => parseInt(c.id) },
    { id: 'submitted_at', getValue: (c) => new Date(c.submitted_at).getTime() },
];

interface ResponsesTabProps {
    formId?: string;
    exportModalOpen?: boolean;
    onExportModalChange?: (open: boolean) => void;
}

export const ResponsesTab = ({ formId, exportModalOpen = false, onExportModalChange }: ResponsesTabProps) => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [formSchema, setFormSchema] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = async () => {
        if (!formId) return;
        try {
            setIsLoading(true);
            const submissionsRes = await apiRequest(`/forms/${formId}/submissions`) as Record<string, any>;
            setCandidates(submissionsRes.submissions || []);

            // Also refresh schema in case configs changed
            const formRes = await apiRequest(`/forms/${formId}/manage`) as Record<string, any>;
            if (formRes.form && formRes.form.fields) {
                setFormSchema(formRes.form.fields);
            }
        } catch (err) {
            console.error("Failed to refresh", err);
            toast.error("Failed to refresh data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [formId]);

    const [jobQueue, setJobQueue] = useState<Job[]>([]);
    const [isQueueProcessing, setIsQueueProcessing] = useState(false);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
    const [correctionTarget, setCorrectionTarget] = useState<Candidate | null>(null);
    const [overrides, setOverrides] = useState<Record<string, 'ELIGIBLE' | 'INELIGIBLE'>>({});

    // Poll job status when currentJobId is set
    const { isWaiting, isCompleted, isFailed, error: jobError } = useJobPolling(currentJobId, {
        onComplete: async (status) => {
            toast.success("Verification Complete");
            await refreshData();
            setCurrentJobId(null);
        },
        onError: (error) => {
            toast.error("Verification Failed", { description: error });
            setCurrentJobId(null);
        }
    });
    const [filterDuplicates, setFilterDuplicates] = useState(false);

    const DUPLICATE_COLORS = [
        'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-700',
        'bg-green-100 text-green-900 border border-green-300 dark:bg-green-900/30 dark:text-green-100 dark:border-green-700',
        'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-900/30 dark:text-purple-100 dark:border-purple-700',
        'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-100 dark:border-orange-700',
        'bg-pink-100 text-pink-900 border border-pink-300 dark:bg-pink-900/30 dark:text-pink-100 dark:border-pink-700',
        'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-100 dark:border-cyan-700',
        'bg-warning/10 text-warning-foreground border border-warning/30 dark:bg-warning/20 dark:text-warning dark:border-warning/50',
        'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-700',
    ];
    const [filterFlagged, setFilterFlagged] = useState(false);
    const [filterEligible, setFilterEligible] = useState<'all' | 'eligible' | 'ineligible'>('all');

    const hasFlagged = useMemo(() => candidates.some(c => c.flag_status === 'flagged'), [candidates]);

    const duplicateGroups = useMemo(() => {
        const freq: Record<string, string[]> = {};

        // Build frequency map per field
        candidates.forEach(c => {
            formSchema.forEach(field => {
                if (field.type === 'smart_field') {
                    const username = c.snapshot?.[field.id]?.value || c.snapshot?.[field.id];
                    if (username && typeof username === 'string') {
                        const key = `${field.id}:${username.toLowerCase()}`;
                        if (!freq[key]) freq[key] = [];
                        freq[key].push(c.id);
                    }
                }
            });
        });

        // Build duplicate groups with colors
        const groups: Record<string, { ids: string[], color: string, count: number }> = {};
        let colorIndex = 0;

        Object.entries(freq)
            .filter(([_, ids]) => ids.length > 1)
            .sort((a, b) => b[1].length - a[1].length) // Sort by count descending
            .forEach(([key, ids]) => {
                groups[key] = {
                    ids,
                    color: DUPLICATE_COLORS[colorIndex % DUPLICATE_COLORS.length],
                    count: ids.length
                };
                colorIndex++;
            });

        return groups;
    }, [candidates, formSchema]);

    // Check if there are any duplicates at all
    const hasDuplicates = useMemo(() => Object.keys(duplicateGroups).length > 0, [duplicateGroups]);

    // Helper to check if a candidate has duplicates
    const hasDuplicateUsername = (candidateId: string) => {
        return (useMemo(() => {
            const freq: Record<string, string[]> = {};
            candidates.forEach(c => {
                formSchema.forEach(field => {
                    if (field.type === 'smart_field') {
                        const username = c.snapshot?.[field.id]?.value || c.snapshot?.[field.id];
                        if (username && typeof username === 'string') {
                            const key = `${field.id}:${username.toLowerCase()}`;
                            if (!freq[key]) freq[key] = [];
                            freq[key].push(c.id);
                        }
                    }
                });
            });
            const duplicateIds = new Set<string>();
            Object.values(freq).forEach(ids => {
                if (ids.length > 1) ids.forEach(id => duplicateIds.add(id));
            });
            return duplicateIds;
        }, [candidates, formSchema]) as Set<string>).has(candidateId);
    };

    // Get eligibility for filtering
    const getEligibilityStatus = (c: Candidate) => {
        return evaluateEligibility(c, formSchema, overrides[c.id]).status;
    };

    // Pre-filter and sort candidates
    const filteredCandidates = useMemo(() => {
        let result = candidates;

        if (filterDuplicates) {
            // Filter to only show duplicates
            const duplicateIds = new Set<string>();
            Object.values(duplicateGroups).forEach(group => {
                group.ids.forEach(id => duplicateIds.add(id));
            });
            result = result.filter(c => duplicateIds.has(c.id));

            const candidateToGroup = new Map<string, { key: string, count: number }>();

            Object.entries(duplicateGroups).forEach(([key, group]) => {
                group.ids.forEach(id => {
                    const existing = candidateToGroup.get(id);
                    if (!existing || group.count > existing.count) {
                        candidateToGroup.set(id, { key, count: group.count });
                    }
                });
            });

            result = [...result].sort((a, b) => {
                const groupA = candidateToGroup.get(a.id);
                const groupB = candidateToGroup.get(b.id);

                if (!groupA && !groupB) return 0;
                if (!groupA) return 1;
                if (!groupB) return -1;

                if (groupA.count !== groupB.count) {
                    return groupB.count - groupA.count;
                }
                return groupA.key.localeCompare(groupB.key);
            });
        }

        if (filterEligible !== 'all') {
            result = result.filter(c => {
                const status = evaluateEligibility(c, formSchema, overrides[c.id]).status;
                return filterEligible === 'eligible' ? status === 'ELIGIBLE' : status === 'INELIGIBLE';
            });
        }

        if (filterFlagged) {
            result = result.filter(c => c.flag_status === 'flagged');
        }

        return result;
    }, [candidates, formSchema, overrides, filterDuplicates, filterEligible, filterFlagged, duplicateGroups]);

    const handleOverride = (id: string, status: 'ELIGIBLE' | 'INELIGIBLE') => {
        setOverrides(prev => ({ ...prev, [id]: status }));
        toast.info(`Verdict Manually Updated`, {
            description: `Set Candidate #${id} to ${status === 'ELIGIBLE' ? 'Eligible' : 'Ineligible'}`
        });
    };

    const handleClearOverride = (id: string) => {
        const next = { ...overrides };
        delete next[id];
        setOverrides(next);
        toast.info(`Override Cleared`, { description: `Reverted #${id} to calculated status` });
    };

    const table = useTableState<Candidate>({
        data: filteredCandidates,
        filterFn: (c, text) => {
            if (!text) return true;
            const lower = text.toLowerCase();

            // Search in all snapshot values
            const snapshotValues = Object.values(c.snapshot || {}).map(v => {
                if (typeof v === 'string') return v;
                if (typeof v === 'object' && v !== null) {
                    if ('value' in v) return String(v.value);
                    // Handle stats objects
                    if ('stats' in v) return Object.values(v.stats || {}).join(' ');
                    return JSON.stringify(v);
                }
                return String(v);
            }).join(' ').toLowerCase();

            // Search in verification results
            const verificationValues = Object.values(c.verification_result?.field_results || {}).map((r: any) => {
                return JSON.stringify(r.verified_metrics || r.verified_value || '');
            }).join(' ').toLowerCase();

            return (
                c.name.toLowerCase().includes(lower) ||
                c.id.toLowerCase().includes(lower) ||
                (c.email || "").toLowerCase().includes(lower) || // Search By Email also
                snapshotValues.includes(lower) ||
                verificationValues.includes(lower)
            );
        },
        sortFn: (a, b, descriptor) => {
            const comparator = createTableComparator(sortableColumns, descriptor);
            return comparator(a, b);
        },
    });

    const { confirm, dialog: confirmDialog } = useConfirmDialog();

    const handleDeleteSelected = async () => {
        const selectedIds = table.selectedItems.map((c: Candidate) => c.id);
        if (selectedIds.length === 0) return;

        const confirmed = await confirm({
            title: "Delete Responses",
            description: `Are you sure you want to delete ${selectedIds.length} response(s)? This action cannot be undone.`,
            confirmText: "Delete",
            variant: "destructive",
        });

        if (!confirmed) return;

        try {
            await apiRequest(`/forms/${formId}/submissions`, {
                method: 'DELETE',
                body: JSON.stringify({ submission_ids: selectedIds })
            });
            toast.success(`Deleted ${selectedIds.length} response(s)`);
            table.clearSelection();
            refreshData();
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete responses");
        }
    };

    const handleQueueJob = (fieldIds: string[]) => {
        const selectedIds = table.selectedItems.map((c: Candidate) => c.id);
        const newJob: Job = {
            id: `job_${Date.now()}`,
            candidateIds: selectedIds,
            targetFields: fieldIds,
            status: 'PENDING'
        };

        setJobQueue(prev => [...prev, newJob]);
        table.clearSelection();
        setIsConfigOpen(false);

        toast.info(`Job Queued: ${selectedIds.length} Students`, {
            description: `Targeting: ${fieldIds.length} Field(s)`
        });
    };

    const handleRunImmediately = async (fieldIds: string[]) => {
        const selectedIds = table.selectedItems.map((c: Candidate) => c.id);
        table.clearSelection();
        setIsConfigOpen(false);

        toast.info(`Enqueuing Verification...`, {
            description: `Targeting ${selectedIds.length} candidate(s) across ${fieldIds.length} field(s).`
        });

        try {
            // Call async verification endpoint
            const response = await apiRequest(`/forms/${formId}/verify-async`, {
                method: 'POST',
                body: JSON.stringify({
                    submission_ids: selectedIds,
                    field_ids: fieldIds.length > 0 ? fieldIds : undefined,
                    priority: 'admin_now'
                })
            }) as Record<string, any>;

            // Start polling for this job
            setCurrentJobId(response.job_id);

            toast.success(`Verification Started`, {
                description: `Job queued with ${response.priority} priority`
            });
        } catch (err: any) {
            toast.error(`Failed to Enqueue Verification`, {
                description: err.message || 'Unknown error'
            });
        }
    };

    const processQueue = async () => {
        if (jobQueue.length === 0) return;
        setIsQueueProcessing(true);
        const jobs = [...jobQueue];
        for (const job of jobs) {
            await apiRequest(`/forms/${formId}/verify`, {
                method: 'POST',
                body: JSON.stringify({ candidate_ids: job.candidateIds, fields: job.targetFields })
            });
            setJobQueue(prev => prev.map(j => j.id === job.id ? { ...j, status: 'COMPLETED' } : j));
            toast.success(`Batch Processed`, { description: `Verified ${job.candidateIds.length} candidates.` });
        }

        // Refresh after queue is done
        await refreshData();

        setIsQueueProcessing(false);
        setJobQueue(prev => prev.filter(j => j.status !== 'COMPLETED'));
    };

    return (
        <>
            {confirmDialog}
            <div className="space-y-6">
                {jobQueue.length > 0 && (
                    <div className="bg-background border border-border rounded-lg p-3 flex items-center justify-between mb-4 shadow-sm animate-in slide-in-">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold">Verification Queue Active</h4>
                                <p className="text-xs text-muted-foreground">{jobQueue.filter(j => j.status === 'PENDING').length} batches pending processing.</p>
                            </div>
                        </div>
                        <Button size="sm" onClick={processQueue} disabled={isQueueProcessing}>
                            {isQueueProcessing ? <Loader2 className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 fill-current mr-2" />}
                            Run Drive
                        </Button>
                    </div>
                )}

                {candidates.length === 0 ? (
                    <ErrorDisplay type="empty" message="When users submit this form, their responses will appear here." />
                ) : (
                    <TableCard.Root className="w-full">
                        <TableCard.Header
                            title="Responses"
                            badge={`${table.processedData.length} entries`}
                            description="View and verify submissions"
                            contentTrailing={
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Filter Tags */}
                                    <div className="flex items-center gap-1">
                                        {hasDuplicates && (
                                            <Button
                                                size="sm"
                                                variant={filterDuplicates ? "default" : "outline"}
                                                className={cn("h-7 gap-1", filterDuplicates && "bg-warning hover:bg-warning/90 text-white")}
                                                onClick={() => { setFilterDuplicates(!filterDuplicates); table.resetToFirstPage(); }}
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                                Duplicates
                                                {filterDuplicates && <X className="w-3 h-3 ml-1" />}
                                            </Button>
                                        )}
                                        {hasFlagged && (
                                            <Button
                                                size="sm"
                                                variant={filterFlagged ? "default" : "outline"}
                                                className={cn("h-7 gap-1", filterFlagged && "bg-red-500 hover:bg-red-600 text-white")}
                                                onClick={() => { setFilterFlagged(!filterFlagged); table.resetToFirstPage(); }}
                                            >
                                                <AlertCircle className="w-3 h-3" />
                                                Flagged
                                                {filterFlagged && <X className="w-3 h-3 ml-1" />}
                                            </Button>
                                        )}
                                        <Select
                                            value={filterEligible}
                                            onValueChange={(v: 'all' | 'eligible' | 'ineligible') => { setFilterEligible(v); table.resetToFirstPage(); }}
                                        >
                                            <SelectTrigger className="h-7 w-[120px]">
                                                <SelectValue placeholder="Filter status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Entries</SelectItem>
                                                <SelectItem value="eligible">
                                                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Eligible</span>
                                                </SelectItem>
                                                <SelectItem value="ineligible">
                                                    <span className="flex items-center gap-1"><Ban className="w-3 h-3 text-red-500" /> Ineligible</span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="h-4 w-px bg-border" />

                                    {/* Search */}
                                    <Input
                                        placeholder="Search any field..."
                                        value={table.filterText}
                                        onChange={(e) => { table.setFilterText(e.target.value); table.resetToFirstPage(); }}
                                        className="h-8 w-[180px]"
                                    />

                                    {/* Selection Actions */}
                                    {table.selectionCount > 0 && (
                                        <>
                                            <div className="h-4 w-px bg-border" />
                                            <Button size="sm" onClick={() => setIsConfigOpen(true)} className="h-8">
                                                <ShieldCheck className="w-3 h-3 mr-2" />
                                                Verify ({table.selectionCount})
                                            </Button>
                                            <Button size="sm" variant="secondary" className="h-8" onClick={() => setIsCorrectionOpen(true)}>
                                                <AlertCircle className="w-3 h-3 mr-2" />
                                                Flag ({table.selectionCount})
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8" onClick={handleDeleteSelected}>
                                                <Trash2 className="w-3 h-3 mr-2" />
                                                Delete ({table.selectionCount})
                                            </Button>
                                        </>
                                    )}
                                </div>
                            }
                        />

                        <Table
                            aria-label="Student Responses"
                            selectionMode="multiple"
                            selectionBehavior="toggle"
                            selectedKeys={table.selectedKeys}
                            onSelectionChange={table.setSelectedKeys}
                            sortDescriptor={table.sortDescriptor}
                            onSortChange={table.setSortDescriptor}
                        >
                            <Table.Header>
                                <Table.Head id="Email" label="Email" allowsSorting isRowHeader />

                                {formSchema.map(field => {
                                    if (field.type === 'smart_field') {
                                        const metrics = field.verification_config?.targets;
                                        // First column: the username/value
                                        const usernameCol = (
                                            <Table.Head
                                                key={`${field.id}_value`}
                                                id={`${field.id}_value`}
                                                label={field.label}
                                            />
                                        );
                                        // Then metrics columns
                                        if (metrics && Array.isArray(metrics) && metrics.length > 0) {
                                            return [
                                                usernameCol,
                                                ...metrics.map((metric: string) => (
                                                    <Table.Head
                                                        key={`${field.id}_${metric}`}
                                                        id={`${field.id}_${metric}`}
                                                        label={`${field.label} (${metric})`}
                                                    />
                                                ))
                                            ];
                                        }
                                        return usernameCol;
                                    } else {
                                        return (
                                            <Table.Head
                                                key={field.id}
                                                id={field.id}
                                                label={field.label}
                                                allowsSorting
                                            />
                                        );
                                    }
                                })}

                                <Table.Head id="submitted_at" label="Submitted" allowsSorting />
                                <Table.Head id="verdict" label="Verdict" />
                                <Table.Head id="actions" label="Actions" />
                            </Table.Header>
                            <Table.Body>
                                {table.paginatedData.map((respondent: Candidate) => (
                                    <Table.Row key={respondent.id} id={respondent.id}>
                                        <Table.Cell><span className="font-mono text-xs">{respondent.email}</span></Table.Cell>
                                        {formSchema.map(field => {
                                            if (field.type === 'smart_field') {
                                                const metrics = field.verification_config?.targets;
                                                // Username/value cell - ensure we extract string value
                                                let usernameValue = '-';
                                                const snapshotData = respondent.snapshot?.[field.id];
                                                if (snapshotData) {
                                                    // If snapshot is an object with value or handle property
                                                    if (typeof snapshotData === 'object' && snapshotData !== null) {
                                                        usernameValue = snapshotData.value || snapshotData.handle || String(snapshotData);
                                                    } else {
                                                        usernameValue = String(snapshotData);
                                                    }
                                                }

                                                // Check if this username is part of a duplicate group
                                                const groupKey = `${field.id}:${String(usernameValue).toLowerCase()}`;
                                                const group = duplicateGroups[groupKey];

                                                const usernameCell = (
                                                    <Table.Cell key={`${field.id}_value`}>
                                                        <span className={cn(
                                                            "text-sm font-mono px-2 py-0.5 rounded",
                                                            group && filterDuplicates ? group.color : ''
                                                        )}>
                                                            {usernameValue}
                                                        </span>
                                                    </Table.Cell>
                                                );                                   // Metrics cells
                                                if (metrics && Array.isArray(metrics) && metrics.length > 0) {
                                                    return [
                                                        usernameCell,
                                                        ...metrics.map((metric: string) => (
                                                            <Table.Cell key={`${field.id}_${metric}`}>
                                                                <SmartCellValue candidate={respondent} fieldId={field.id} metric={metric} source={field.verification_config?.source} />
                                                            </Table.Cell>
                                                        ))
                                                    ];
                                                }
                                                return usernameCell;
                                            } else {
                                                const value = respondent.snapshot?.[field.id];
                                                return (
                                                    <Table.Cell key={field.id}>
                                                        <span className="text-sm">{value?.value || value || '-'}</span>
                                                    </Table.Cell>
                                                );
                                            }
                                        })}
                                        {/* Submitted At */}
                                        <Table.Cell>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {respondent.submitted_at ? new Date(respondent.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <InteractiveVerdict
                                                candidate={respondent}
                                                formSchema={formSchema}
                                                override={overrides[respondent.id]}
                                                onOverride={(val) => handleOverride(respondent.id, val)}
                                            />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    "h-8 w-8",
                                                                    respondent.flag_status === 'flagged'
                                                                        ? "text-warning bg-warning/5 hover:bg-warning/10 hover:text-warning"
                                                                        : "text-muted-foreground hover:text-destructive"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCorrectionTarget(respondent);
                                                                    table.clearSelection();
                                                                    table.setSelectedKeys(new Set([respondent.id]));
                                                                    setIsCorrectionOpen(true);
                                                                }}
                                                            >
                                                                <AlertCircle className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {respondent.flag_status === 'flagged' ? 'Edit Correction Request' : 'Request Correction'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>

                                                {overrides[respondent.id] && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-warning hover:text-warning hover:bg-warning/5" onClick={(e) => { e.stopPropagation(); handleClearOverride(respondent.id); }}>
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Reset to Calculated</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
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
                )}

                <VerificationConfigModal
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    selectedCount={table.selectedItems.length}
                    availableFields={formSchema.filter(f => f.type === 'smart_field').map(f => ({ id: f.id, label: f.label, platform: f.verification_config?.platform || 'Unknown', source: f.verification_config?.source }))}
                    onAddToQueue={handleQueueJob}
                    onRunImmediately={handleRunImmediately}
                />

                {isCorrectionOpen && (() => {
                    // Use correctionTarget for single click, or first selected for bulk
                    const targetCandidate = correctionTarget || (table.selectedItems[0] as Candidate | undefined);
                    const isEdit = !!correctionTarget && correctionTarget.flag_status === 'flagged';
                    const existingMessage = isEdit ? (correctionTarget?.flag_message || '') : '';
                    const existingFields = isEdit ? (correctionTarget?.flag_fields || []) : [];

                    return (
                        <CorrectionModal
                            isOpen={isCorrectionOpen}
                            count={table.selectedItems.length}
                            availableFields={formSchema.filter(f => f.type === 'smart_field').map(f => ({ id: f.id, label: f.label }))}
                            onClose={() => { setIsCorrectionOpen(false); setCorrectionTarget(null); }}
                            isEdit={isEdit}
                            existingMessage={existingMessage}
                            existingFields={existingFields}
                            onSubmit={async (message: string, fields: string[]) => {
                                try {
                                    const selectedIds = table.selectedItems.map((c: Candidate) => c.id);
                                    await apiRequest(`/forms/${formId}/submissions/flag`, {
                                        method: 'POST',
                                        body: JSON.stringify({
                                            submission_ids: selectedIds,
                                            message,
                                            fields
                                        })
                                    });
                                    toast.success("Correction Request Sent", {
                                        description: `Flagged ${selectedIds.length} submissions for correction.`
                                    });
                                    table.clearSelection();
                                    // Refresh data
                                    const submissionsRes = await apiRequest(`/forms/${formId}/submissions`) as Record<string, any>;
                                    setCandidates(submissionsRes.submissions || []);
                                } catch (err) {
                                    toast.error("Failed to flag submissions");
                                }
                            }}
                        />
                    );
                })()}

                {/* Export Modal - controlled by parent */}
                <ExportModal
                    open={exportModalOpen}
                    onOpenChange={onExportModalChange || (() => { })}
                    candidates={candidates}
                    formSchema={formSchema}
                    overrides={overrides}
                    evaluateEligibility={evaluateEligibility}
                />
            </div>
        </>
    );
};
