import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { RespondentLayout } from "@/components/layout/respondent-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, authClient } from "@/lib/auth-client";
import { AlertTriangle, CheckCircle, Clock, Plus, Eye, Edit, Target } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error-display";

interface SubmissionInfo {
    id: string;
    data: Record<string, any>;
    verdict: string;
    verification_status: string;
    flag_status: string | null;
    flag_message: string | null;
    flag_fields: string[] | null;
    submitted_at: string;
}

export default function FormStatusPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [policy, setPolicy] = useState<string>("SINGLE_EDITABLE");
    const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
    const [flaggedSubmissions, setFlaggedSubmissions] = useState<SubmissionInfo[]>([]);
    const [canSubmitNew, setCanSubmitNew] = useState(false);
    const [canEditLatest, setCanEditLatest] = useState(false);
    const [formTitle, setFormTitle] = useState<string>("");
    const [formStatus, setFormStatus] = useState<string>("active");
    const [postSubmit, setPostSubmit] = useState<Record<string, any>>({});

    useEffect(() => {
        const loadStatus = async () => {
            // Check auth
            const session = await authClient.getSession();
            if (!session?.user?.id || session.user.id === "user-id-unknown") {
                const returnUrl = encodeURIComponent(window.location.pathname);
                window.location.href = `/login?returnUrl=${returnUrl}`;
                return;
            }

            try {
                // Fetch submissions and form config in one go
                const res = await apiRequest(`/forms/${id}/my-submission`) as { policy?: string; can_submit_new?: boolean; can_edit_latest?: boolean; flagged?: SubmissionInfo[]; submissions?: SubmissionInfo[]; submission?: SubmissionInfo; form_title?: string; form_status?: string; post_submit_behavior?: Record<string, any>; };
                
                setFormTitle(res.form_title || "Form");
                setFormStatus(res.form_status || "active");
                setPostSubmit(res.post_submit_behavior || {});
                
                setPolicy(res.policy || "SINGLE_EDITABLE");
                setCanSubmitNew(res.can_submit_new || false);
                setCanEditLatest(res.can_edit_latest || false);
                setFlaggedSubmissions(res.flagged || []);

                if (res.submissions) {
                    setSubmissions(res.submissions);
                } else if (res.submission) {
                    setSubmissions([res.submission]);
                }
            } catch (err: any) {
                console.error("Failed to load status:", err);
                setError(err.message || "Failed to load");
            } finally {
                setLoading(false);
            }
        };

        loadStatus();
    }, [id]);

    const getStatusBadge = (sub: SubmissionInfo) => {
        if (sub.flag_status === "flagged") {
            return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Correction Required</Badge>;
        }
        
        // Show verdict only if explicitly true (default is false)
        const showVerdict = postSubmit.show_verdict === true;
        
        if (showVerdict) {
            if (sub.verdict === "eligible" || sub.verdict === "verified") {
                return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" /> Eligible</Badge>;
            }
            if (sub.verdict === "ineligible") {
                return <Badge variant="secondary" className="gap-1">Ineligible</Badge>;
            }
        }
        
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> {!showVerdict ? "Submitted" : "Pending"}</Badge>;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    };

    const renderScorecard = (sub: SubmissionInfo) => {
        if (!postSubmit.show_scorecard) return null;

        const stats: any[] = [];
        const parsedData = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
        
        for (const value of Object.values(parsedData || {})) {
            const state = value as any;
            if (state && typeof state === 'object' && state.source) {
                const platform = state.source;
                const claimedHandle = state.claimed_value;
                const statsObj = state.verification?.verified_stats || state.claimed_stats;
                
                if (statsObj && Object.keys(statsObj).length > 0) {
                    stats.push({
                        platform,
                        handle: claimedHandle,
                        status: state.verification?.status || "unverified",
                        metrics: statsObj
                    });
                }
            }
        }
        
        if (stats.length === 0) return null;

        return (
            <div className="mt-6 p-4 bg-muted/20 border rounded-lg">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-emerald-500" />
                    Verified Scorecard
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="bg-background border rounded p-3 text-sm">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b">
                                <span className="font-medium capitalize text-emerald-600">{stat.platform}</span>
                                <Badge variant={stat.status === 'verified' ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                                    {stat.status}
                                </Badge>
                            </div>
                            <div className="space-y-1.5">
                                {Object.entries(stat.metrics).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                                        <span className="font-medium">{String(val)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <RespondentLayout pageTitle="Loading...">
                <div className="flex items-center justify-center py-20">
                    <Loading message="Loading submission history..." />
                </div>
            </RespondentLayout>
        );
    }

    if (error) {
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
            />
        );
    }

    if (submissions.length === 0) {
        const titleSuffix = (
            <>
                <span className="text-muted-foreground mx-2 text-xl font-light">/</span>
                <span className="text-muted-foreground font-medium text-sm">{formTitle || "Form Status"}</span>
            </>
        );

        if (formStatus === "active") {
            return (
                <ErrorDisplay
                    fullPage
                    headerTitleSuffix={titleSuffix}
                    type="empty"
                    message="You have not submitted any responses for this form yet."
                    onRetry={() => navigate(`/form/${id}/view?mode=new`)}
                    actionText="Submit Response Now"
                />
            );
        } else {
            return (
                <ErrorDisplay
                    fullPage
                    headerTitleSuffix={titleSuffix}
                    type="form-closed"
                    message="This form is closed and you did not submit a response while it was active."
                />
            );
        }
    }

    return (
        <RespondentLayout pageTitle={formTitle}>
            {/* Header */}
            <section className="space-y-2">
                <h1 className="text-2xl font-bold">Your Submissions</h1>
                <p className="text-muted-foreground">
                    {policy === "UNLIMITED"
                        ? `You have ${submissions.length} submission(s) for this form.`
                        : "Your response has been recorded."}
                </p>
            </section>

            {formStatus !== "active" && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    This form is closed and is no longer accepting or allowing edits to responses.
                </div>
            )}

            {/* Custom Success Message */}
            {postSubmit?.custom_message && (
                <div className="p-4 bg-muted/30 rounded-lg border text-sm text-foreground">
                    {postSubmit.custom_message}
                </div>
            )}

            {/* Flagged Submissions Alert */}
            {flaggedSubmissions.length > 0 && (
                <Card className="border-destructive bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                            <AlertTriangle className="w-5 h-5" />
                            Action Required ({flaggedSubmissions.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {flaggedSubmissions.map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between p-3 bg-background rounded-md border">
                                <div>
                                    <p className="font-medium">Submitted {formatDate(sub.submitted_at)}</p>
                                    {sub.flag_message && (
                                        <p className="text-sm text-muted-foreground mt-1">{sub.flag_message}</p>
                                    )}
                                </div>
                                <Button size="sm" onClick={() => navigate(`/form/${id}/view?submission=${sub.id}`)}>
                                    Fix Now
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Submissions List */}
            <section className="space-y-4">
                {submissions.map((sub, index) => (
                    <Card key={sub.id} className={sub.flag_status === "flagged" ? "border-destructive/50" : ""}>
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <span className="font-medium">
                                            {policy === "UNLIMITED" ? `Submission #${submissions.length - index}` : "Your Response"}
                                        </span>
                                        {getStatusBadge(sub)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Submitted {formatDate(sub.submitted_at)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {formStatus === "active" && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => navigate(`/form/${id}/view?submission=${sub.id}&mode=view`)}>
                                                <Eye className="w-4 h-4 mr-1" /> View
                                            </Button>
                                            {(sub.flag_status === "flagged" || (index === 0 && canEditLatest)) && (
                                                <Button size="sm" onClick={() => navigate(`/form/${id}/view?submission=${sub.id}`)}>
                                                    <Edit className="w-4 h-4 mr-1" /> Edit
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            {renderScorecard(sub)}
                        </CardContent>
                    </Card>
                ))}
            </section>

            {/* Submit New Button (UNLIMITED only) */}
            {formStatus === "active" && canSubmitNew && (
                <div className="pt-4 border-t">
                    <Button onClick={() => navigate(`/form/${id}/view?mode=new`)} className="gap-2">
                        <Plus className="w-4 h-4" /> Submit New Response
                    </Button>
                </div>
            )}
        </RespondentLayout>
    );
}
