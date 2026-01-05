import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { apiRequest, authClient } from "@/lib/auth-client";

interface UseFormViewerProps {
    id: string;
    fetchEndpoint: string;
    submitEndpoint: string;
    isPreview?: boolean;
}

export function useFormViewer({ id, fetchEndpoint, submitEndpoint, isPreview = false }: UseFormViewerProps) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [currentUser, setCurrentUser] = useState<Record<string, any> | null>(null);
    const [accessStatus, setAccessStatus] = useState<"PENDING" | "GRANTED" | "DENIED">("PENDING");
    const [accessError, setAccessError] = useState<string | null>(null);

    const [formConfig, setFormConfig] = useState<Record<string, any> | null>(null);
    const [formSchema, setFormSchema] = useState<import("@/lib/types").FormField[]>([]);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formStatus, setFormStatus] = useState<"OPEN" | "SUBMITTED" | "FLAGGED">("OPEN");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fetchError, setFetchError] = useState(false);

    const [existingSubmission, setExistingSubmission] = useState<{
        id: string;
        data: Record<string, any>;
        flag_status?: string;
        flag_message?: string;
        flag_fields?: string[];
    } | null>(null);

    // AUTH GUARD
    useEffect(() => {
        const checkAuth = async () => {
            const session = await authClient.getSession();
            if (!session?.user?.id || session.user.id === "user-id-unknown") {
                const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login?returnUrl=${returnUrl}`;
                return;
            }
            setCurrentUser(session.user);
        };
        checkAuth();
    }, []);

    const storageKey = id && currentUser ? `form_draft_${id}_${currentUser.id}` : null;

    // LOAD FORM LOGIC
    useEffect(() => {
        const loadForm = async () => {
            if (!id || !currentUser) return;
            setFetchError(false);
            try {
                const res = await apiRequest(fetchEndpoint) as Record<string, any>;
                if (res.form) {
                    setFormConfig(res.form.config);
                    setFormSchema(res.form.fields || []);

                    const isDraft = res.form.status !== "active";

                    if (isDraft && !isPreview) {
                        setAccessStatus("DENIED");
                        setAccessError("This form is not accessible. It may have been removed or you may not have permission to view it.");
                    } else {
                        setAccessStatus("GRANTED");
                    }
                }
            } catch (err: unknown) {
                console.error("Failed to load form", err);
                if (storageKey) localStorage.removeItem(storageKey);

                if ((err as Error).message?.includes("Unable to connect")) {
                    setFetchError(true);
                    setAccessStatus("DENIED");
                } else {
                    setAccessStatus("DENIED");
                    setAccessError((err as Error).message || "This form is not accessible. It may have been removed or you may not have permission to view it.");
                }
            } finally {
                setLoading(false);
            }
        };
        loadForm();
    }, [id, currentUser, fetchEndpoint, isPreview, storageKey]);

    // SUBMISSION LOADING
    useEffect(() => {
        if (isPreview) return;

        const fetchMySubmission = async () => {
            if (!id || accessStatus !== "GRANTED") return;
            const submissionIdParam = searchParams.get("submission");
            const modeParam = searchParams.get("mode");

            try {
                const res = await apiRequest(`/forms/${id}/my-submission`) as Record<string, any>;

                if (modeParam === "new") {
                    setFormData({});
                    setExistingSubmission(null);
                    setFormStatus("OPEN");
                    return;
                }

                if (submissionIdParam) {
                    let targetSubmission = null;
                    if (res.submissions) {
                        targetSubmission = res.submissions.find((s: Record<string, any>) => s.id === submissionIdParam);
                    } else if (res.submission?.id === submissionIdParam) {
                        targetSubmission = res.submission;
                    }

                    if (targetSubmission) {
                        setExistingSubmission(targetSubmission);
                        if (targetSubmission.data) setFormData(targetSubmission.data);
                        setFormStatus(targetSubmission.flag_status === 'flagged' ? "FLAGGED" : "SUBMITTED");
                        return;
                    }
                }

                const hasSubmission = res.submission || (res.submissions && res.submissions.length > 0);
                if (hasSubmission) {
                    navigate(`/form/${id}/status`);
                    return;
                }
                setFormStatus("OPEN");
            } catch (err) {
                console.log("No existing submission");
            }
        };
        fetchMySubmission();
    }, [id, accessStatus, searchParams, navigate, isPreview]);

    // DRAFT RESTORE
    useEffect(() => {
        if (!storageKey || existingSubmission || loading || Object.keys(formData).length > 0) return;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Object.keys(parsed).length > 0) {
                    setFormData(parsed);
                    toast.info("Draft Restored", { description: "We found unsaved progress and restored it." });
                }
            } catch (e) {
                console.error("Failed to parse draft", e);
            }
        }
    }, [storageKey, existingSubmission, loading]);

    // DRAFT SAVE
    useEffect(() => {
        if (!storageKey || Object.keys(formData).length === 0) return;
        const timeout = setTimeout(() => {
            localStorage.setItem(storageKey, JSON.stringify(formData));
        }, 500);
        return () => clearTimeout(timeout);
    }, [formData, storageKey]);

    const handleTextChange = (fieldId: string, value: string) => {
        setFormData((prev) => ({ ...prev, [fieldId]: value }));
        if (value) {
            setFormErrors((prev) => {
                const next = { ...prev };
                delete next[fieldId];
                return next;
            });
        }
    };

    const handleSmartFieldChange = (fieldId: string, status: { isValid: boolean; value: unknown }) => {
        setFormData((prev) => ({ ...prev, [fieldId]: status.value }));
        setFormErrors((prev) => {
            const next = { ...prev };
            if (status.isValid) delete next[fieldId];
            return next;
        });
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        const errors: Record<string, string> = {};
        formSchema.forEach((field: Record<string, any>) => {
            let val = formData[field.id];

            // Basic sanitization
            if (typeof val === 'string') {
                val = val.trim();
            }

            if (field.required && (!val || val === "")) {
                errors[field.id] = "Required field";
                return;
            }

            if (val && val !== "") {
                if (field.type === 'number') {
                    if (isNaN(Number(val))) {
                        errors[field.id] = "Must be a valid number";
                    }
                } else if (field.type === 'email') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(String(val))) {
                        errors[field.id] = "Must be a valid email address";
                    }
                } else if (field.type === 'text' || field.type === 'textarea') {
                    if (typeof val !== 'string') {
                        errors[field.id] = "Invalid text input";
                    } else if (val.length > 10000) {
                        errors[field.id] = "Input exceeds maximum allowed length";
                    } else if (/<script\b[^>]*>|<\/script>|<iframe\b|<object\b/i.test(val)) {
                        errors[field.id] = "Invalid input characters detected (potential injection)";
                    }
                }
            }
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            toast.error("Please fix the validation errors in the form");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isPreview) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 800));

                if (storageKey) localStorage.removeItem(storageKey);

                toast.success("Preview Submission Received", { description: "Logic verified. No data saved to production stats." });
                setFormStatus("SUBMITTED");
                setIsSubmitting(false);
                return;
            }

            await apiRequest(submitEndpoint, {
                method: "POST",
                body: JSON.stringify(formData),
            });

            if (storageKey) localStorage.removeItem(storageKey);

            navigate(`/form/${id}/status`);
        } catch (err: unknown) {
            console.error("Submission error:", err);
            setIsSubmitting(false);
            toast.error("Failed to submit form", { description: (err as Error).message });
        }
    };

    const isReadOnly = searchParams.get("mode") === "view";

    return {
        currentUser,
        formConfig,
        formSchema,
        formData,
        formErrors,
        formStatus,
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
    };
}
