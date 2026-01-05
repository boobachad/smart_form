import { cn } from "@/lib/utils";
import { Building2, LayoutTemplate } from "lucide-react";

interface FormLogoHeaderProps {
    organizationLogo?: string;
    organizationName?: string;
    formLogo?: string;
    formTitle?: string;
}

export const FormLogoHeader = ({
    organizationLogo,
    organizationName,
    formLogo,
    formTitle
}: FormLogoHeaderProps) => {
    // If no organization branding, return null (or maybe a minimal spacer?)
    if (!organizationLogo && !organizationName) return null;

    return (
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-border/50 bg-card dark:bg-white/5 shadow-sm group/hero">

            <div className="relative p-6 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                {/* Icon Branding Column */}
                <div className="shrink-0">
                    <div className="size-24 flex items-center justify-center relative overflow-hidden">
                        {organizationLogo ? (
                            <img src={organizationLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground/30">
                                <Building2 className="size-8" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Organization Details */}
                <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        Official Form
                    </span>
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">
                        {organizationName || "Organization"}
                    </h3>
                    {/* If we wanted to show the Form Logo alongside, we could, but the user liked the Org Branding specific look */}
                </div>

                {/* Right: Form Logo Badge (Optional - mostly for Event specific sub-brands) */}
                {formLogo && (
                    <div className="hidden md:flex flex-col items-center gap-2 border-l border-border/50 pl-8 opacity-80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Details</span>
                        <div className="size-16 flex items-center justify-center">
                            <img src={formLogo} className="max-w-full max-h-full object-contain" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
