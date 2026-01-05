import { redirect } from "react-router";
import { isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/_index";

export async function clientLoader() {
	const userRole = parseInt(localStorage.getItem("user_role") || "0", 10);
	if (userRole === 0) {
		return redirect("/login");
	}
	if ((userRole & 2) !== 0) {
		return redirect("/workspace");
	}
	return redirect("/respondent");
}



import { ErrorDisplay } from "@/components/ui/error-display";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	console.error(error);
	return <ErrorDisplay fullPage type="connection" message={isRouteErrorResponse(error) ? `${error.status} - ${error.statusText}` : "An unexpected error occurred."} onRetry={() => window.location.reload()} />;
}

export default function Index() {
	return null;
}
