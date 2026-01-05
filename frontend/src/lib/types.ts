import { z } from "zod";

export interface FormField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[]; 
  placeholder?: string;
  description?: string;
  validation?: Record<string, any>;
  verification?: Record<string, any>;
  verification_config?: Record<string, any>;
  logic?: Record<string, any>;
  retry_policy?: Record<string, any>;
  [key: string]: unknown;
}

export interface Form {
  id: string;
  title: string;
  status: string;
  created_at: string;
  fields?: FormField[];
  config?: Record<string, any>;
  responses?: number;
  verified_pct?: number;
  flagged?: number;
  user_id?: string;
  [key: string]: unknown;
}

export interface VerificationResult {
  status: string;
  score?: number;
  reason?: string;
  details?: Record<string, any>;
}

export interface Submission {
  id: string;
  form_id: string;
  status: string;
  data: Record<string, any>;
  verification_results?: Record<string, VerificationResult>;
  created_at: string;
}

// Zod schemas for runtime validation
export const FormFieldSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  verification: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const FormSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  created_at: z.string(),
  fields: z.array(FormFieldSchema).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  responses: z.number().optional(),
  verified_pct: z.number().optional(),
  flagged: z.number().optional(),
  user_id: z.string().optional(),
}).passthrough();

export const VerificationResultSchema = z.object({
  status: z.string(),
  score: z.number().optional(),
  reason: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const SubmissionSchema = z.object({
  id: z.string(),
  form_id: z.string(),
  status: z.string(),
  data: z.record(z.string(), z.unknown()),
  verification_results: z.record(z.string(), VerificationResultSchema).optional(),
  created_at: z.string(),
});
