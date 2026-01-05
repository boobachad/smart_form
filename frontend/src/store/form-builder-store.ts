import { create } from 'zustand';
import type { FormField } from '@/lib/types';
import type { FormSettings } from '@/components/form-builder/types';

interface FormBuilderState {
  title: string;
  description: string;
  icon: string;
  status: string;
  fieldsData: FormField[];
  formSettings: FormSettings | null;
  activeFieldId: string | null;

  // Actions
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setIcon: (icon: string) => void;
  setStatus: (status: string) => void;
  setFieldsData: (data: FormField[]) => void;
  setFormSettings: (settings: FormSettings) => void;
  setFormState: (state: Partial<FormBuilderState>) => void;
  setActiveFieldId: (id: string | null) => void;
  
  // Field Actions
  updateField: (id: string, updates: Partial<FormField>) => void;
  addField: (field: FormField) => void;
  removeField: (id: string) => void;
  duplicateField: (id: string, newId: string) => void;
}

export const useFormBuilderStore = create<FormBuilderState>((set) => ({
  title: "",
  description: "",
  icon: "",
  status: "draft",
  fieldsData: [],
  formSettings: null,
  activeFieldId: null,

  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setIcon: (icon) => set({ icon }),
  setStatus: (status) => set({ status }),
  setFieldsData: (fieldsData) => set({ fieldsData }),
  setFormSettings: (formSettings) => set({ formSettings }),
  setActiveFieldId: (activeFieldId) => set({ activeFieldId }),
  
  setFormState: (state) => set((prev) => ({ ...prev, ...state })),

  updateField: (id, updates) =>
    set((state) => ({
      fieldsData: state.fieldsData.map((field) =>
        field.id === id ? { ...field, ...updates } : field
      ),
    })),

  addField: (field) =>
    set((state) => ({
      fieldsData: [...state.fieldsData, field],
    })),

  removeField: (id) =>
    set((state) => ({
      fieldsData: state.fieldsData.filter((field) => field.id !== id),
    })),

  duplicateField: (id, newId) =>
    set((state) => {
      const fieldIndex = state.fieldsData.findIndex((f) => f.id === id);
      if (fieldIndex === -1) return state;

      const fieldToDuplicate = state.fieldsData[fieldIndex];
      const duplicatedField = {
        ...fieldToDuplicate,
        id: newId,
      };

      const newFields = [...state.fieldsData];
      newFields.splice(fieldIndex + 1, 0, duplicatedField);

      return { fieldsData: newFields, activeFieldId: newId };
    }),
}));
