import React, { useState, useMemo } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Code2, Github, Globe, RefreshCw, Terminal, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FusedGroup, FusedInput, FusedLabel, FusedAction } from '@/components/ui/fused-group';
import { useSystemCapabilities } from '@/hooks/use-system-capabilities';
import { useJobPolling } from '@/hooks/use-job-polling';
import { apiRequest } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

const PLATFORM_ICONS: Record<string, React.ElementType> = {
    leetcode: Code2,
    github: Github,
    codeforces: Code2,
    default: Globe
};

interface SmartFieldProps {
    formId?: string;
    fieldId: string;
    label: string;
    verification_config: {
        platform: string;
        enable_client_fetch: boolean;
        lock_on_success?: boolean;
        allow_manual_override?: boolean;
        retry_policy?: { max_attempts: number; block_on_private: boolean };
        targets: string[];
    };
    initialValue?: Record<string, any>;
    onStatusChange: (status: { isValid: boolean, value: unknown }) => void;
    isOwnerPreview?: boolean; // If true, use async queue; if false, use sync interactive
    readOnly?: boolean;
}

export const SmartVerificationField = ({ formId, fieldId, label, verification_config, initialValue, onStatusChange, isOwnerPreview = false, readOnly = false }: SmartFieldProps) => {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [apiStats, setApiStats] = useState<Record<string, any> | null>(null);
    const [manualValues, setManualValues] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [attemptsInfo, setAttemptsInfo] = useState<{ remaining: number; max: number } | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    const { capabilities } = useSystemCapabilities();

    // Poll job status when currentJobId is set
    const { status: jobStatus, isWaiting, isCompleted, isFailed, error: jobError } = useJobPolling(currentJobId, {
        onComplete: async (completedStatus) => {
            console.log('[SmartVerificationField] Job completed, fresh status:', completedStatus);

            // Extract result from job status
            if (completedStatus && completedStatus.result) {
                console.log('[SmartVerificationField] Setting result:', completedStatus.result);

                // Save the API stats
                setApiStats(completedStatus.result);
                setIsVerified(true);

                setTimeout(() => {
                    checkValidity(username, completedStatus.result as Record<string, any>, manualValues);
                }, 0);

                toast.success(`Verified: ${username}`, {
                    description: "Data verified successfully"
                });
            } else {
                console.log('[SmartVerificationField] No result in completed status');
                setIsVerified(true);
                toast.success(`Verified: ${username}`, {
                    description: "Verification complete"
                });
            }

            setIsLoading(false);
            setCurrentJobId(null);
        },
        onError: (error) => {
            setError(error);
            setIsLoading(false);
            setCurrentJobId(null);
            toast.error("Verification Failed", { description: error });
        }
    });

    // Icon Selection
    const PlatformIcon = PLATFORM_ICONS[verification_config?.platform] || PLATFORM_ICONS.default;

    React.useEffect(() => {
        if (initialValue && initialValue.claimed_value) {
            setUsername(initialValue.claimed_value);

            const isApiSource = initialValue.meta?.source === 'SOURCE_API';

            if (initialValue.claimed_stats) {
                if (isApiSource) {
                    setApiStats(initialValue.claimed_stats);
                    setIsVerified(true);
                } else {
                    setManualValues(initialValue.claimed_stats);
                }
            }

        }
    }, [initialValue]);

    const dataPoints = useMemo(() => {
        if (!capabilities || !verification_config) return [];
        const platformCaps = capabilities[verification_config.platform];
        if (!platformCaps) return [];

        return (verification_config.targets || []).map(targetKey => {
            const metricDef = platformCaps.supported_metrics.find((m: unknown) => (m as { key: string }).key === targetKey);
            return {
                id: targetKey,
                label: metricDef?.label || targetKey,
                type: metricDef?.type || 'text'
            };
        });
    }, [verification_config?.platform, verification_config?.targets, capabilities]);

    if (!verification_config) {
        return (
            <div className="p-4 border border-destructive/20 bg-destructive/10 rounded text-sm text-destructive flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Invalid Verification Configuration
            </div>
        );
    }


    const checkValidity = (usr: string, apiData: Record<string, any> | null, manValues: Record<string, any>) => {
        if (!usr) {
            onStatusChange({ isValid: false, value: null });
            return;
        }

        let source = 'SOURCE_MANUAL';
        if (verification_config.enable_client_fetch && apiData) {
            source = 'SOURCE_API';
        }

        const activeValues = source === 'SOURCE_API' ? (apiData || {}) : manValues;

        const allFilled = dataPoints.every(dp => {
            const val = activeValues[dp.id];
            return val !== undefined && val !== '' && val !== null;
        });

        if (!allFilled) {
            onStatusChange({ isValid: false, value: null });
            return;
        }

        const stats: Record<string, any> = {};
        dataPoints.forEach(dp => {
            stats[dp.id] = activeValues[dp.id];
        });

        const finalData = {
            claimed_value: usr,
            claimed_stats: stats,
            source: source,
            meta: {
                source: source,
                was_overridden: false
            }
        };

        console.log('[checkValidity] Sending finalData:', {
            fieldId,
            source,
            finalData,
            dataPoints: dataPoints.map(dp => dp.id),
            activeValues
        });

        onStatusChange({ isValid: true, value: finalData });
    };

    const handleFetch = async () => {
        if (!username || !verification_config.enable_client_fetch) return;

        if (!isOwnerPreview && attemptsInfo && attemptsInfo.remaining <= 0) {
            toast.error(`Retry limit reached.`);
            return;
        }


        setIsLoading(true);
        setError(null);

        try {
            const endpoint = formId
                ? (isOwnerPreview ? `/forms/${formId}/verify-preview` : `/forms/${formId}/verify-async`)
                : '/verify-async';

            const priority = isOwnerPreview ? 'admin_now' : 'interactive';

            const response = await apiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    submission_ids: [],
                    field_ids: [fieldId],
                    priority: priority,
                    handle: username,
                    platform: verification_config.platform,
                    form_id: formId,
                })
            });

            // Start polling for job completion
            setCurrentJobId((response as Record<string, any>).job_id);

            toast.info(`Verification Started`, {
                description: `Processing ${username}...`
            });

        } catch (err: unknown) {
            console.error("Verification error:", err);

            let msg = err instanceof Error ? err.message : (err as any)?.message || "Verification failed";
            let limitType = null;
            const errObj = err as { status?: number, data?: any };

            if (errObj?.status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
                // Try to extract limit_type from error response
                const errorData = (err as Record<string, any>).data || {};
                limitType = errorData.limit_type;

                if (limitType === "PLATFORM_FETCH_LIMIT") {
                    msg = `Form fetch limit reached. You've exceeded the maximum verification attempts for this field.`;
                    setAttemptsInfo({ remaining: 0, max: errorData.max_attempts || 0 });
                } else {
                    // Service provider rate limit or unknown
                    msg = "Rate limit exceeded. Please try again later.";
                }

                setError(msg);
                toast.error("Rate Limit Exceeded", { description: msg });
                setIsLoading(false);
            } else {
                // Non-rate-limit error
                setError(msg);
                toast.error("Verification Failed", { description: msg });
                setIsLoading(false);
            }
        }
    };

    const handleManualChange = (id: string, val: string) => {
        if (isVerified) return;

        const newValues = { ...manualValues, [id]: val };
        setManualValues(newValues);
        checkValidity(username, null, newValues);
    };

    const { confirm, dialog: confirmDialog } = useConfirmDialog();

    const handleReset = async () => {
        const confirmed = await confirm({
            title: "Reset Verification?",
            description: "This will clear your verified data and allow you to enter a new username.",
            confirmText: "Reset",
            variant: "destructive",
        });

        if (!confirmed) return;

        setIsVerified(false);
        setApiStats(null);
        setManualValues({});
        onStatusChange({ isValid: false, value: null });
    };

    const isLocked = isVerified;
    const canFetch = verification_config.enable_client_fetch;
    const isRetryLimitReached = attemptsInfo !== null && attemptsInfo.remaining <= 0;

    return (
        <>
            {confirmDialog}
            <div className="space-y-0">

                <FusedGroup className={cn(
                    "h-14  relative z-10",
                    isVerified
                        ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/10"
                        : error
                            ? "border-destructive/50 bg-destructive/5"
                            : "bg-background"
                )}>
                    {/* 1. Label / Icon */}
                    <FusedLabel className={cn(
                        "w-12 justify-center ",
                        isVerified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-r border-emerald-200 dark:border-emerald-800"
                            : "bg-muted/50 text-muted-foreground"
                    )}>
                        {isLoading ? (
                            <Loader2 className="w-5 h-5" />
                        ) : isVerified ? (
                            <CheckCircle2 className="w-5 h-5" />
                        ) : (
                            <PlatformIcon className="w-5 h-5" />
                        )}
                    </FusedLabel>

                    <FusedInput
                        placeholder={`${verification_config.platform.charAt(0).toUpperCase() + verification_config.platform.slice(1)} Username`}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            if (!isVerified) checkValidity(e.target.value, null, manualValues);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isVerified && canFetch && !isRetryLimitReached && username && !isLoading) {
                                e.preventDefault();
                                handleFetch();
                            }
                        }}
                        readOnly={isLocked || readOnly}
                        className={cn(
                            "text-lg font-mono placeholder:text-muted-foreground/50 h-full",
                            isVerified && "text-emerald-700 dark:text-emerald-400 font-semibold"
                        )}
                    />

                    {canFetch ? (
                        readOnly ? (
                            <FusedAction className="bg-muted text-muted-foreground cursor-default border-l opacity-70">
                                VIEW ONLY
                            </FusedAction>
                        ) : (
                            <FusedAction
                                onClick={isVerified ? handleReset : handleFetch}
                                className={cn(
                                    "w-auto px-4 font-semibold text-xs tracking-wider uppercase  ",
                                    isVerified
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 border-l border-emerald-200 dark:border-emerald-800"
                                        : isLoading || !username || isRetryLimitReached
                                            ? "opacity-50 cursor-not-allowed bg-muted"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-l border-primary"
                                )}
                            >
                                {isVerified ? "Change" : isLoading ? <Loader2 className="w-4 h-4" /> : (isRetryLimitReached ? "Limit" : "Fetch")}
                            </FusedAction>
                        )
                    ) : (
                        <FusedAction className="bg-muted text-muted-foreground cursor-default border-l">
                            MANUAL
                        </FusedAction>
                    )}
                </FusedGroup>

                {
                    error && (
                        <div className="mt-2 text-xs text-destructive font-semibold px-2 animate-in slide-in-">
                            Error: {error}
                        </div>
                    )
                }

                {
                    dataPoints.length > 0 && (
                        <div className={cn(
                            "mx-2 bg-muted/30 border-x border-b border-border rounded-b-lg p-4 grid grid-cols-2 gap-4   ease-in-out origin-top",
                            "opacity-100 scale-y-100 mb-0" // Always visible
                        )}>
                            {dataPoints.map(dp => {
                                const val = (isVerified && apiStats) ? apiStats[dp.id] : (manualValues[dp.id] || '');
                                const fieldLocked = isLocked;

                                return (
                                    <div key={dp.id} className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1">
                                            {dp.label}
                                        </Label>
                                        <div className="relative group">
                                            <Input
                                                value={val}
                                                readOnly={fieldLocked || readOnly}
                                                onChange={(e) => handleManualChange(dp.id, e.target.value)}
                                                className={cn(
                                                    "h-9 font-mono text-sm shadow-none ",
                                                    fieldLocked
                                                        ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold"
                                                        : "bg-background border-input focus:ring-1 focus:ring-primary"
                                                )}
                                                type={dp.type === 'number' ? 'number' : 'text'}
                                            />
                                            {fieldLocked && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2" title="Verified by API">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
            </div >
        </>
    );
};
