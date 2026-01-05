import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Candidate } from '@/types';

interface ExportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    candidates: Candidate[];
    formSchema: import("@/lib/types").FormField[];
    overrides: Record<string, 'ELIGIBLE' | 'INELIGIBLE'>;
    evaluateEligibility: (c: Candidate, schema: import("@/lib/types").FormField[], override?: 'ELIGIBLE' | 'INELIGIBLE') => { status: 'ELIGIBLE' | 'INELIGIBLE' };
}

export function ExportModal({ open, onOpenChange, candidates, formSchema, overrides, evaluateEligibility }: ExportModalProps) {
    const [exportType, setExportType] = useState<'all' | 'eligible' | 'ineligible' | 'flagged'>('all');
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(formSchema.map(f => f.id)));

    // Generate field options from schema
    const fieldOptions = useMemo(() => {
        const fields: { id: string; label: string }[] = [];

        formSchema.forEach(field => {
            if (field.type === 'smart_field') {
                fields.push({ id: `${field.id}_value`, label: field.label });
                const metrics = field.verification_config?.targets || [];
                metrics.forEach((metric: string) => {
                    fields.push({ id: `${field.id}_${metric}`, label: `${field.label} (${metric})` });
                });
            } else {
                fields.push({ id: field.id, label: field.label });
            }
        });

        return fields;
    }, [formSchema]);

    const toggleField = (fieldId: string) => {
        const next = new Set(selectedFields);
        if (next.has(fieldId)) {
            next.delete(fieldId);
        } else {
            next.add(fieldId);
        }
        setSelectedFields(next);
    };

    // Select/Deselect all
    const toggleAll = () => {
        if (selectedFields.size === fieldOptions.length) {
            setSelectedFields(new Set());
        } else {
            setSelectedFields(new Set(fieldOptions.map(f => f.id)));
        }
    };

    const handleExport = () => {
        // Filter by eligibility
        let exportData = candidates;
        if (exportType === 'eligible') {
            exportData = candidates.filter(c => evaluateEligibility(c, formSchema, overrides[c.id]).status === 'ELIGIBLE');
        } else if (exportType === 'ineligible') {
            exportData = candidates.filter(c => evaluateEligibility(c, formSchema, overrides[c.id]).status === 'INELIGIBLE');
        } else if (exportType === 'flagged') {
            exportData = candidates.filter(c => c.flag_status === 'flagged');
        }

        if (exportData.length === 0) {
            toast.error("No entries to export");
            return;
        }

        if (selectedFields.size === 0) {
            toast.error("Please select at least one field");
            return;
        }

        const selectedFieldsList = fieldOptions.filter(f => selectedFields.has(f.id));
        const headers = ['#', ...selectedFieldsList.map(f => f.label), 'Verdict'];

        // Build rows
        const rows = exportData.map((c, idx) => {
            const verdict = evaluateEligibility(c, formSchema, overrides[c.id]).status;

            const fieldValues = selectedFieldsList.map(f => {
                const parts = f.id.split('_');
                const fieldId = parts.slice(0, -1).join('_');
                const suffix = parts[parts.length - 1];

                const snapshot = c.snapshot?.[fieldId];

                if (suffix === 'value') {
                    return snapshot?.value || snapshot || '';
                } else if (['rating', 'solved', 'followers', 'ranking', 'contributions'].includes(suffix)) {
                    const verified = c.verification_result?.field_results?.[fieldId]?.verified_metrics?.[suffix];
                    const claimed = snapshot?.stats?.[suffix];
                    return verified ?? claimed ?? '';
                } else {
                    const val = c.snapshot?.[f.id];
                    if (typeof val === 'object' && val?.value) return val.value;
                    return val || '';
                }
            });

            return [idx + 1, ...fieldValues, verdict];
        });

        // Generate CSV
        const csv = [
            headers.join(','),
            ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `responses-${exportType}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Exported ${exportData.length} entries`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Export Responses
                    </DialogTitle>
                    <DialogDescription>
                        Configure what data to export as CSV.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Eligibility Filter */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Filter by Status</Label>
                        <RadioGroup value={exportType} onValueChange={(v: 'all' | 'eligible' | 'ineligible' | 'flagged') => setExportType(v)} className="flex flex-wrap gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="all" id="all" />
                                <Label htmlFor="all" className="text-sm">All Entries</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="eligible" id="eligible" />
                                <Label htmlFor="eligible" className="text-sm text-emerald-600">Eligible Only</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ineligible" id="ineligible" />
                                <Label htmlFor="ineligible" className="text-sm text-red-600">Ineligible Only</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="flagged" id="flagged" />
                                <Label htmlFor="flagged" className="text-sm text-warning">Flagged Only</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Select Fields to Export</Label>
                            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                                {selectedFields.size === fieldOptions.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-muted/30">
                            {fieldOptions.map(field => (
                                <div key={field.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={field.id}
                                        checked={selectedFields.has(field.id)}
                                        onCheckedChange={() => toggleField(field.id)}
                                    />
                                    <Label htmlFor={field.id} className="text-xs truncate" title={field.label}>
                                        {field.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {selectedFields.size} of {fieldOptions.length} fields selected
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleExport} className="gap-2">
                        <Download className="w-4 h-4" />
                        Export CSV
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
