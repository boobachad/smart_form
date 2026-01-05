const API_URL = import.meta.env.VITE_SERVER_URL || "/api/v1";

const getStoredSession = () => {
	const email = typeof window !== "undefined" ? localStorage.getItem("user_email") : null;
	const name = typeof window !== "undefined" ? localStorage.getItem("user_name") : null;
	const userId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
	const role = typeof window !== "undefined" ? parseInt(localStorage.getItem("user_role") || "1", 10) : 1;

	if (!email) return null;

	return {
		user: {
			id: userId || "user-id-unknown",
			name: name || email.split('@')[0],
			email: email,
			role: role,
			image: "",
			emailVerified: true,
			createdAt: new Date(),
			updatedAt: new Date()
		},
		session: {
			id: "session-id",
			userId: "user-id",
			expiresAt: new Date(Date.now() + 86400000),
			token: "token",
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: "",
			userAgent: ""
		}
	};
};

import { auth, googleProvider } from "./firebase";
import { signInWithPopup } from "firebase/auth";

export const authClient = {
	loginWithGoogle: async () => {
		try {
			if (!auth || !googleProvider) {
				throw new Error("Firebase not configured. Check .env and restart server.");
			}
			const result = await signInWithPopup(auth, googleProvider);
			const token = await result.user.getIdToken();

			const res = await apiRequest("/auth/google-login", {
				method: "POST",
				body: JSON.stringify({ token }),
			}) as { user: { id: string; email: string; name: string; role: number; } };

			localStorage.setItem("user_email", res.user.email);
			localStorage.setItem("user_name", res.user.name || result.user.displayName || "User");
			localStorage.setItem("user_id", res.user.id);
			localStorage.setItem("user_role", String(res.user.role || 1));

			return { success: true, user: res.user };
		} catch (error) {
			console.error("AuthClient LoginWithGoogle Failed:", error);
			throw error;
		}
	},
	getSession: async () => {
		return getStoredSession();
	},
	useSession: () => {
		const session = getStoredSession();
		return {
			data: session,
			isPending: false,
			error: null
		};
	},
	signOut: async (options?: { fetchOptions?: { onSuccess?: () => void } }) => {
		console.log("Signing out implementation");
		localStorage.removeItem("user_email");
		localStorage.removeItem("user_name");
		localStorage.removeItem("user_id");
		localStorage.removeItem("user_role");

		if (options?.fetchOptions?.onSuccess) {
			options.fetchOptions.onSuccess();
		}
		return { success: true };
	},
	syncSession: async () => {
		try {
			const res = await apiRequest("/auth/me") as { user: { id: string; email: string; name: string; role: number; } };
			if (res && res.user) {
				const currentRole = parseInt(localStorage.getItem("user_role") || "1", 10);
				// If the backend has upgraded/downgraded the user's role, silently overwrite the stale cache
				if (currentRole !== res.user.role) {
					localStorage.setItem("user_role", String(res.user.role || 1));
					localStorage.setItem("user_email", res.user.email);
					localStorage.setItem("user_id", res.user.id);

					// Force a hard reload so React Router re-evaluates all loaders
					// and immediately kicks them out of protected routes if downgraded.
					window.location.reload();
				}
			}
		} catch (e) {
			// Fail silently in the background
		}
	},
	login: async (email: string) => {
		throw new Error("Only Google Login is supported");
	}
};

import { z } from "zod";

let cachedCsrfToken = "";

async function getCsrfToken(): Promise<string> {
	if (cachedCsrfToken) return cachedCsrfToken;
	try {
		const res = await fetch(`${API_URL}/csrf`, { credentials: "include" });
		if (res.ok) {
			const data = await res.json();
			cachedCsrfToken = data.csrfToken;
			return cachedCsrfToken;
		}
	} catch (err) {
		console.error("Failed to fetch CSRF token", err);
	}
	return "";
}

// Simple fetch wrapper for authenticated requests
export async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}, schema?: z.ZodSchema<T>): Promise<T> {
	const url = `${API_URL}${endpoint}`;

	// Default headers
	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...options.headers,
	};

	// Method-based headers
	if (options.method && ["POST", "PUT", "PATCH", "DELETE"].includes(options.method.toUpperCase())) {
		(headers as Record<string, string>)["Idempotency-Key"] = crypto.randomUUID();
		const csrf = await getCsrfToken();
		if (csrf) {
			(headers as Record<string, string>)["X-CSRF-TOKEN"] = csrf;
		}
	}

	let response;
	try {
		response = await fetch(url, {
			...options,
			headers,
			credentials: "include",
		});
	} catch (err: unknown) {
		console.error("API Network Error:", err);
		throw new Error("Unable to connect to server. Please check your internet connection or try again later.");
	}

	if (!response.ok) {
		const data = await response.json().catch(() => null);
		const errorMsg = data?.error || `API Error: ${response.statusText}`;

		// If CSRF mismatched, clear cache for next time
		if (response.status === 403 && errorMsg.includes("CSRF")) {
			cachedCsrfToken = "";
		}

		// Handle 401 Unauthorized globally
		if (response.status === 401 || errorMsg.includes("Unauthorized") || errorMsg.includes("invalid token")) {
			localStorage.removeItem("user_email");
			localStorage.removeItem("user_name");
			localStorage.removeItem("user_id");
			localStorage.removeItem("user_role");
		}

		throw new Error(errorMsg);
	}

	const data = await response.json();

	if (schema) {
		try {
			return schema.parse(data);
		} catch (error) {
			console.error("Zod Validation Error:", error);
			throw new Error("Invalid response format from server");
		}
	}

	return data as T;
}
