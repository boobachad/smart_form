import { WifiOff, RotateCcw, AlertCircle, Lock, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";

type ErrorType = "connection" | "not-found" | "access-denied" | "empty" | "form-closed" | "invalid-config";

interface ErrorDisplayProps {
    onRetry?: () => void;
    message?: string;
    /** Full-page mode with AppHeader (for page-level errors) */
    fullPage?: boolean;
    /** AppHeader title suffix when in fullPage mode */
    headerTitleSuffix?: React.ReactNode;
    /** Error type to determine icon and default messaging */
    type?: ErrorType;
    /** Custom action button text */
    actionText?: string;
}

const errorConfig = {
    connection: {
        icon: WifiOff,
        title: "Unable to Connect",
        defaultMessage: "We couldn't reach the server. Please check your connection or try again.",
        actionText: "Retry Connection",
    },
    "not-found": {
        icon: AlertCircle,
        title: "Form Unavailable",
        defaultMessage: "This form is not accessible. It may have been removed or you may not have permission to view it.",
        actionText: "Go to Workspace",
    },
    "access-denied": {
        icon: Lock,
        title: "Access Denied",
        defaultMessage: "You don't have permission to access this page.",
        actionText: "Return to Workspace",
        iconColor: "text-red-500",
        bgLight: "bg-red-100",
        bgDark: "dark:bg-red-900/20",
        border: "border-destructive/20",
        containerBg: "bg-red-50/50 dark:bg-red-900/10"
    },
    "empty": {
        icon: Inbox,
        title: "No Records Found",
        defaultMessage: "There is nothing to display here right now.",
        actionText: "Create New",
        iconColor: "text-blue-500",
        bgLight: "bg-blue-100",
        bgDark: "dark:bg-blue-900/20",
        border: "border-border",
        containerBg: "bg-card/50"
    },
    "form-closed": {
        icon: Lock,
        title: "Form Closed",
        defaultMessage: "This form is no longer accepting new submissions or edits.",
        actionText: "Go Back",
        iconColor: "text-amber-500",
        bgLight: "bg-amber-100",
        bgDark: "dark:bg-amber-900/20",
        border: "border-amber-500/20",
        containerBg: "bg-amber-50/50 dark:bg-amber-900/10"
    },
    "invalid-config": {
        icon: AlertCircle,
        title: "Form Not Ready",
        defaultMessage: "This form doesn't have any fields configured yet. The form creator needs to add questions before it can be used.",
        actionText: "Go Back",
        iconColor: "text-amber-500",
        bgLight: "bg-amber-100",
        bgDark: "dark:bg-amber-900/20",
        border: "border-amber-500/20",
        containerBg: "bg-amber-50/50 dark:bg-amber-900/10"
    },
};

export const ErrorDisplay = ({
    onRetry,
    message,
    fullPage = false,
    headerTitleSuffix,
    type = "connection",
    actionText,
}: ErrorDisplayProps) => {
    const config = errorConfig[type];
    const Icon = config.icon;
    const displayMessage = message || config.defaultMessage;
    const displayActionText = actionText || config.actionText;

    const iconColor = (config as any).iconColor || "text-foreground";

    const errorContent = (
        <div className={fullPage
            ? "w-full max-w-md mx-auto text-center flex flex-col items-center gap-8 py-12"
            : "w-full max-w-md mx-auto text-center flex flex-col items-center gap-6 py-12"
        }>
            <div className={`p-4 bg-background border shadow-sm ${fullPage ? 'rounded-2xl' : 'rounded-xl'}`}>
                <Icon className={`h-10 w-10 ${iconColor}`} />
            </div>

            <div className="space-y-3">
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    {config.title}
                </h3>
                <p className="text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {displayMessage}
                </p>
            </div>

            {onRetry && (
                <Button
                    variant={(type === "empty" || type === "form-closed") ? "default" : "outline"}
                    onClick={onRetry}
                    size="lg"
                    className="mt-4 font-semibold"
                >
                    {type === "empty" ? <Plus className="h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                    {displayActionText}
                </Button>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col">
                <AppHeader titleSuffix={headerTitleSuffix} />
                <div className="flex-1 flex items-center justify-center p-4">
                    {errorContent}
                </div>
            </div>
        );
    }

    return errorContent;
};
