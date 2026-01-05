import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Extended Tailwind merge configuration to support custom theme classes
 */
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"],
		},
	},
});

/**
 * Utility function to merge Tailwind CSS classes with clsx
 * Handles class conflicts and merges them intelligently
 * 
 * @param inputs - Class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Alias for cn() - same functionality
 * @deprecated Use cn() instead for consistency
 */
export const cx = cn;
