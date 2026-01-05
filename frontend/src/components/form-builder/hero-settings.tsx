import React from 'react';
import { LogoUploader } from '@/components/ui/logo-uploader';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useFormBuilderStore } from '@/store/form-builder-store';
import { useShallow } from 'zustand/react/shallow';

export const HeroSettings = () => {
    const { title, description, icon, formSettings, setTitle, setDescription, setIcon, setFormSettings } = useFormBuilderStore(useShallow(s => ({
        title: s.title,
        description: s.description,
        icon: s.icon,
        formSettings: s.formSettings,
        setTitle: s.setTitle,
        setDescription: s.setDescription,
        setIcon: s.setIcon,
        setFormSettings: s.setFormSettings,
    })));

    const showIdentityCard = formSettings?.respondent_experience?.show_identity_card ?? true;

    const toggleIdentityCard = (checked: boolean) => {
        setFormSettings({
            ...(formSettings || {}),
            respondent_experience: {
                ...(formSettings?.respondent_experience || {}),
                show_identity_card: checked,
            },
        } as any);
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl hover:shadow-2xl hover:shadow-primary/5 group/hero mb-12">
            {/* Ambient Background Glow */}
            <div className="absolute -top-40 -right-40 size-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover/hero:bg-primary/10" />
            <div className="absolute -bottom-40 -left-40 size-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover/hero:bg-primary/10" />

            <div className="relative p-10 flex flex-col md:flex-row items-start gap-12">
                
                {/* Icon Branding Column */}
                <div className="shrink-0 flex flex-col gap-4 items-center">
                    <div className="space-y-2 w-full text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Form Icon</span>
                        
                        <LogoUploader 
                            value={icon} 
                            onChange={setIcon} 
                            label="Form Icon" 
                        />
                    </div>
                </div>

                {/* Main Content Column */}
                <div className="flex-1 space-y-8 w-full pt-2">
                    {/* Title Section */}
                    <div className="space-y-4 group/title">
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border/50" />
                            <label htmlFor="form-title" className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 group-focus-within/title:text-primary">Form Title <span className="text-destructive">*</span></label>
                            <div className="h-px flex-1 bg-border/50" />
                        </div>
                        
                        <div className="relative">
                            <input 
                                id="form-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent text-5xl font-black tracking-tight text-foreground placeholder:text-muted-foreground/20 focus:outline-none border-none p-0 leading-tight text-center md:text-left"
                                placeholder="Untitled Form"
                                required
                                aria-describedby="form-title-desc"
                            />
                            <span id="form-title-desc" className="sr-only">Enter the title of your form</span>
                            {/* Animated Underline */}
                            <div className="absolute -bottom-2 left-0 right-0 h-1 scale-x-50 opacity-0 group-focus-within/title:opacity-100 group-focus-within/title:scale-x-100 ease-out" />
                        </div>
                    </div>

                    {/* Description Section */}
                    <div className="space-y-3 group/desc">
                        <label htmlFor="form-description" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1 group-focus-within/desc:text-primary/70">Description</label>
                        <div className="relative">
                            <textarea 
                                id="form-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-muted/30 hover:bg-muted/50 focus:bg-background border border-border/10 focus:border-primary/20 rounded-2xl p-6 text-lg text-muted-foreground focus:text-foreground resize-none shadow-inner focus:shadow-xl focus:shadow-primary/5 focus:ring-0 outline-none min-h-[8rem] leading-relaxed"
                                placeholder="Add a detailed description to guide your respondents..."
                                aria-describedby="form-desc-help"
                            />
                            <span id="form-desc-help" className="sr-only">Provide a description for your form respondents</span>
                        </div>
                    </div>

                    {/* Identity Card Toggle */}
                    <div className="flex items-center justify-between py-3 px-1">
                        <Label htmlFor="identity-card-toggle" className="text-xs font-semibold text-muted-foreground cursor-pointer">
                            Show identity card to respondents
                        </Label>
                        <Switch
                            id="identity-card-toggle"
                            checked={showIdentityCard}
                            onCheckedChange={toggleIdentityCard}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
