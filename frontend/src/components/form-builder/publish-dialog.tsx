import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, PauseCircle } from "lucide-react";
import { AccessControlSettings } from "./access-control-settings";
import type { FormSettings } from "./types";
import { useFormBuilderStore } from "@/store/form-builder-store";
import { useShallow } from 'zustand/react/shallow';

interface PublishDialogProps {
    onStatusChange: (newStatus: string) => void;
}

export const PublishDialog = ({ onStatusChange }: PublishDialogProps) => {
    const { status, formSettings: settings, setFormSettings: onSettingsChange, fieldsData, title } = useFormBuilderStore(useShallow(s => ({
        status: s.status,
        formSettings: s.formSettings,
        setFormSettings: s.setFormSettings,
        fieldsData: s.fieldsData,
        title: s.title
    })));
    const [isOpen, setIsOpen] = useState(false);

    if (!settings) return null;

    const handleAccessChange = (updates: Partial<FormSettings['access_control']>) => {
        onSettingsChange({
            ...settings,
            access_control: {
                ...settings.access_control,
                ...updates
            }
        });
    };

    const handleAction = (targetStatus: string) => {
        onStatusChange(targetStatus);
        setIsOpen(false);
    };

    const isPublished = status === 'active';
    const canPublish = fieldsData.length > 0 && title && title.trim() !== '';

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    className={`h-8 px-3 text-xs font-semibold rounded shadow-sm flex items-center gap-2 ${isPublished ? "bg-warning/10 text-warning-foreground border border-warning/20 hover:bg-warning/20" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`}
                >
                    {isPublished ? <PauseCircle className="size-3.5" /> : <Upload className="size-3.5" />}
                    {isPublished ? "Pause / Unpublish" : "Publish"}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isPublished ? "Pause Form Collection" : "Publish Form"}</DialogTitle>
                    <DialogDescription>
                        {isPublished
                            ? "Unpublishing will make this form inaccessible to users. Existing data remains safe."
                            : "Configure who can access this form before publishing."}
                    </DialogDescription>
                </DialogHeader>

                {/* Only show Access Settings if we are publishing or already published */}
                <div className="py-4">
                    <div className={`${isPublished ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <AccessControlSettings
                            accessControl={settings.access_control}
                            onChange={handleAccessChange}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>

                    {isPublished ? (
                        <Button onClick={() => handleAction('draft')} variant="destructive" className="gap-2">
                            <PauseCircle className="h-4 w-4" />
                            Unpublish Form
                        </Button>
                    ) : (
                        <div className="flex flex-col items-end gap-1">
                            <Button 
                                onClick={() => handleAction('active')} 
                                className="gap-2"
                                disabled={!canPublish}
                            >
                                <CheckCircle className="h-4 w-4" />
                                Publish Now
                            </Button>
                            {!canPublish && (
                                <span className="text-[10px] text-destructive">
                                    Add a title and at least one field to publish.
                                </span>
                            )}
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
