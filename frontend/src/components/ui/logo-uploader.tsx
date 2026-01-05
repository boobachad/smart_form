import { LayoutTemplate, Upload } from "lucide-react";

interface LogoUploaderProps {
    value: string;
    onChange: (url: string) => void;
    label?: string;
}

export const LogoUploader = ({ value, onChange, label = "Upload" }: LogoUploaderProps) => {
    return (
        <div className="flex flex-col gap-4 items-center">
            {/* Icon Uploader */}
            <div className={value ? "size-32 relative group/icon overflow-hidden flex items-center justify-center" : "size-32 relative group/icon overflow-hidden flex items-center justify-center rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/50"}>
                {value ? (
                    <img src={value} alt={label} className="max-w-full max-h-full object-contain" />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/30 group-hover/icon:text-primary/50">
                        <LayoutTemplate className="size-10" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
                    </div>
                )}
            </div>
            
            {/* Stylish URL Input */}
            <div className="w-32 group/url relative">
                <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                    <label className="text-[10px] font-bold text-muted-foreground/50">URL</label>
                </div>
                <input 
                    type="text" 
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="..." 
                    aria-label={`${label} URL`}
                    className="w-full h-8 pl-8 pr-2 text-[10px] bg-background/50 border border-border/40 rounded-lg focus:outline-none focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10 font-mono text-muted-foreground focus:text-foreground transition-all"
                />
            </div>
        </div>
    );
};
