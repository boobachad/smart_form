import React, { useState } from 'react';
import {
    X,
    Component,
    CheckCircle2,
    Filter,
    MinusCircle,
    Plus,
    Award,
    Copy,
    Settings2,
    Eye,
    Sliders
} from 'lucide-react';
import { FusedGroup, FusedInput, FusedLabel, FusedAction } from '@/components/ui/fused-group';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SmartVerificationField } from '@/components/form-viewer/smart-verification-field';
import { useSystemCapabilities } from '@/hooks/use-system-capabilities';
import { useJobPolling } from '@/hooks/use-job-polling';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useFormBuilderStore } from '@/store/form-builder-store';
import { useShallow } from 'zustand/react/shallow';

export const PropertiesPanel = ({
    formId,
}: {
    formId?: string;
}) => {
    const { 
        activeFieldId, 
        setActiveFieldId, 
        storeUpdate, 
        storeDuplicate, 
        fieldsData 
    } = useFormBuilderStore(useShallow(s => ({
        activeFieldId: s.activeFieldId,
        setActiveFieldId: s.setActiveFieldId,
        storeUpdate: s.updateField,
        storeDuplicate: s.duplicateField,
        fieldsData: s.fieldsData
    })));
    
    const field = fieldsData.find(q => q.id === activeFieldId) || null;
    const onClose = () => setActiveFieldId(null);
    const onUpdate = (updates: Partial<import('@/lib/types').FormField>) => { if (field) storeUpdate(field.id, updates); };
    const onDuplicate = () => { if (field) storeDuplicate(field.id, crypto.randomUUID()); };

    const { capabilities, loading } = useSystemCapabilities();

    if (!field) {
        return (
            <aside className="w-full bg-background border-l border-border h-full flex flex-col animate-in fade-in slide-in-">
                {/* Close Button */}
                <div className="flex justify-end p-4 pb-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                        <X className="size-4" />
                    </Button>
                </div>

                {/* Empty State Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
                    <div className="relative">
                        <div className="size-20 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center rotate-3 hover:rotate-6">
                            <Sliders className="size-10 text-muted-foreground/40" />
                        </div>
                        <div className="size-20 rounded-2xl bg-card border border-border shadow-sm absolute -left-2 -top-2 flex items-center justify-center -rotate-3 hover:-rotate-6">
                            <Settings2 className="size-10 text-primary/40" />
                        </div>
                    </div>
                    <div className="space-y-2 max-w-[220px]">
                        <h3 className="font-semibold text-foreground text-lg tracking-tight">Properties</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">Select a field on the canvas to configure its settings.</p>
                    </div>
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-full h-full flex flex-col bg-background border-l border-border shadow-xl shadow-black/5 z-20">
            {/* Header - Glassmorphism */}
            <div className="h-16 border-b border-border/60 flex items-center justify-between px-5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-bold text-foreground tracking-tight">Configuration</h3>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-70">ID: {field.id.slice(-6)}</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                >
                    <X className="size-4" />
                </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-8">

                {/* Section: General Settings */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground text-xs font-bold uppercase tracking-wider opacity-60 px-1">
                        <Filter className="size-3.5" />
                        General Settings
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground ml-1">Field Type</Label>
                            <Select
                                value={field.type}
                                onValueChange={(val) => onUpdate({ type: val })}
                            >
                                <SelectTrigger className="w-full h-10 border-border/60 focus:ring-primary/20 bg-card hover:bg-accent/5">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Short Text</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="smart_field">Platform Verification</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground ml-1">Placeholder</Label>
                            <FusedGroup className="shadow-sm">
                                <FusedInput
                                    className="font-medium text-sm h-10"
                                    value={field.placeholder || ''}
                                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                                    placeholder="e.g. Type your response..."
                                />
                            </FusedGroup>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 cursor-pointer" onClick={() => onUpdate({ required: !field.required })}>
                            <Label className="text-sm font-medium cursor-pointer pointer-events-none">Required Field</Label>
                            <Checkbox
                                id="required-panel"
                                checked={field.required || false}
                                onCheckedChange={(checked) => onUpdate({ required: checked === true })}
                                className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/40 pointer-events-none"
                            />
                        </div>
                    </div>
                </section>

                <Separator className="bg-border/60" />

                {/* Type Specific: Smart Verification */}
                {field.type === 'smart_field' && (
                    <div className="space-y-8 animate-in fade-in slide-in-">
                        {/* Section: Platform Verification */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-foreground text-xs font-bold uppercase tracking-wider opacity-60 px-1">
                                <Component className="size-3.5" />
                                Platform Verification
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground ml-1">Service Provider</Label>
                                <Select
                                    value={field.verification_config?.platform || ''}
                                    onValueChange={(val) => {
                                        onUpdate({
                                            verification_config: {
                                                ...field.verification_config,
                                                platform: val,
                                                enable_client_fetch: true,
                                                targets: []
                                            },
                                            logic: { criteria: [] }
                                        });
                                    }}
                                    disabled={loading}
                                >
                                    <SelectTrigger className="w-full h-11 border-border/60 focus:ring-primary/20 bg-card">
                                        <SelectValue placeholder={loading ? "Loading platforms..." : "Select platform source..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {capabilities && Object.values(capabilities).map((cap) => {
                                            const key = Object.keys(capabilities).find(k => capabilities[k] === cap);
                                            return (
                                                <SelectItem key={key} value={key!}>{cap.display_name}</SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>

                                {field.verification_config?.platform && (
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-emerald-600 bg-emerald-500/10 font-medium px-3 py-2 rounded-lg border border-emerald-500/20 w-fit animate-in fade-in slide-in-">
                                        <CheckCircle2 className="size-3.5" />
                                        API Connection Verified
                                    </div>
                                )}
                            </div>
                        </section>

                        {field.verification_config?.platform && (
                            <>
                                {/* Section: Validation Behavior */}
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 text-foreground text-xs font-bold uppercase tracking-wider opacity-60 px-1">
                                        <Settings2 className="size-3.5" />
                                        Validation Behavior
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Card className="p-3 border-border/60 shadow-sm flex flex-col justify-between gap-2 bg-card/50 hover:bg-card">
                                            <div className="flex justify-between items-start">
                                                <Label className="text-xs font-semibold">Client Fetch</Label>
                                                <Switch
                                                    checked={field.verification_config?.enable_client_fetch ?? true}
                                                    onCheckedChange={(checked) => {
                                                        const updates: Partial<import("@/lib/types").FormField> = {
                                                            verification_config: { ...field.verification_config, enable_client_fetch: checked }
                                                        };
                                                        if (!checked) {
                                                            updates.retry_policy = {
                                                                ...field.retry_policy,
                                                                max_attempts: 1,
                                                                block_on_private: false
                                                            };
                                                        }
                                                        onUpdate(updates);
                                                    }}
                                                    className="scale-75 origin-top-right -mr-1.5 -mt-1.5 data-[state=checked]:bg-primary"
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground leading-tight">Allow user to sync data manually.</span>
                                        </Card>

                                        <Card className={cn(
                                            "p-3 border-border/60 shadow-sm flex flex-col justify-between gap-2 bg-card/50 hover:bg-card ",
                                            !field.verification_config?.enable_client_fetch && "opacity-50 pointer-events-none"
                                        )}>
                                            <div className="flex justify-between items-start">
                                                <Label className="text-xs font-semibold">Max Retries</Label>
                                                <input
                                                    type="number"
                                                    min="1" max="10"
                                                    disabled={!field.verification_config?.enable_client_fetch}
                                                    value={field.retry_policy?.max_attempts || 3}
                                                    onChange={(e) => onUpdate({
                                                        retry_policy: { ...field.retry_policy, max_attempts: parseInt(e.target.value) }
                                                    })}
                                                    className="w-10 h-6 text-xs text-center border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground leading-tight">Attempts before lockout.</span>
                                        </Card>
                                    </div>
                                </section>

                                <Separator className="bg-border/60" />

                                {/* Section: Eligibility Logic */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2 text-foreground text-xs font-bold uppercase tracking-wider opacity-60">
                                            <Award className="size-3.5" />
                                            Eligibility Logic
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {capabilities && capabilities[field.verification_config?.platform]?.supported_metrics.map((metric: { key: string; label: string }) => {
                                            const existingCriterion = (field.logic?.criteria || []).find((c: { metric: string; operator: string; threshold: number }) => c.metric === metric.key);
                                            const isEnabled = !!existingCriterion;

                                            return (
                                                <div
                                                    key={metric.key}
                                                    className={cn(
                                                        "group flex flex-col gap-3 p-3 rounded-xl border  ",
                                                        isEnabled
                                                            ? "bg-card border-primary/20 shadow-sm ring-1 ring-primary/5"
                                                            : "bg-transparent border-transparent hover:bg-muted/40 hover:border-border/30"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            id={`toggle-${metric.key}`}
                                                            checked={isEnabled}
                                                            onCheckedChange={(checked) => {
                                                                let newCriteria = [...(field.logic?.criteria || [])];
                                                                if (checked) {
                                                                    newCriteria.push({ metric: metric.key, operator: '>=', threshold: 0 });
                                                                } else {
                                                                    newCriteria = newCriteria.filter((c: { metric: string; operator: string; threshold: number }) => c.metric !== metric.key);
                                                                }
                                                                const newTargets = newCriteria.map((c: { metric: string; operator: string; threshold: number }) => c.metric);
                                                                onUpdate({
                                                                    logic: { ...field.logic, criteria: newCriteria },
                                                                    verification_config: { ...field.verification_config, targets: newTargets }
                                                                });
                                                            }}
                                                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/40"
                                                        />
                                                        <Label
                                                            htmlFor={`toggle-${metric.key}`}
                                                            className={cn(
                                                                "text-xs font-semibold cursor-pointer select-none",
                                                                isEnabled ? "text-foreground" : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {metric.label}
                                                        </Label>
                                                    </div>

                                                    {isEnabled && (
                                                        <div className="pl-7 animate-in slide-in- fade-in">
                                                            <FusedGroup className="h-9 shadow-sm">
                                                                <FusedAction className="border-r pr-1 w-12 justify-center bg-muted/10">
                                                                    <select
                                                                        value={existingCriterion.operator}
                                                                        onChange={(e) => {
                                                                            const newCriteria = field.logic?.criteria?.map((c: { metric: string; operator: string; threshold: number }) =>
                                                                                c.metric === metric.key ? { ...c, operator: e.target.value } : c
                                                                            );
                                                                            onUpdate({ logic: { ...field.logic, criteria: newCriteria } });
                                                                        }}
                                                                        className="bg-transparent border-none text-xs font-bold text-foreground focus:ring-0 p-0 cursor-pointer appearance-none text-center w-full"
                                                                    >
                                                                        <option>{`>=`}</option>
                                                                        <option>{`>`}</option>
                                                                        <option>{`=`}</option>
                                                                    </select>
                                                                </FusedAction>
                                                                <FusedInput
                                                                    className="font-mono text-sm h-full"
                                                                    type="number"
                                                                    value={existingCriterion.threshold || 0}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value) || 0;
                                                                        const newCriteria = field.logic?.criteria?.map((c: { metric: string; operator: string; threshold: number }) =>
                                                                            c.metric === metric.key ? { ...c, threshold: val } : c
                                                                        );
                                                                        onUpdate({ logic: { ...field.logic, criteria: newCriteria } });
                                                                    }}
                                                                />
                                                            </FusedGroup>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <Separator className="bg-border/60" />

                                {/* Section: Live Simulation */}
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 text-foreground text-xs font-bold uppercase tracking-wider opacity-60 px-1">
                                        <Eye className="size-3.5" />
                                        Live Simulation
                                    </div>
                                    <div className="bg-muted/10 p-5 rounded-xl border border-dashed border-border/60 hover:border-border">
                                        <SmartVerificationField
                                            key={field.verification_config?.platform}
                                            formId={formId}
                                            fieldId="preview_field"
                                            label={`${field.verification_config?.platform || 'Platform'} Handle`}
                                            verification_config={{
                                                platform: field.verification_config?.platform || 'leetcode',
                                                enable_client_fetch: field.verification_config?.enable_client_fetch ?? true,
                                                retry_policy: (field.retry_policy as { max_attempts: number; block_on_private: boolean }) || { max_attempts: 3, block_on_private: true },
                                                targets: field.verification_config?.targets || []
                                            }}
                                            onStatusChange={() => { }}
                                            isOwnerPreview={true}
                                        />
                                        <div className="mt-4 text-center">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest bg-muted/20 px-2 py-1 rounded">Interactive Preview</span>
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/60 bg-muted/10 backdrop-blur-sm mt-auto">
                <Button
                    variant="outline"
                    className="w-full gap-2 text-muted-foreground hover:text-foreground h-10 border-border/60 shadow-sm bg-background/50"
                    onClick={() => onDuplicate?.()}
                >
                    <Copy className="size-3.5 opacity-70" />
                    Duplicate Field
                </Button>
            </div>
        </aside>
    );
};
