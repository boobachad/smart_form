import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { mergeNestedProperty } from "@/lib/object-utils";
import { AccessControlSettings } from "./access-control-settings";
import { LogoUploader } from "@/components/ui/logo-uploader";
import { Lock, Edit3, Infinity, CheckCircle2, Target, Calendar, Clock, Building2, Shield, FileText, Activity, LayoutTemplate, Upload, Eye } from "lucide-react";
import type { FormSettings } from "./types";
import { useFormBuilderStore } from "@/store/form-builder-store";
import { useShallow } from 'zustand/react/shallow';

export const FormSettingsTab = () => {
    const { formSettings: settings, setFormSettings: onSettingsChange } = useFormBuilderStore(useShallow(s => ({
        formSettings: s.formSettings,
        setFormSettings: s.setFormSettings
    })));

    if (!settings) return null;

    // Generic update function for any nested field
    const updateField = (path: string[], updates: Record<string, any>) => {
        const newSettings = mergeNestedProperty(settings, path, updates);
        onSettingsChange(newSettings);
    };

    // Convenience helpers for common paths
    const updateOrg = (updates: Partial<FormSettings['organization']>) =>
        updateField(['organization'], updates);

    const updateAccess = (updates: Partial<FormSettings['access_control']>) =>
        updateField(['access_control'], updates);

    const updatePolicy = (updates: Partial<FormSettings['submission_policy']>) =>
        updateField(['submission_policy'], updates);

    const updatePostSubmit = (updates: Partial<FormSettings['post_submit_behavior']>) =>
        updateField(['post_submit_behavior'], updates);

    const policyModes = [
        {
            value: 'SINGLE_LOCK',
            icon: Lock,
            label: 'One Shot',
            description: 'Lock on submit',
            activeBorder: 'border-red-500',
            activeBg: 'bg-red-500/5',
            activeRing: 'ring-red-500/20',
            activeText: 'text-red-500'
        },
        {
            value: 'SINGLE_EDITABLE',
            icon: Edit3,
            label: 'Editable',
            description: 'Allow edits',
            activeBorder: 'border-blue-500',
            activeBg: 'bg-blue-500/5',
            activeRing: 'ring-blue-500/20',
            activeText: 'text-blue-500'
        },
        {
            value: 'UNLIMITED',
            icon: Infinity,
            label: 'Unlimited',
            description: 'Multiple responses',
            activeBorder: 'border-purple-500',
            activeBg: 'bg-purple-500/5',
            activeRing: 'ring-purple-500/20',
            activeText: 'text-purple-500'
        }
    ];

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">

            {/* 0. BRANDING - Modern Hero Redesign */}
            <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl hover:shadow-2xl hover:shadow-primary/5 group/hero">
                <div className="relative p-8 flex flex-col md:flex-row items-start gap-10">
                    {/* Icon Branding Column */}
                    <div className="shrink-0 flex flex-col gap-4 items-center">
                        <div className="space-y-2 w-full text-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Organization Logo</span>

                            <LogoUploader 
                                value={settings.organization?.logo_url || ''} 
                                onChange={(val) => updateOrg({ logo_url: val })} 
                                label="Organization Logo" 
                            />
                        </div>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 space-y-6 w-full">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <Building2 className="size-6 text-primary" />
                                Organization Details
                            </h2>
                            <p className="text-muted-foreground">
                                These details will be shown to users when they view and fill out your form.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Organization Name</Label>
                            <Input
                                value={settings.organization?.name || ''}
                                onChange={(e) => updateOrg({ name: e.target.value })}
                                placeholder="e.g. Acne Corp"
                                className="h-10 text-lg"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 1. ACCESS CONTROL */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Access Control
                    </CardTitle>
                    <CardDescription>
                        Manage who can view and submit this form.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AccessControlSettings
                        accessControl={settings.access_control}
                        onChange={updateAccess}
                    />
                </CardContent>
            </Card>


            {/* 2. SUBMISSION POLICY - CARD BASED */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Response Settings
                    </CardTitle>
                    <CardDescription>
                        Configure how many times users can submit and whether they can edit their responses.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label className="text-base mb-3 block">Editing Mode</Label>
                        <div className="grid grid-cols-3 gap-4">
                            {policyModes.map((mode) => {
                                const Icon = mode.icon;
                                const isSelected = settings.submission_policy.mode === mode.value;
                                return (
                                    <Card
                                        key={mode.value}
                                        className={`cursor-pointer  border-2 ${isSelected
                                            ? `${mode.activeBorder} ${mode.activeBg} ring-2 ${mode.activeRing}`
                                            : 'border-border hover:border-muted-foreground/50'
                                            }`}
                                        onClick={() => updatePolicy({ mode: mode.value as "SINGLE_EDITABLE" | "UNLIMITED" | "SINGLE_LOCK" })}
                                    >
                                        <CardContent className="p-6 text-center">
                                            <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? mode.activeText : 'text-muted-foreground'}`} />
                                            <div className="font-semibold">{mode.label}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{mode.description}</div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 4. POST-SUBMIT - VISUAL CARDS */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        After Submission
                    </CardTitle>
                    <CardDescription>
                        Choose what information is displayed to users after they submit the form.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Card className={`border-2 ${settings.post_submit_behavior.show_scorecard ? 'border-emerald-500 bg-emerald-500/5' : 'border-border'}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-5 h-5 text-emerald-500" />
                                        <span className="font-semibold">Scorecard</span>
                                    </div>
                                    <Switch
                                        id="show_score"
                                        checked={settings.post_submit_behavior.show_scorecard}
                                        onCheckedChange={(c) => updatePostSubmit({ show_scorecard: c })}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Show a summary of verified fields</p>
                                {settings.post_submit_behavior.show_scorecard && (
                                    <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded text-xs">
                                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span className="font-semibold">Preview</span>
                                        </div>
                                        <div className="mt-1 text-emerald-700 dark:text-emerald-300">3/3 fields verified ✓</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className={`border-2 ${settings.post_submit_behavior.show_verdict ? 'border-blue-500 bg-blue-500/5' : 'border-border'}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                        <span className="font-semibold">Verdict</span>
                                    </div>
                                    <Switch
                                        id="show_verdict"
                                        checked={settings.post_submit_behavior.show_verdict}
                                        onCheckedChange={(c) => updatePostSubmit({ show_verdict: c })}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Show the final decision status</p>
                                {settings.post_submit_behavior.show_verdict && (
                                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs">
                                        <div className="inline-block px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded text-xs font-semibold">
                                            ELIGIBLE
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-2">
                        <Label>Custom Success Message</Label>
                        <Input
                            value={settings.post_submit_behavior.custom_message}
                            onChange={(e) => updatePostSubmit({ custom_message: e.target.value })}
                            placeholder="Thank you for submitting! Results will be announced soon."
                        />
                        {settings.post_submit_behavior.custom_message && (
                            <div className="p-3 bg-muted/50 border rounded text-sm text-muted-foreground mt-2 flex items-center gap-2">
                                <Eye className="w-4 h-4 shrink-0" />
                                <div>
                                    <span className="font-semibold">Preview:</span> {settings.post_submit_behavior.custom_message}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
