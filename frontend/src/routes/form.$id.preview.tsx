import React from "react";
import { useParams } from "react-router";
import {
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { RespondentLayout } from "@/components/layout/respondent-layout";
import { DataTicket } from "@/components/ui/data-ticket";
import { ErrorDisplay } from "@/components/ui/error-display";
import { FormLogoHeader } from "@/components/ui/form-logo-header";
import { useFormViewer } from "@/hooks/use-form-viewer";
import { FormFieldsRenderer } from "@/components/form-viewer/form-fields-renderer";

export default function FormPreviewPage() {
    const { id } = useParams();

    const {
        currentUser,
        formConfig,
        formSchema,
        formData,
        formErrors,
        loading,
        fetchError,
        isSubmitting,
        accessStatus,
        accessError,
        existingSubmission,
        handleTextChange,
        handleSmartFieldChange,
        handleSubmit
    } = useFormViewer({
        id: id!,
        fetchEndpoint: `/forms/${id}/manage`,
        submitEndpoint: `/forms/${id}/submit-preview`,
        isPreview: true
    });

    if (!id) return null;

    if (accessStatus === "DENIED") {
        return (
            <ErrorDisplay
                fullPage
                type="access-denied"
                headerTitleSuffix={
                    <>
                        <span className="text-muted-foreground mx-2 text-xl font-light">/</span>
                        <span className="text-muted-foreground font-medium text-sm">Preview Failed</span>
                    </>
                }
                message={accessError || "You don't have permission to preview this form."}
                onRetry={() => window.history.back()}
            />
        );
    }

    if (loading) {
        return (
            <RespondentLayout pageTitle="Loading Preview...">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loading message="Loading preview..." />
                </div>
            </RespondentLayout>
        );
    }

    if (fetchError) {
        return (
            <ErrorDisplay
                fullPage
                type="connection"
                headerTitleSuffix={
                    <>
                        <span className="text-muted-foreground mx-2 text-xl font-light">/</span>
                        <span className="text-muted-foreground font-medium text-sm">Connection Error</span>
                    </>
                }
                onRetry={() => window.location.reload()}
                message="We couldn't reach the server. Please check your connection."
            />
        );
    }

    if (formSchema && formSchema.length === 0) {
        return (
            <ErrorDisplay
                fullPage
                type="invalid-config"
                headerTitleSuffix={
                    <>
                        <span className="text-muted-foreground mx-2 text-xl font-light">/</span>
                        <span className="text-muted-foreground font-medium text-sm">Empty Form</span>
                    </>
                }
                message="This form doesn't have any fields configured yet. Please go back to the builder to add questions."
            />
        );
    }

    const showIdentityCard = formConfig?.respondent_experience?.show_identity_card ?? true;
    const hasDescription = formConfig?.meta?.description && formConfig.meta.description.trim().length > 0;
    const hasOrgBranding = formConfig?.organization?.name || formConfig?.organization?.logo_url;

    return (
        <RespondentLayout pageTitle={formConfig?.meta?.title ? `Preview - ${formConfig.meta.title}` : "Form Preview"}>

            <div className="border-t-4 border-foreground pt-4 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-black uppercase tracking-[0.2em] text-xs text-foreground">Preview Mode</span>
                <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.1em]">Test Data Not Recorded</span>
            </div>

            {hasOrgBranding && (
                <FormLogoHeader
                    organizationLogo={formConfig?.organization?.logo_url}
                    organizationName={formConfig?.organization?.name}
                    formLogo={formConfig?.meta?.logo_url}
                    formTitle={formConfig?.meta?.title}
                />
            )}

            <div className="flex flex-col gap-3 pb-8 border-b border-border">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                    {formConfig?.meta?.title || "Untitled Form"}
                </h2>
                {hasDescription && (
                    <p className="text-lg text-muted-foreground font-light max-w-2xl leading-relaxed whitespace-pre-line">
                        {formConfig?.meta?.description}
                    </p>
                )}
            </div>

            {showIdentityCard && (
                <section className="flex flex-col gap-5">
                    <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Applicant Identity
                        </h3>
                    </div>
                    <DataTicket
                        user={{
                            name: currentUser?.name || "Applicant",
                            id: currentUser?.id || "ID-UNKNOWN",
                            email: currentUser?.email,
                            organization: currentUser?.email?.split('@')[1]?.split('.')[0].toUpperCase(),
                            avatar_url: currentUser?.image
                        }}
                    />
                </section>
            )}

            <FormFieldsRenderer
                formId={id}
                schema={formSchema}
                formData={formData}
                formErrors={formErrors}
                existingSubmission={existingSubmission as any}
                onTextChange={handleTextChange}
                onSmartFieldChange={handleSmartFieldChange}
                isOwnerPreview={true}
            />

            <div className="pt-8 border-t border-border flex justify-end">
                <Button
                    size="lg"
                    className="w-full h-14 md:h-16 text-lg font-bold rounded-xl shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Processing Preview..." : "Submit Test Response"}
                </Button>
            </div>
        </RespondentLayout>
    );
}
