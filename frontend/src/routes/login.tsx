import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/ui/loading";

const BASE_URL = (import.meta.env.VITE_SERVER_URL as string || "http://localhost:8080/api/v1").replace("/api/v1", "");

export default function Login() {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [backendStatus, setBackendStatus] = useState(false);
	const [dbStatus, setDbStatus] = useState(false);

	// Check Backend Status
	useEffect(() => {
		const checkStatus = async () => {
			try {
				const res = await fetch(`${BASE_URL}/health`);
				setBackendStatus(true);
				try {
					const data = await res.json();
					setDbStatus(data.db === "connected");
				} catch (jsonErr) {
					setDbStatus(false);
				}
			} catch (e) {
				setBackendStatus(false);
				setDbStatus(false);
			}
		};
		checkStatus();
		const interval = setInterval(checkStatus, 5000);
		return () => clearInterval(interval);
	}, []);

	const handleLoginWithGoogle = async () => {
		setError("");
		setIsLoading(true);
		try {
			await authClient.loginWithGoogle();
			toast.success("Logged in successfully");

			const params = new URLSearchParams(window.location.search);
			const returnUrl = params.get('returnUrl');

			if (returnUrl) {
				navigate(decodeURIComponent(returnUrl));
			} else {
				const session = await authClient.getSession();
				if (session?.user?.role === 2) {
					navigate("/workspace");
				} else {
					navigate("/");
				}
			}
		} catch (err: unknown) {
			console.error("Login caught error:", err);

			let msg = "Failed to login with Google";
			let code: string | undefined;

			if (err instanceof Error) {
				code = (err as { code?: string; cause?: { code?: string } }).code || ((err.cause as { code?: string })?.code);
				if (err.message) {
					msg = err.message;
				}
			} else if (typeof err === "string") {
				msg = err;
			}

			if (code === 'auth/popup-closed-by-user') {
				msg = "Login cancelled (popup closed)";
			} else if (code === 'auth/popup-blocked') {
				msg = "Login popup blocked by browser. Please allow popups.";
			}

			setError(msg);
			toast.error(msg);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<AppHeader />

			<div className="flex-1 flex items-center justify-center p-4">
				<div className="w-full max-w-md space-y-8">

					<div className="text-center space-y-4">
						<div className="inline-flex">
							<div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg">
								<img src="/assets/logo.png" alt="SmartForms" className="h-full w-full object-cover" />
							</div>
						</div>
						<div className="space-y-2">
							<h1 className="text-4xl font-bold tracking-tight">Welcome</h1>
							<p className="text-muted-foreground">
								Sign in to continue to SmartForms
							</p>
						</div>
					</div>

					<Card className="p-8 shadow-xl border-border">
						<div className="space-y-6">
							<Button
								type="button"
								onClick={handleLoginWithGoogle}
								className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg"
								disabled={isLoading}
							>
								{isLoading ? (
									<LoadingSpinner className="h-5 w-5" />
								) : (
									<>
										<Mail className="h-5 w-5 mr-2" />
										Continue with Google
									</>
								)}
							</Button>

							{error && (
								<div className="flex items-start gap-3 p-4 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
									<AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
									<div>
										<p className="font-semibold">Authentication Error</p>
										<p className="text-xs mt-1 opacity-90">{error}</p>
									</div>
								</div>
							)}

							<div className="pt-4 border-t border-border">
								<div className="flex items-center justify-center gap-6 text-xs">
									<div className="flex items-center gap-2">
										<span className={`h-2 w-2 rounded-full ${backendStatus ? "bg-emerald-500" : "bg-red-500"}`} />
										<span className="text-muted-foreground font-medium">
											API {backendStatus ? "Online" : "Offline"}
										</span>
									</div>
									<div className="h-3 w-px bg-border" />
									<div className="flex items-center gap-2">
										<span className={`h-2 w-2 rounded-full ${dbStatus ? "bg-emerald-500" : "bg-red-500"}`} />
										<span className="text-muted-foreground font-medium">
											DB {dbStatus ? "Connected" : "Offline"}
										</span>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Footer */}
					<p className="text-center text-xs text-muted-foreground leading-relaxed">
						By continuing, you agree to our{" "}
						<span className="text-foreground hover:underline cursor-pointer">Terms</span>
						{" "}and{" "}
						<span className="text-foreground hover:underline cursor-pointer">Privacy Policy</span>
					</p>
				</div>
			</div>
		</div>
	);
}
