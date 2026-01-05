import React from "react";
import {
    ArrowRight,
    AlertCircle,
    AtSign,
    Hash,
    Type,
} from "lucide-react";
import {
    FusedGroup,
    FusedInput,
    FusedLabel,
} from "@/components/ui/fused-group";
import { SmartVerificationField } from "@/components/form-viewer/smart-verification-field";
import { cn } from "@/lib/utils";

interface FormFieldsRendererProps {
    formId: string;
    schema: import("@/lib/types").FormField[];
    formData: Record<string, any>;
    formErrors: Record<string, string>;
    existingSubmission: import("@/lib/types").Submission & { flag_fields?: string[] } | null | undefined;
    readOnly?: boolean;
    onTextChange: (id: string, value: string) => void;
    onSmartFieldChange: (id: string, status: { isValid: boolean; value: unknown }) => void;
    isOwnerPreview?: boolean;
}

export function FormFieldsRenderer({
    formId,
    schema,
    formData,
    formErrors,
    existingSubmission,
    readOnly = false,
    onTextChange,
    onSmartFieldChange,
    isOwnerPreview = false
}: FormFieldsRendererProps) {
    return (
        <section className="flex flex-col gap-8">
            {schema.map((field: import("@/lib/types").FormField, index: number) => {
                const isFlaggedField = existingSubmission?.flag_fields?.includes(field.id);
                return (
                    <div key={field.id} className={cn(
                        "flex flex-col gap-5 p-6 rounded-2xl border border-border/50 bg-background/50 hover:bg-background hover:shadow-lg hover:shadow-primary/5   group focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50",
                        isFlaggedField && "border-2 border-warning bg-warning/5 dark:bg-warning/10"
                    )}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="text-xl font-semibold tracking-tight text-foreground">
                                {index + 1}. {field.label}{" "}
                                {field.required && <span className="text-destructive">*</span>}
                                {isFlaggedField && (
                                    <span className="ml-2 text-xs font-medium text-warning dark:text-warning bg-warning/10 dark:bg-warning/20 px-2 py-0.5 rounded">
                                        Update required
                                    </span>
                                )}
                            </h3>
                        </div>

                        {field.type === "smart_field" ? (
                            <div
                                className={cn(
                                    "p-1 rounded-md ",
                                    formErrors[field.id] ? "ring-2 ring-destructive/20" : "",
                                )}
                            >
                                <SmartVerificationField
                                    formId={formId}
                                    fieldId={field.id}
                                    label={field.label}
                                    verification_config={field.verification_config as { platform: string; enable_client_fetch: boolean; targets: string[] }}
                                    initialValue={formData[field.id] as Record<string, any>}
                                    onStatusChange={(status) =>
                                        onSmartFieldChange(field.id, status)
                                    }
                                    readOnly={readOnly}
                                    isOwnerPreview={isOwnerPreview}
                                />
                                {formErrors[field.id] && (
                                    <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                                        <AlertCircle className="size-4" /> Required
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <FusedGroup
                                    className={cn(
                                        "h-14 bg-background relative z-10",
                                        formErrors[field.id] && "border-destructive",
                                    )}
                                >
                                    <FusedLabel className="w-12 justify-center bg-muted/50 text-muted-foreground">
                                        {field.type === 'email' ? <AtSign className="size-5" /> : 
                                         field.type === 'number' ? <span className="font-mono text-base font-bold">23</span> : 
                                         <Type className="size-5" />}
                                    </FusedLabel>
                                    <FusedInput
                                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                                        placeholder={`Enter ${field.label}...`}
                                        value={formData[field.id] || ""}
                                        onChange={(e) => onTextChange(field.id, e.target.value)}
                                        className="text-lg font-mono text-foreground placeholder:text-muted-foreground/50 h-full"
                                        disabled={readOnly}
                                    />
                                </FusedGroup>
                                {formErrors[field.id] && (
                                    <p className="text-sm text-destructive pl-1">
                                        {formErrors[field.id]}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
