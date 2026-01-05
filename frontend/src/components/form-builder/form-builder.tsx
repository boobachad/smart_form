import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldCard } from './field-card';
import { useFormBuilderStore } from '@/store/form-builder-store';

// --- Sortable Wrapper ---
const SortableFieldCard = ({ field, index, onUpdate, onDelete, onDuplicate, isActive, onSelect }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: field.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative touch-none">
            {/* The Field Card itself */}
            <FieldCard
                field={field}
                index={index}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                isActive={isActive}
                onSelect={onSelect}
                dragHandleProps={{ ...attributes, ...listeners }} // Pass drag props to child
            />
        </div>
    );
};

import { useShallow } from 'zustand/react/shallow';

export const FormBuilder = () => {
    const { 
        fieldsData: fields, 
        setFieldsData: onFieldsChange, 
        activeFieldId, 
        setActiveFieldId: onFieldSelect, 
        duplicateField: onDuplicateField 
    } = useFormBuilderStore(useShallow(s => ({
        fieldsData: s.fieldsData,
        setFieldsData: s.setFieldsData,
        activeFieldId: s.activeFieldId,
        setActiveFieldId: s.setActiveFieldId,
        duplicateField: s.duplicateField
    })));

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex((f) => f.id === active.id);
            const newIndex = fields.findIndex((f) => f.id === over.id);
            onFieldsChange(arrayMove(fields, oldIndex, newIndex));
        }
    };

    const onAddField = (type: string) => {
        const newField = {
            id: `f_${Date.now()}`,
            label: 'New Field',
            type: type,
        };
        onFieldsChange([...fields, newField]);
    };

    const onUpdateField = (id: string, updates: Record<string, any>) => {
        onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const onDeleteField = (id: string) => {
        onFieldsChange(fields.filter(f => f.id !== id));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col h-full">
                {/* Empty State with improved design */}
                {fields.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <div className="text-center max-w-md space-y-6">
                            {/* Animated icon area */}
                            <div className="relative inline-flex">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
                                <div className="relative h-24 w-24 mx-auto rounded-3xl flex items-center justify-center border-2 border-primary/30">
                                    <Plus className="h-12 w-12 text-primary" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-2xl font-bold tracking-tight">Start Building Your Form</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    Add form fields to collect information from respondents. You can add text inputs, smart verification fields, and more.
                                </p>
                            </div>

                            {/* Enhanced add field buttons */}
                            <div className="flex flex-col gap-3 pt-4">
                                <div className="flex gap-3">
                                    <Button
                                        size="lg"
                                        onClick={() => onAddField('text')}
                                        className="flex-1 h-12 shadow-sm"
                                    >
                                        <Plus className="h-5 w-5 mr-2" />
                                        Text
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        onClick={() => onAddField('email')}
                                        className="flex-1 h-12 shadow-sm border border-border"
                                    >
                                        <Plus className="h-5 w-5 mr-2" />
                                        Email
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        onClick={() => onAddField('number')}
                                        className="flex-1 h-12 shadow-sm border border-border"
                                    >
                                        <Plus className="h-5 w-5 mr-2" />
                                        Number
                                    </Button>
                                </div>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => onAddField('smart_field')}
                                    className="h-12 border-2 border-primary/50 hover:bg-primary/10 hover:border-primary group"
                                >
                                    <Plus className="h-5 w-5 mr-2 group-hover:rotate-90" />
                                    Add Smart Verification Field
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Field List with improved spacing */
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-3xl mx-auto space-y-4">
                            <SortableContext
                                items={fields.map(f => f.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {fields.map((field, idx) => (
                                    <SortableFieldCard
                                        key={field.id}
                                        field={field}
                                        index={idx}
                                        onUpdate={onUpdateField}
                                        onDelete={() => onDeleteField(field.id)}
                                        onDuplicate={() => onDuplicateField(field.id, crypto.randomUUID())}
                                        isActive={activeFieldId === field.id}
                                        onSelect={() => onFieldSelect(field.id)}
                                    />
                                ))}
                            </SortableContext>

                            {/* Add field buttons at bottom with better styling */}
                            <div className="flex gap-3 pt-6">
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => onAddField('text')}
                                    className="flex-1 h-14 border border-border hover:border-primary hover:bg-primary/5"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Text
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => onAddField('email')}
                                    className="flex-1 h-14 border border-border hover:border-primary hover:bg-primary/5"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Email
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => onAddField('number')}
                                    className="flex-1 h-14 border border-border hover:border-primary hover:bg-primary/5"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Number
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => onAddField('smart_field')}
                                    className="flex-1 h-14 border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Smart Field
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DndContext>
    );
};