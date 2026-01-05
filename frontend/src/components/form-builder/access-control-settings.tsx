import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Building2, Code2, X, Plus, AlertCircle, CheckCircle2, Info, BookOpen, Eye, AlertTriangle } from "lucide-react";
import type { FormSettings } from "./types";

interface AccessControlSettingsProps {
    accessControl: FormSettings['access_control'];
    onChange: (updates: Partial<FormSettings['access_control']>) => void;
}

export const AccessControlSettings = ({ accessControl, onChange }: AccessControlSettingsProps) => {
    const [newDomain, setNewDomain] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [regexTestResult, setRegexTestResult] = useState<{ match: boolean; error?: string } | null>(null);

    // Mode cards configuration
    const modes = [
        {
            value: 'PUBLIC',
            icon: Globe,
            label: 'Public',
            description: 'Anyone can access',
            color: 'emerald'
        },
        {
            value: 'DOMAIN_RESTRICTED',
            icon: Building2,
            label: 'Specific Domains',
            description: 'Specific organizations',
            color: 'blue'
        },
        {
            value: 'REGEX_MATCH',
            icon: Code2,
            label: 'Advanced (Regex)',
            description: 'Advanced matching',
            color: 'purple'
        }
    ];

    const handleAddDomain = () => {
        if (!newDomain.trim()) return;

        // Validate domain format (must contain at least one dot)
        if (!newDomain.includes('.')) {
            return; // Invalid domain format
        }

        const currentDomains = accessControl.rules.allowed_domains || [];
        if (!currentDomains.includes(newDomain.trim().toLowerCase())) {
            onChange({
                rules: {
                    ...accessControl.rules,
                    allowed_domains: [...currentDomains, newDomain.trim().toLowerCase()]
                }
            });
        }
        setNewDomain('');
    };

    const handleRemoveDomain = (domain: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const currentDomains = accessControl.rules.allowed_domains || [];
        onChange({
            rules: {
                ...accessControl.rules,
                allowed_domains: currentDomains.filter(d => d !== domain)
            }
        });
    };

    const testRegexPattern = () => {
        if (!accessControl.rules.regex_pattern || !testEmail) {
            setRegexTestResult(null);
            return;
        }

        try {
            const regex = new RegExp(accessControl.rules.regex_pattern);
            const match = regex.test(testEmail);
            setRegexTestResult({ match });
        } catch (error) {
            setRegexTestResult({ match: false, error: 'Invalid regex pattern' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Mode Selection Cards */}
            <div>
                <Label className="text-base mb-3 block">Who can access this form?</Label>
                <div className="grid grid-cols-3 gap-4">
                    {modes.map((mode) => {
                        const Icon = mode.icon;
                        const isSelected = accessControl.mode === mode.value;
                        return (
                            <Card
                                key={mode.value}
                                className={`cursor-pointer  border-2 ${isSelected
                                    ? `border-${mode.color}-500 bg-${mode.color}-500/5 ring-2 ring-${mode.color}-500/20`
                                    : 'border-border hover:border-muted-foreground/50'
                                    }`}
                                onClick={() => onChange({ mode: mode.value as "PUBLIC" | "DOMAIN_RESTRICTED" | "REGEX_MATCH" | "ALLOWLIST" })}
                            >
                                <CardContent className="p-6 text-center">
                                    <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? `text-${mode.color}-500` : 'text-muted-foreground'}`} />
                                    <div className="font-semibold">{mode.label}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{mode.description}</div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Domain Restricted UI */}
            {accessControl.mode === 'DOMAIN_RESTRICTED' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                        <Label className="text-sm font-medium mb-2 block">Allowed Email Domains</Label>
                        <div className="flex gap-2 mb-3">
                            <Input
                                placeholder="college.ac.in"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                            />
                            <Button onClick={handleAddDomain} size="sm">
                                <Plus className="w-4 h-4 mr-1" />
                                Add
                            </Button>
                        </div>
                        {newDomain && !newDomain.includes('.') && (
                            <p className="text-xs flex items-center gap-1 text-warning dark:text-warning mb-2">
                                <AlertTriangle className="w-3 h-3" />
                                Domain must contain a dot (e.g., college.ac.in)
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {(accessControl.rules.allowed_domains || []).map((domain) => (
                                <Badge
                                    key={domain}
                                    variant="secondary"
                                    className="text-sm py-1 px-3 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => {
                                        const currentDomains = accessControl.rules.allowed_domains || [];
                                        onChange({
                                            rules: {
                                                ...accessControl.rules,
                                                allowed_domains: currentDomains.filter(d => d !== domain)
                                            }
                                        });
                                    }}
                                >
                                    {domain}
                                    <X className="w-3 h-3 ml-2" />
                                </Badge>
                            ))}
                            {(!accessControl.rules.allowed_domains || accessControl.rules.allowed_domains.length === 0) && (
                                <p className="text-sm text-muted-foreground">No domains added yet</p>
                            )}
                        </div>
                    </div>

                    <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Who can access:
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>• john@college.ac.in ✓</li>
                            <li>• jane@university.edu ✓</li>
                            <li>• bob@gmail.com ✗</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Regex Pattern UI */}
            {accessControl.mode === 'REGEX_MATCH' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Regular Expression Pattern</Label>
                        <Input
                            placeholder=".*@(student|faculty)\.college\.edu"
                            className="font-mono text-sm"
                            value={accessControl.rules.regex_pattern || ''}
                            onChange={(e) => onChange({
                                rules: {
                                    ...accessControl.rules,
                                    regex_pattern: e.target.value
                                }
                            })}
                        />
                    </div>

                    {/* Regex Tester */}
                    <div className="space-y-2 pt-3 border-t">
                        <Label className="text-sm font-medium">Test Pattern</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="user@student.college.edu"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                            />
                            <Button onClick={testRegexPattern} size="sm" variant="outline">
                                Test
                            </Button>
                        </div>
                        {regexTestResult && (
                            <div className={`flex items-center gap-2 text-sm p-2 rounded ${regexTestResult.error ? 'bg-destructive/10 text-destructive' : regexTestResult.match ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground' }`}>
                                {regexTestResult.error ? (
                                    <>
                                        <AlertCircle className="w-4 h-4" />
                                        {regexTestResult.error}
                                    </>
                                ) : regexTestResult.match ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Match successful!
                                    </>
                                ) : (
                                    <>
                                        <X className="w-4 h-4" />
                                        No match
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t">
                        <p className="text-xs font-medium mb-2 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            Common Patterns:
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground font-mono">
                            <li>• .*@domain\.com - Anyone @domain</li>
                            <li>• (admin|staff)@.* - Specific prefixes</li>
                            <li>• .*\.(edu|ac\.in)$ - Educational domains</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Block Message (All Modes) */}
            {accessControl.mode !== 'PUBLIC' && (
                <div className="space-y-2">
                    <Label>Custom Block Message (Optional)</Label>
                    <Input
                        placeholder="Sorry, only university email addresses are allowed."
                        value={accessControl.block_message}
                        onChange={(e) => onChange({ block_message: e.target.value })}
                    />
                    {accessControl.block_message && (
                        <div className="mt-2 p-3 border rounded bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                Preview:
                            </p>
                            <div className="p-3 border border-destructive/50 rounded bg-destructive/5">
                                <div className="flex items-center gap-2 text-sm">
                                    <AlertCircle className="w-4 h-4 text-destructive" />
                                    <span className="font-semibold text-destructive">Access Denied</span>
                                </div>
                                <p className="text-sm mt-1">{accessControl.block_message}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
