import { useState, useEffect } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router";
import {
    Eye,
    Save,
    Download,
    Upload,
    MoreHorizontal,
    Plus,
    LayoutTemplate
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BuilderLayout } from "@/components/layout/builder-layout";
import { FusedGroup, FusedInput, FusedAction, FusedLabel, FusedTextArea } from "@/components/ui/fused-group";
import { cn } from "@/lib/utils";

import { FormBuilder } from "@/components/form-builder/form-builder";
import { ResponsesTab } from "@/components/admin/responses-tab";
import { VerdictTab } from "@/components/admin/verdict-tab";
import { FormSettingsTab } from "@/components/form-builder/form-settings-tab";
import { PublishDialog } from "@/components/form-builder/publish-dialog";
import { toast } from "sonner";

import { apiRequest, authClient } from "@/lib/auth-client";
import { AppFooter } from "@/components/layout/app-footer";
import { useHealthMonitor } from "@/hooks/use-health-monitor";
import { ConnectionStatus } from "@/components/ui/connection-status";

import { PropertiesPanel } from "@/components/form-builder/properties-panel";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Loading } from "@/components/ui/loading";
import { useFormBuilderStore } from "@/store/form-builder-store";
import { useShallow } from 'zustand/react/shallow';
import { HeroSettings } from "@/components/form-builder/hero-settings";


