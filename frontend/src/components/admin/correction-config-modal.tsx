import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertCircle, Send, Edit } from "lucide-react";


interface CorrectionModalProps {
    count: number;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (message: string, selectedFields: string[]) => void;
    availableFields?: { id: string, label: string }[];
    // Edit mode props
    isEdit?: boolean;
    existingMessage?: string;
    existingFields?: string[];
}

export const CorrectionModal = ({
    count,
    isOpen,
    onClose,
    onSubmit,
    availableFields = [],
    isEdit = false,
    existingMessage = "",
    existingFields = []
}: CorrectionModalProps) => {
    const [message, setMessage] = useState(existingMessage);
    const [selectedFields, setSelectedFields] = useState<string[]>(existingFields);

    useEffect(() => {
        if (isOpen) {
            setMessage(existingMessage);
            setSelectedFields(existingFields);
        }
    }, [isOpen, existingMessage, existingFields]);

    // Toggle field logic
    const toggleField = (id: string) => {
        if (selectedFields.includes(id)) {
            setSelectedFields(prev => prev.filter(f => f !== id));
        } else {
            setSelectedFields(prev => prev.concat(id));
        }
    };

    const handleSubmit = () => {
        onSubmit(message, selectedFields);
        onClose();
        setMessage(""); // Reset
        setSelectedFields([]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-warning">
                        {isEdit ? <Edit className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {isEdit ? `Edit Correction Request (${count})` : `Request Correction (${count})`}
                    </DialogTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                        {isEdit
                            ? `Updating correction request for ${count} candidate(s).`
                            : `Flagging ${count} candidate(s). They will be notified to correct their data.`
                        }
                    </div>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Which fields require correction?</Label>
                        <div className="flex gap-2 flex-wrap">
                            {availableFields.map(field => (
                                <div
                                    key={field.id}
                                    onClick={() => toggleField(field.id)}
                                    className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium border ${selectedFields.includes(field.id) ? "bg-warning/10 text-warning-foreground border-warning/30 dark:bg-warning/20 dark:text-warning dark:border-warning/50" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
                                >
                                    {field.label}
                                    {selectedFields.includes(field.id) && <CheckCircle2 className="w-3 h-3 inline ml-1.5 align-text-bottom" />}
                                </div>
                            ))}
                            {availableFields.length === 0 && <span className="text-xs text-muted-foreground italic">No specific fields available.</span>}
                        </div>
                    </div>



                    <div className="space-y-2">
                        <Label htmlFor="message">Instructions for Users</Label>
                        <Textarea
                            id="message"
                            placeholder="e.g. Please make your profile public and sync again."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="h-24 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} className="bg-warning hover:bg-warning/90 text-white">
                        {isEdit ? <Edit className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        {isEdit ? 'Update Request' : 'Send Request'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
