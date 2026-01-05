import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Layers, Zap, PlusCircle, Link2, Pencil } from "lucide-react";

interface VerificationConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    availableFields: { id: string; label: string; platform: string; source?: 'API' | 'MANUAL' }[];
    onAddToQueue: (fieldIds: string[]) => void;
    onRunImmediately: (fieldIds: string[]) => void;
}

export const VerificationConfigModal = ({
    isOpen,
    onClose,
    selectedCount,
    availableFields,
    onAddToQueue,
    onRunImmediately
}: VerificationConfigModalProps) => {
    // Default to all selected
    const [selectedFields, setSelectedFields] = useState<string[]>(availableFields.map(f => f.id));

    const handleToggle = (id: string) => {
        setSelectedFields(prev =>
            prev.includes(id)
                ? prev.filter(f => f !== id)
                : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedFields.length === availableFields.length) {
            setSelectedFields([]);
        } else {
            setSelectedFields(availableFields.map(f => f.id));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Configure Verification Job
                    </DialogTitle>
                    <DialogDescription>
                        Define the scope for this verification batch.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="bg-muted/30 p-3 rounded-lg border border-border flex justify-between items-center">
                        <div className="text-sm font-medium">Target Scope</div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                            {selectedCount} Students Selected
                        </Badge>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Select Fields to Verify</Label>
                            <Button variant="link" size="sm" onClick={handleSelectAll} className="h-auto p-0 text-xs text-primary">
                                {selectedFields.length === availableFields.length ? "Deselect All" : "Select All"}
                            </Button>
                        </div>
                        <div className="grid gap-2">
                            {availableFields.map(field => (
                                <div key={field.id} className="flex items-center space-x-3 border border-border p-3 rounded-md hover:bg-muted/50">
                                    <Checkbox
                                        id={field.id}
                                        checked={selectedFields.includes(field.id)}
                                        onCheckedChange={() => handleToggle(field.id)}
                                    />
                                    <div className="grid gap-0.5 flex-1">
                                        <Label htmlFor={field.id} className="font-medium cursor-pointer">
                                            {field.label}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground capitalize">Platform: {field.platform}</span>
                                            {field.source && (
                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={field.source === 'API' ? 'Auto-verified via API' : 'Manual verification'}>
                                                    {field.source === 'API' ? <Link2 className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            onClick={() => onAddToQueue(selectedFields)}
                            disabled={selectedFields.length === 0}
                            className="flex-1 sm:flex-none"
                        >
                            <PlusCircle className="w-4 h-4 mr-2" /> Add to Queue
                        </Button>
                        <Button
                            onClick={() => onRunImmediately(selectedFields)}
                            disabled={selectedFields.length === 0}
                            className="flex-1 sm:flex-none"
                        >
                            <Zap className="w-4 h-4 mr-2" /> Run Now
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
