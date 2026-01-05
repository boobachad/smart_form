import { useNavigate, redirect, isRouteErrorResponse, useLoaderData } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, FileText, CheckCircle, Clock, ArrowRight } from "lucide-react";
import { RespondentLayout } from "@/components/layout/respondent-layout";
import type { Route } from "./+types/respondent";

export async function clientLoader() {
    const userRole = parseInt(localStorage.getItem("user_role") || "0", 10);
    const userEmail = localStorage.getItem("user_email");

    // Not logged in
    if (userRole === 0) {
        return redirect("/login");
    }

    if ((userRole & 2) !== 0) {
        return redirect("/workspace");
    }

    return { email: userEmail };
}



import { ErrorDisplay } from "@/components/ui/error-display";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    console.error(error);
    return <ErrorDisplay fullPage type="connection" message={isRouteErrorResponse(error) ? `${error.status} - ${error.statusText}` : "An unexpected error occurred."} onRetry={() => window.location.reload()} />;
}

export default function RespondentDashboard({ loaderData }: Route.ComponentProps) {
    const navigate = useNavigate();
    const { email } = loaderData;

    const handleLogout = () => {
        localStorage.clear();
        navigate("/login");
    };

    return (
        <RespondentLayout pageTitle="Dashboard">
            <div className="space-y-12 max-w-lg mx-auto text-center pt-10">
                <div className="space-y-6">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent -foreground">
                        Welcome!
                    </h1>

                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm inline-block w-full">
                        <p className="text-lg text-muted-foreground mb-2">Signed in as</p>
                        <p className="text-xl font-bold text-foreground">{email}</p>

                        {email && email.includes('@') && (
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground/70 font-bold mb-1">Organization</p>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                    {email.split('@')[1].split('.')[0].charAt(0).toUpperCase() + email.split('@')[1].split('.')[0].slice(1)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">You are signed in successfully.</h2>
                        <p className="text-muted-foreground text-pretty max-w-sm mx-auto">
                            Please use the correct and complete form link provided by your administrator to access your forms.
                        </p>
                    </div>

                    <div className="bg-muted/30 border border-border/50 rounded-xl p-4 text-left">
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-2 ml-1">Example Link Format</p>
                        <code className="block bg-background border border-border p-3 rounded-lg font-mono text-xs text-muted-foreground break-all">
                            https://smartforms.app/form/abc123/view
                        </code>
                    </div>
                </div>

                <div className="pt-8 border-t border-border/40">
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-auto py-2 px-6"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </div>
            </div>
        </RespondentLayout>
    );
}
