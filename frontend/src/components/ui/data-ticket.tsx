import * as React from "react"
import { CheckCircle, UserCircle2 } from "lucide-react"

/*
  Data Ticket Component
  Now accepts dynamic user props for future Auth integration.
  Updated to match Moonlight Slate design system.
*/

interface DataTicketProps {
    user?: {
        name: string;
        id: string;
        email?: string;
        organization?: string;
        status?: string;
        avatar_url?: string;
    };
}

export function DataTicket({ user }: DataTicketProps) {
    // Fallback state if user is not authenticated (future-proofing)
    if (!user) {
        return (
            <div className="w-full rounded-lg border border-dashed border-border p-8 flex items-center justify-center bg-muted/30">
                <div className="text-center space-y-3">
                    <UserCircle2 className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Sign in to verify your identity.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative w-full rounded-lg border border-border overflow-hidden group bg-muted/30">
            {/* Striped Background Pattern */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: "linear-gradient(135deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)",
                    backgroundSize: "20px 20px"
                }}
            />

            <div className="absolute top-0 right-0 p-5 opacity-100 z-10 pointer-events-none">
                <div className="border border-primary/30 text-primary/50 font-semibold uppercase text-xs px-3 py-1.5 -rotate-12 tracking-widest rounded-md bg-primary/5">
                    Verified
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch relative z-0">
                {/* Image Area */}
                <div className="w-full md:w-52 bg-muted border-r border-border flex items-center justify-center p-8">
                    <div className="w-24 h-24 rounded-full bg-muted-foreground/10 overflow-hidden relative border border-border flex items-center justify-center shadow-sm">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full dark: dark: opacity-80" />
                        )}
                    </div>
                </div>

                {/* Data Area */}
                <div className="flex-1 p-8 flex flex-col justify-center gap-5 bg-card/50 backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-8">
                        <div>
                            <label className="block font-mono text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">
                                Full Name
                            </label>
                            <div className="font-mono text-base font-medium text-foreground">
                                {user.name}
                            </div>
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">
                                Respondent ID
                            </label>
                            <div className="font-mono text-base font-medium text-foreground">
                                {user.id}
                            </div>
                        </div>
                        {user.organization && (
                            <div>
                                <label className="block font-mono text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">
                                    Organization
                                </label>
                                <div className="font-mono text-base font-medium text-foreground">
                                    {user.organization}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
