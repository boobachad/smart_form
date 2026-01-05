import React from 'react';
import { Trash2, Copy, GripVertical, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FusedGroup, FusedInput, FusedLabel } from '@/components/ui/fused-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';


export const FieldCard = ({ field, index, onUpdate, onDelete, onDuplicate, dragHandleProps, isActive, onSelect }: any) => {

    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newLabel = e.target.value;
        const updates: Record<string, any> = { label: newLabel };

        // Auto-detect platform for Smart Fields
        if (field.type === 'smart_field') {
            const lower = newLabel.toLowerCase();
            let detectedPlatform = null;
            if (lower.includes('leetcode')) detectedPlatform = 'leetcode';
            else if (lower.includes('codeforces')) detectedPlatform = 'codeforces';
            else if (lower.includes('github')) detectedPlatform = 'github';

            // Only update if detected and different from current
            if (detectedPlatform && field.verification_config?.platform !== detectedPlatform) {
                updates.verification_config = {
                    ...field.verification_config,
                    platform: detectedPlatform,
                    enable_client_fetch: field.verification_config?.enable_client_fetch ?? true,
                    targets: [] // Reset targets on platform switch
                };
                updates.logic = { criteria: [] }; // Reset logic on platform switch
            }
        }

        onUpdate(field.id, updates);
    };

    const isSmartField = field.type === 'smart_field';

    return (
        <div
            onClick={onSelect}
            className={`group relative bg-card rounded-xl border-2 cursor-pointer overflow-hidden ${isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/40 hover:shadow-sm' }`}
        >
            {/* Subtle background for smart fields */}
            {isSmartField && !isActive && (
                <div className="absolute inset-0 bg-primary/5 dark:bg-primary/10 pointer-events-none" />
            )}

            {/* Header */}
            <div className={`relative flex items-center justify-between p-4 border-b ${isActive ? 'border-primary/20 bg-primary/5' : isSmartField ? 'border-primary/20 dark:border-primary/30' : 'border-border' }`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Question number */}
                    <div className={`shrink-0 ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground' } text-xs font-bold px-3 py-1.5 rounded-lg font-mono`}>
                        Q{index + 1}
                    </div>

                    {/* Field type badge */}
                    <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isSmartField ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground' }`}>
                        {isSmartField && <Sparkles className="h-3.5 w-3.5" />}
                        <span className="capitalize">{field.type === 'smart_field' ? 'Smart Field' : field.type}</span>
                    </div>
                </div>

                {/* Action buttons with drag handle */}
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate();
                        }}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                    <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-2 rounded-lg hover:bg-muted/50">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content area */}
            <div className="relative p-5 space-y-4">
                <FusedGroup>
                    <FusedLabel className="text-sm font-semibold">Field Label</FusedLabel>
                    <FusedInput
                        value={field.label}
                        onChange={handleLabelChange}
                        placeholder="Enter field label..."
                        className="text-base"
                    />
                </FusedGroup>

                {/* Required Checkbox - Stylized & Consistent */}
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={`required-${field.id}`}
                        checked={field.required || false}
                        onCheckedChange={(checked) => {
                            onUpdate(field.id, { required: checked });
                        }}
                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/40"
                    />
                    <Label
                        htmlFor={`required-${field.id}`}
                        className="text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                    >
                        Required
                    </Label>
                </div>
            </div>
        </div>
    );
};