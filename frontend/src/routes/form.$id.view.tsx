import React from "react";
import { useParams } from "react-router";
import {
  CheckCircle2,
} from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { RespondentLayout } from "@/components/layout/respondent-layout";
import { DataTicket } from "@/components/ui/data-ticket";
import { ErrorDisplay } from "@/components/ui/error-display";
import { FormLogoHeader } from "@/components/ui/form-logo-header";
import { useFormViewer } from "@/hooks/use-form-viewer";
import { FormFieldsRenderer } from "@/components/form-viewer/form-fields-renderer";

export default function FormViewPage() {
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
    isReadOnly,
    handleTextChange,
    handleSmartFieldChange,
    handleSubmit
  } = useFormViewer({
    id: id!,
    fetchEndpoint: `/forms/${id}`,
    submitEndpoint: `/forms/${id}/submit`,
    isPreview: false
  });

  if (!id) return null;

  if (loading) {
    return (
      <RespondentLayout pageTitle="Loading...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loading message="Loading form..." />
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
            <span className="text-muted-foreground font-medium text-sm">Error</span>
          </>
        }
        onRetry={() => window.location.reload()}
        message="We couldn't reach the server. Please check your connection."
      />
    );
  }

  if (accessStatus === "DENIED") {
    return (
      <ErrorDisplay
        fullPage
        type="access-denied"
        headerTitleSuffix={
          <>
            <span className="text-muted-foreground mx-2 text-xl font-light">/</span>
            <span className="text-muted-foreground font-medium text-sm">Access Denied</span>
          </>
        }
        message={accessError || "This form is not accessible."}
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
        message="This form doesn't have any fields configured yet. If you are the form creator, please go back to the builder to add questions."
      />
    );
  }

  const showIdentityCard = formConfig?.respondent_experience?.show_identity_card ?? true;
  const hasDescription = formConfig?.meta?.description && formConfig.meta.description.trim().length > 0;
  const hasOrgBranding = formConfig?.organization?.name || formConfig?.organization?.logo_url;

  return (
    <RespondentLayout pageTitle={formConfig?.meta?.title || "Smart Form"}>

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

      {/* Form Fields */}
      <FormFieldsRenderer
        formId={id}
        schema={formSchema}
        formData={formData}
        formErrors={formErrors}
        existingSubmission={existingSubmission as any}
        readOnly={isReadOnly}
        onTextChange={handleTextChange}
        onSmartFieldChange={handleSmartFieldChange}
      />

      {!isReadOnly && (
        <div className="pt-8 border-t border-border flex justify-end">
          <Button
            size="lg"
            className="w-full h-14 md:h-16 text-lg font-bold rounded-xl shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting Application..." : "Submit Application"}
          </Button>
        </div>
      )}
    </RespondentLayout>
  );
}
