import React from "react";

interface LoadingProps {
    /** Size variant */
    size?: "sm" | "md" | "lg" | "full";
    /** Optional message to display below the loader */
    message?: string;
}

/**
 * SmartForms domain-specific loading animation
 * Animated form with filling fields
 */
export function Loading({ size = "md", message }: LoadingProps) {
    const sizes = {
        sm: { width: "w-32", height: "h-24" },
        md: { width: "w-48", height: "h-36" },
        lg: { width: "w-64", height: "h-48" },
        full: { width: "w-72", height: "h-56" },
    };

    const containerClasses = {
        sm: "",
        md: "",
        lg: "",
        full: "min-h-screen flex items-center justify-center",
    };

    const sizeConfig = sizes[size];

    return (
        <div className={`flex flex-col items-center justify-center gap-6 ${containerClasses[size]}`}>
            {/* Animated Form Document */}
            <div className={`${sizeConfig.width} ${sizeConfig.height} relative`}>
                {/* Document/Paper background */}
                <div className="absolute inset-0 bg-card border-2 border-border rounded-lg shadow-xl overflow-hidden">
                    {/* Header bar */}
                    <div className="h-8 bg-primary/10 border-b border-border flex items-center gap-2 px-3">
                        <div className="h-2 w-16 bg-primary/30 rounded-full" />
                    </div>

                    {/* Form fields being filled */}
                    <div className="p-4 space-y-3">
                        {/* Field 1 - Animated fill */}
                        <div className="space-y-1.5">
                            <div className="h-2 w-12 bg-muted rounded" />
                            <div className="h-8 bg-muted/50 rounded border border-border relative overflow-hidden">
                                <div className="absolute inset-0 bg-primary/20 -1" />
                            </div>
                        </div>

                        {/* Field 2 - Animated fill with delay */}
                        <div className="space-y-1.5">
                            <div className="h-2 w-16 bg-muted rounded" style={{ animationDelay: '0.2s' }} />
                            <div className="h-8 bg-muted/50 rounded border border-border relative overflow-hidden">
                                <div className="absolute inset-0 bg-primary/20 -2" />
                            </div>
                        </div>

                        {/* Field 3 - Animated fill with more delay */}
                        <div className="space-y-1.5">
                            <div className="h-2 w-14 bg-muted rounded" style={{ animationDelay: '0.4s' }} />
                            <div className="h-8 bg-muted/50 rounded border border-border relative overflow-hidden">
                                <div className="absolute inset-0 bg-primary/20 -3" />
                            </div>
                        </div>

                        {/* Checkbox area - appearing checkmarks */}
                        <div className="flex items-center gap-2 pt-2">
                            <div className="h-4 w-4 border-2 border-primary rounded flex items-center justify-center -1">
                                <svg className="w-3 h-3 text-primary opacity-0 -appear-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="h-4 w-4 border-2 border-primary rounded flex items-center justify-center -2">
                                <svg className="w-3 h-3 text-primary opacity-0 -appear-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="h-4 w-4 border-2 border-primary rounded flex items-center justify-center -3">
                                <svg className="w-3 h-3 text-primary opacity-0 -appear-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Floating particles/dots */}
                    <div className="absolute top-4 right-4 h-1 w-1 rounded-full bg-primary/40 -1" />
                    <div className="absolute top-8 right-6 h-1 w-1 rounded-full bg-violet-400/40 -2" />
                    <div className="absolute bottom-8 right-5 h-1 w-1 rounded-full bg-primary/40 -3" />
                </div>

                {/* Logo badge on document */}
                <div className="absolute -top-3 -right-3 h-12 w-12 bg-card border-2 border-primary rounded-xl shadow-lg overflow-hidden -in">
                    <img src="/assets/logo.png" alt="SmartForms" className="h-full w-full object-cover" />
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground -in">{message}</p>
                </div>
            )}

            {/* Animations */}
            <style>{`
				@keyframes fill-1 {
					0%, 100% { transform: translateX(-100%); }
					30%, 70% { transform: translateX(0%); }
				}
				@keyframes fill-2 {
					0%, 20%, 100% { transform: translateX(-100%); }
					50%, 90% { transform: translateX(0%); }
				}
				@keyframes fill-3 {
					0%, 40%, 100% { transform: translateX(-100%); }
					70%, 100% { transform: translateX(0%); }
				}
				@keyframes check-appear-1 {
					0%, 40% { opacity: 0; transform: scale(0); }
					50%, 100% { opacity: 1; transform: scale(1); }
				}
				@keyframes check-appear-2 {
					0%, 60% { opacity: 0; transform: scale(0); }
					70%, 100% { opacity: 1; transform: scale(1); }
				}
				@keyframes check-appear-3 {
					0%, 80% { opacity: 0; transform: scale(0); }
					90%, 100% { opacity: 1; transform: scale(1); }
				}
				@keyframes float-1 {
					0%, 100% { transform: translateY(0px); opacity: 0.4; }
					50% { transform: translateY(-10px); opacity: 0.8; }
				}
				@keyframes float-2 {
					0%, 100% { transform: translateY(0px); opacity: 0.3; }
					50% { transform: translateY(-15px); opacity: 0.7; }
				}
				@keyframes float-3 {
					0%, 100% { transform: translateY(0px); opacity: 0.5; }
					50% { transform: translateY(-8px); opacity: 0.9; }
				}
				@keyframes scale-in {
					0% { transform: scale(0) rotate(-180deg); }
					50% { transform: scale(1.1) rotate(10deg); }
					100% { transform: scale(1) rotate(0deg); }
				}
				@keyframes fade-in {
					from { opacity: 0; }
					to { opacity: 1; }
				}
				.-1 { animation: fill-1 3s ease-in-out infinite; }
				.-2 { animation: fill-2 3s ease-in-out infinite; }
				.-3 { animation: fill-3 3s ease-in-out infinite; }
				.-appear-1 { animation: check-appear-1 3s ease-in-out infinite; }
				.-appear-2 { animation: check-appear-2 3s ease-in-out infinite; }
				.-appear-3 { animation: check-appear-3 3s ease-in-out infinite; }
				.-1 { animation: float-1 2s ease-in-out infinite; }
				.-2 { animation: float-2 2.5s ease-in-out infinite; }
				.-3 { animation: float-3 3s ease-in-out infinite; }
				.-in { animation: scale-in 1s ease-out; }
				.-in { animation: fade-in 0.5s ease-out; }
			`}</style>
        </div>
    );
}

/**
 * Inline spinner for buttons
 */
export function LoadingSpinner({ className = "" }: { className?: string }) {
    return (
        <div className={`inline-flex items-center justify-center ${className}`}>
            <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
        </div>
    );
}
