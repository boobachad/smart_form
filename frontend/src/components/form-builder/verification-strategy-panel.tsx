import React, { useState, useEffect } from 'react';
import { Settings2, Shield, Lock, RotateCcw, LayoutGrid } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SmartVerificationField } from '@/components/form-viewer/smart-verification-field';
import { useSystemCapabilities } from '@/hooks/use-system-capabilities';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SettingsPanelProps {
    config?: Record<string, any>;
    onConfigChange?: (config: Record<string, any>) => void;
}

export const VerificationStrategyPanel = ({ config = {}, onConfigChange }: SettingsPanelProps) => {
    // 1. Local State - Sync with props
    const [localConfig, setLocalConfig] = useState(config);

    const { capabilities, loading } = useSystemCapabilities();

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    // Lifted Effect: Auto-select targets
    useEffect(() => {
        if (!capabilities) return;

        const currentPlatform = localConfig.platform;
        const currentCaps = capabilities[currentPlatform];

        if (currentCaps) {
            const defaults = currentCaps.supported_metrics.map((m: Record<string, any>) => m.key);
            let hasChanges = false;
            let nextConfig = { ...localConfig };

            // Auto-set targets if empty
            if ((localConfig.targets || []).length === 0) {
                nextConfig.targets = defaults;
                hasChanges = true;
            }

            if (hasChanges) {
                // Use JSON stringify to avoid infinite loop on object reference change
                if (JSON.stringify(nextConfig) !== JSON.stringify(localConfig)) {
                    handleChange(nextConfig);
                }
            }
        }
    }, [localConfig.platform, capabilities]); // Depend on platform change

    const handlePlatformSelect = (platform: string) => {
        const newConfig = {
            ...localConfig,
            platform,
            enabled: true, // Explicitly enable when platform is chosen
            enable_client_fetch: true, // Default
            targets: [],
            // lock_on_success & allow_manual_override removed as per new default behavior
            retry_policy: { max_attempts: 3, block_on_private: true }
        };
        handleChange(newConfig);
    };

    const handleChange = (newConfig: unknown) => {
        setLocalConfig(newConfig as Record<string, any>);
        onConfigChange?.(newConfig as Record<string, any>);
    };

    // 3. Render Configuration Panel
    const platform = localConfig.platform;
    const currentCapabilities = platform && capabilities ? capabilities[platform] : undefined;

    const handleTargetToggle = (key: string) => {
        const current = new Set(localConfig.targets || []);
        if (current.has(key)) current.delete(key);
        else current.add(key);
        handleChange({ ...localConfig, targets: Array.from(current) });
    };

    if (loading) {
        return <div className="text-xs text-muted-foreground p-4">Loading system capabilities...</div>;
    }

    if (!currentCapabilities || !capabilities) {
        return (
            <div className="space-y-4">
                <Label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Select Platform</Label>
                <div className="grid grid-cols-3 gap-3">
                    {Object.values(capabilities || {}).map((cap) => {
                        // Find the key for this cap
                        const key = Object.keys(capabilities || {}).find(k => capabilities![k] === cap);
                        return (
                            <Button
                                key={key}
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-2 hover:border-[var(--color-info-border)] hover:bg-[var(--color-info-subtle)]"
                                onClick={() => handlePlatformSelect(key!)}
                            >
                                <LayoutGrid className="w-5 h-5 text-slate-400" />
                                <span className="font-medium text-slate-700 text-sm">{cap.display_name}</span>
                            </Button>
                        )
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* SELECTED PLATFORM HEADER */}
            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md border border-border">
                <div className="flex items-center gap-3">
                    <div className="bg-card p-2 rounded border border-border shadow-sm">
                        <LayoutGrid className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Verification Source</div>
                        <div className="font-bold text-foreground">{currentCapabilities.display_name}</div>
                    </div>
                </div>

                {/* Platform Switcher */}
                <div className="w-[180px]">
                    <Select value={platform} onValueChange={handlePlatformSelect}>
                        <SelectTrigger className="bg-card border-border">
                            <SelectValue placeholder="Change Platform" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(capabilities).map((cap) => {
                                const key = Object.keys(capabilities).find(k => capabilities![k] === cap);
                                return (
                                    <SelectItem key={key} value={key!}>
                                        <div className="flex items-center gap-2">
                                            <span>{cap.display_name}</span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LEFT: CONFIGURATION */}
                <div className="space-y-8">

                    {/* 1. Client Fetch Toggle (The "Strategy") */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                            <RotateCcw className="w-4 h-4" /> Client Interaction
                        </h3>
                        <Card className="p-4 border-border">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-base font-medium">Enable Client-Side Fetch</Label>
                                    <p className="text-xs text-slate-500 pr-4">
                                        Adds a "Fetch" button for users to auto-fill data.
                                    </p>
                                </div>
                                <Switch
                                    checked={config.enable_client_fetch}
                                    disabled={!currentCapabilities.features.client_fetch_supported}
                                    onCheckedChange={(c) => handleChange({ ...config, enable_client_fetch: c })}
                                />
                            </div>

                            {/* Unavailable Notice */}
                            {!currentCapabilities.features.client_fetch_supported && (
                                <div className="mt-3 bg-warning/5 text-warning-foreground text-xs p-2 rounded">
                                    Only Deferred mode available: {currentCapabilities.status}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* 2. Retry Policy (Simplified Visual) */}
                    {config.enable_client_fetch && (
                        <div className="space-y-4 animate-in slide-in-">
                            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Integrity
                            </h3>
                            <Card className="p-4 border-border">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <Label className="block font-medium">Standard Retry Policy</Label>
                                        <span className="block text-xs text-muted-foreground">Max Attempts: {config.retry_policy?.max_attempts} (Global Config)</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground italic">Enabled</div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* 3. Data Definitions (Targets) */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Data Targets
                        </h3>
                        <Card className="p-4 border-border">
                            <div className="grid grid-cols-1 gap-3">
                                {currentCapabilities.supported_metrics.map((metric: Record<string, any>) => (
                                    <div key={metric.key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={metric.key}
                                            checked={(config.targets || []).includes(metric.key)}
                                            onCheckedChange={() => handleTargetToggle(metric.key)}
                                        />
                                        <Label htmlFor={metric.key} className="text-sm font-normal">
                                            {metric.label} <span className="text-muted-foreground text-xs">({metric.key})</span>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                </div>

                {/* RIGHT: PREVIEW */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                        Live Preview
                    </h3>
                    <div className="bg-muted/30 p-6 rounded-lg border border-border min-h-[400px] flex flex-col justify-center">
                        <Card className="p-6 shadow-sm bg-card border-border">
                            <div className="mb-6 space-y-1">
                                <h4 className="font-medium text-foreground">{currentCapabilities.display_name} Handle</h4>
                                <p className="text-sm text-muted-foreground">Enter your official handle to verify.</p>
                            </div>

                            {/* THE PREVIEW COMPONENT */}
                            <SmartVerificationField
                                key={platform} // Force reset when platform changes
                                fieldId="preview_field"
                                label={`${currentCapabilities.display_name} Handle`}
                                verification_config={config as { platform: string; enable_client_fetch: boolean; targets: string[] }}
                                onStatusChange={(s) => console.log("Preview Status:", s)}
                            />
                        </Card>

                        <div className="mt-6 text-center text-xs text-slate-400">
                            Try interacting with the preview above.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};