export default function FormEditPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const { apiStatus, dbStatus } = useHealthMonitor({ enableNotifications: true });

    const currentTab = location.hash.replace('#', '') || 'builder';

    // Lifted State via Zustand
    const {
        status,
        formSettings,
        setFormState,
        activeFieldId
    } = useFormBuilderStore(useShallow(s => ({
        status: s.status,
        formSettings: s.formSettings,
        setFormState: s.setFormState,
        activeFieldId: s.activeFieldId
    })));

    // Needed for saving
    const title = useFormBuilderStore(s => s.title);
    const description = useFormBuilderStore(s => s.description);
    const icon = useFormBuilderStore(s => s.icon);
    const fieldsData = useFormBuilderStore(s => s.fieldsData);

    const [responsesData, setResponsesData] = useState<import("@/lib/types").Submission[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; role: number } | null>(null);
    const [fetchError, setFetchError] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false); // SECURITY: Track ownership

    // AUTH GUARD & Data Fetching
    const loadFormData = async () => {
        if (!id) return;
        setIsLoading(true);
        setFetchError(false);
        setIsOwner(false); // Reset ownership

        try {
            const session = await authClient.getSession();
            if (!session?.user?.id || session.user.id === "user-id-unknown") {
                // Not authenticated
                const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login?returnUrl=${returnUrl}`;
                return;
            }
            setCurrentUser({ ...session.user, role: session.user.role || 1 });

            let resForm = location.state?.initialForm;
            if (!resForm) {
                const res = await apiRequest(`/forms/${id}/manage`) as { form?: import("@/lib/types").Form };
                resForm = res.form;
            }

            if (resForm) {
                if (resForm.user_id !== session.user.id) {
                    toast.error("Access Denied", { description: "You don't have permission to edit this form." });
                    // Redirect based on role: creators to workspace, others to home
                    navigate(session.user.role === 2 ? '/workspace' : '/');
                    return;
                }

                // ONLY set data if ownership verified
                setIsOwner(true);
                setFormState({
                    title: resForm.title,
                    status: resForm.status,
                    description: resForm.config?.meta?.description || "",
                    icon: resForm.config?.meta?.logo_url || "",
                    fieldsData: resForm.fields || [],
                    formSettings: resForm.config as any
                });
                setIsLoading(false);
            } else {
                setNotFound(true);
            }
        } catch (err: unknown) {
            console.error("Failed to load form", err);

            // Check for connection errors first
            if (err instanceof Error && err.message?.includes("Unable to connect")) {
                setFetchError(true);
            } else {
                setNotFound(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFormData();
    }, [id]);


    const [exportModalOpen, setExportModalOpen] = useState(false);

    const handleTabChange = (value: string) => {
        navigate(`#${value}`);
    };

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const handleSaveForm = async () => {
        if (!id) return;

        // Validation
        if (!title || title.trim() === '') {
            toast.error("Form title is required");
            setSaveError(true);
            return;
        }

        const hasErrors = fieldsData.some((field, index) => {
            if (field.type === 'smart_field') {
                const config = field.verification_config;
                if (!config || !config.platform) {
                    toast.error(`Invalid Configuration`, { description: `Smart Verification field #${index + 1} (${field.title || 'Untitled'}) must have a platform selected.` });
                    return true;
                }
                if (!config.targets || config.targets.length === 0) {
                    toast.error(`Invalid Configuration`, { description: `Smart Verification field #${index + 1} (${field.title || 'Untitled'}) must have at least one verification metric selected (e.g. Contest Rating).` });
                    return true;
                }
            }
            return false;
        });

        if (hasErrors) {
            setSaveError(true);
            return;
        }

        setIsSaving(true);
        setSaveError(false);
        try {
            await apiRequest(`/forms/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    title: title,
                    fields: fieldsData,
                    config: {
                        ...formSettings,
                        meta: {
                            ...formSettings?.meta,
                            title: title,
                            description: description,
                            logo_url: icon,
                        }
                    }
                })
            });
            setLastSaved(new Date());
            toast.success("Form saved successfully");
        } catch (err) {
            console.error(err);
            setSaveError(true);
            toast.error("Failed to save form. Network or Server Error.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {!isLoading && !fetchError && isOwner ? (
                <BuilderLayout
                    breadcrumbs={[
                        { label: 'Workspace', href: '/workspace' },
                        { label: title || 'Untitled Form' }
                    ]}
                    topNav={
                        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-auto">
                            <TabsList className="h-9 bg-muted/50 p-1 gap-1">
                                <TabsTrigger
                                    value="builder"
                                    className="px-4 py-1.5 rounded-sm text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                                >
                                    Builder
                                </TabsTrigger>
                                <TabsTrigger
                                    value="responses"
                                    className="px-4 py-1.5 rounded-sm text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                                >
                                    Responses
                                </TabsTrigger>
                                <TabsTrigger
                                    value="settings"
                                    className="px-4 py-1.5 rounded-sm text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                                >
                                    Settings
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    }
                    topActions={
                        <>
                            <div className="flex items-center text-xs text-muted-foreground gap-2 mr-2">
                                {saveError && (
                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 text-red-600 font-medium">
                                        <span className="size-1.5 rounded-full bg-red-600"></span>
                                        Save Failed
                                    </span>
                                )}
                                {!saveError && isSaving && (
                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 font-medium">
                                        <span className="size-1.5 rounded-full bg-blue-600"></span>
                                        Saving...
                                    </span>
                                )}
                                {!saveError && !isSaving && lastSaved && (
                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                                        <span className="size-1.5 rounded-full bg-emerald-600"></span>
                                        Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>

                            <ConnectionStatus apiStatus={apiStatus} dbStatus={dbStatus} compact />

                            {currentTab === 'responses' && (
                                <FusedGroup className="h-8">
                                    <FusedAction
                                        className="border-none px-3 gap-2 text-foreground font-medium hover:bg-muted w-full text-xs"
                                        onClick={() => setExportModalOpen(true)}
                                    >
                                        <Download className="size-3.5" />
                                        Export
                                    </FusedAction>
                                </FusedGroup>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                onClick={handleSaveForm}
                                disabled={isSaving}
                            >
                                {isSaving ? <span className="">⏳</span> : <Save className="size-3.5" />}
                                Save Changes
                            </Button>

                            {formSettings && (
                                <PublishDialog
                                    onStatusChange={async (newStatus) => {
                                        if (newStatus === 'active') {
                                            if (fieldsData.length === 0) {
                                                toast.error("Cannot publish an empty form.");
                                                return;
                                            }
                                            if (!title || title.trim() === '') {
                                                toast.error("Cannot publish a form without a title.");
                                                return;
                                            }
                                        }
                                        await handleSaveForm();
                                        try {
                                            await apiRequest(`/forms/${id}/status`, {
                                                method: 'PATCH',
                                                body: JSON.stringify({ status: newStatus })
                                            });
                                            setFormState({ status: newStatus });
                                            toast.success(newStatus === 'active' ? "Form is Live!" : "Form Unpublished");
                                        } catch (e) {
                                            toast.error("Failed to update status");
                                        }
                                    }}
                                />
                            )}

                            <Link
                                to={status === 'active' ? `/form/${id}/view` : `/form/${id}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground border border-transparent hover:border-border"
                                title={status === 'active' ? "View Live Form" : "Preview Draft"}
                            >
                                <Eye className="size-4" />
                            </Link>
                        </>
                    }
                    rightSidebar={
                        currentTab === 'builder' && activeFieldId ? (
                            <PropertiesPanel formId={id} />
                        ) : undefined
                    }
                >

                    <div className="flex-1 overflow-y-auto p-8 bg-muted/30">
                        <div className={cn("mx-auto flex flex-col gap-6 pb-20", currentTab === 'responses' ? "max-w-7xl w-full" : "max-w-4xl")}>

                            {currentTab === 'builder' && (
                                <>
                                    <HeroSettings />

                                    <FormBuilder />
                                </>
                            )}

                            {currentTab === 'responses' && (
                                <ResponsesTab
                                    formId={id}
                                    exportModalOpen={exportModalOpen}
                                    onExportModalChange={setExportModalOpen}
                                />
                            )}
                            {currentTab === 'verdict' && <VerdictTab formId={id} />}

                            {currentTab === 'settings' && formSettings && (
                                <FormSettingsTab />
                            )}

                        </div>
                    </div>
                </BuilderLayout>
            ) : isLoading ? (
                <div className="min-h-screen flex items-center justify-center bg-muted/30">
                    <Loading size="lg" message="Verifying access..." />
                </div>
            ) : fetchError ? (
                <ErrorDisplay
                    fullPage
                    onRetry={loadFormData}
                    headerTitleSuffix={<Badge variant="secondary" className="ml-2 font-normal">Creator</Badge>}
                />
            ) : notFound ? (
                <ErrorDisplay
                    fullPage
                    type="not-found"
                    onRetry={() => navigate('/workspace')}
                    headerTitleSuffix={<Badge variant="secondary" className="ml-2 font-normal">Creator</Badge>}
                />
            ) : (
                <ErrorDisplay
                    fullPage
                    type="access-denied"
                    message="You don't have permission to edit this form. Only the form owner can access the editor."
                    onRetry={() => navigate('/workspace')}
                    actionText="Return to Workspace"
                    headerTitleSuffix={<Badge variant="secondary" className="ml-2 font-normal">Creator</Badge>}
                />
            )}
        </>
    );
}
