import { useState } from "react";
import { useNavigate, Link, redirect, isRouteErrorResponse, useLoaderData, useRevalidator } from "react-router";
import type { Route } from "./+types/workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Plus,
	Search,
	MoreVertical,
	FileText,
	Users,
	ExternalLink,
	WifiOff,
	RotateCcw,
	Loader2,
	CheckCircle2,
	AlertTriangle,
	LayoutTemplate,
	Clock,
	X
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { Loading } from "@/components/ui/loading";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Label } from "@/components/ui/label";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

import { apiRequest } from "@/lib/auth-client";

export async function clientLoader() {
	const role = parseInt(localStorage.getItem("user_role") || "1", 10);
	if ((role & 2) === 0) {
		return redirect("/");
	}

	try {
		const res = await apiRequest("/forms") as { forms: import("@/lib/types").Form[] };
		return { forms: res.forms || [] };
	} catch (error: any) {
		if (error?.message?.includes("Unauthorized") || error?.message?.includes("invalid token")) {
			return redirect("/login");
		}
		throw error;
	}
}



export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	if (isRouteErrorResponse(error)) {
		return <h1>{error.status} - {error.statusText}</h1>;
	}
	return <ErrorDisplay fullPage={true} onRetry={() => window.location.reload()} />;
}

export default function workspace({ loaderData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newFormTitle, setNewFormTitle] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const revalidator = useRevalidator();
	const { forms } = loaderData;
	const isLoading = revalidator.state === "loading";
	const fetchError = false;

	const fetchForms = () => {
		revalidator.revalidate();
	};

	// Rename State
	const [isRenameOpen, setIsRenameOpen] = useState(false);
	const [selectedForm, setSelectedForm] = useState<import("@/lib/types").Form | null>(null);
	const [renameTitle, setRenameTitle] = useState("");

	const handleRenameInit = (form: import("@/lib/types").Form) => {
		setSelectedForm(form);
		setRenameTitle(form.title);
		setIsRenameOpen(true);
	};

	const handleRenameSubmit = async () => {
		if (!selectedForm || !renameTitle.trim()) return;
		try {
			// Use the full form update - fetch current form first, then update with new title
			const currentForm = await apiRequest(`/forms/${selectedForm.id}/manage`) as { form: import("@/lib/types").Form };
			await apiRequest(`/forms/${selectedForm.id}`, {
				method: "PUT",
				body: JSON.stringify({
					title: renameTitle,
					fields: currentForm.form.fields || [],
					config: currentForm.form.config || {}
				})
			});
			setIsRenameOpen(false);
			fetchForms(); // Refresh list
		} catch (e) {
			console.error(e);
			toast.error("Failed to rename form");
		}
	};

	const handleStatusToggle = async (form: import("@/lib/types").Form) => {
		const newStatus = form.status === 'active' ? 'draft' : 'active';
		try {
			await apiRequest(`/forms/${form.id}/status`, {
				method: 'PATCH',
				body: JSON.stringify({ status: newStatus })
			});
			fetchForms(); // Refresh
		} catch (e) {
			console.error(e);
			toast.error("Failed to update status");
		}
	};

	const { confirm, dialog: confirmDialog } = useConfirmDialog();

	const handleDelete = async (id: string) => {
		console.log("Delete triggered for form:", id);
		const confirmed = await confirm({
			title: "Delete Form",
			description: "Are you sure you want to delete this form? This action cannot be undone.",
			confirmText: "Delete",
			variant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		try {
			console.log("Calling DELETE API for:", id);
			await apiRequest(`/forms/${id}`, { method: 'DELETE' });
			console.log("Delete successful");
			fetchForms(); // Refresh list
		} catch (e) {
			console.error("Delete failed:", e);
			toast.error("Failed to delete form");
		}
	};

	// Auth & Data Fetch handled by clientLoader



	const handleCreateForm = async () => {
		if (!newFormTitle.trim()) return;
		setIsCreating(true);

		try {
			const payload = {
				title: newFormTitle,
				fields: [],
				config: {
					meta: { title: newFormTitle, description: "", logo_url: "" },
					organization: { logo_url: "", name: "" },
					access_control: { mode: "PUBLIC", rules: { allowed_domains: [], regex_pattern: "" }, block_message: "" },
					submission_policy: { mode: "SINGLE_EDITABLE" },
					respondent_experience: { show_identity_card: true },
					post_submit_behavior: { redirect_url: null, custom_message: "Your form has been submitted.", show_scorecard: true, show_verdict: false }
				}
			};

			const res = await apiRequest("/forms", {
				method: "POST",
				body: JSON.stringify(payload)
			}) as { form?: import("@/lib/types").Form };
			console.log("Create Form Response:", res);

			setIsCreateOpen(false);
			setNewFormTitle("");
			// Redirect to edit
			if (res.form && res.form.id) {
				navigate(`/form/${res.form.id}/edit`, { state: { initialForm: res.form } });
			} else {
				fetchForms(); // Fallback
			}

		} catch (err) {
			console.error("Create failed", err);
			toast.error("Failed to create form");
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<>
			{confirmDialog}
			<div className="min-h-screen bg-muted/30 flex flex-col">
				{/* Top Navigation */}
				<AppHeader
					titleSuffix={<Badge variant="secondary" className="ml-2 font-normal">Creator</Badge>}
				/>

				<main className="container mx-auto px-4 py-10 max-w-7xl">
					{/* Action Bar */}
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
						<div>
							<h1 className="text-3xl font-bold text-foreground tracking-tight">My Forms</h1>
							<p className="text-muted-foreground mt-1.5 text-base">Manage your forms and responses.</p>
						</div>

						<div className="flex items-center gap-3 w-full md:w-auto">
							<div className="relative flex-1 md:w-72">
								<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input placeholder="Search forms..." className="pl-10 h-11 bg-background" />
							</div>

							<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
								<DialogTrigger asChild>
									<Button size="lg" className="min-w-[160px] h-11 shadow-md hover:shadow-lg">
										<Plus className="w-4 h-4 mr-2" /> Create Form
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Create New Form</DialogTitle>
										<DialogDescription>
											Initialize a new verification drive.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4 py-4">
										<div className="space-y-2">
											<Label>Form Title</Label>
											<Input
												placeholder="e.g. Registration Form 2025 - Phase 1"
												value={newFormTitle}
												onChange={(e) => setNewFormTitle(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && newFormTitle.trim()) {
														e.preventDefault();
														handleCreateForm();
													}
												}}
											/>
										</div>
									</div>
									<DialogFooter>
										<Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</Button>
										<Button onClick={handleCreateForm} disabled={!newFormTitle.trim() || isCreating}>
											{isCreating ? <span className="">Creating...</span> : "Create & Edit"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>
					</div>

					{/* Forms Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{isLoading ? (
							<div className="col-span-3 flex justify-center py-12">
								<Loading size="md" message="Loading your forms..." />
							</div>
						) : fetchError ? (
							<div className="col-span-3 flex justify-center py-12">
								<ErrorDisplay type="connection" onRetry={fetchForms} />
							</div>
						) : forms.length === 0 ? (
							<div className="col-span-3 flex justify-center py-20">
								<ErrorDisplay
									type="empty"
									message="Start your first verification drive. Create a smart form with automated API checks for developers and candidates."
									actionText="Create your first form"
									onRetry={() => setIsCreateOpen(true)}
								/>
							</div>
						) : forms.map((form: import("@/lib/types").Form) => (
							<Card
								key={form.id}
								className={`relative overflow-hidden cursor-pointer border border-border/50 ${form.status.toUpperCase() === 'CLOSED' ? 'bg-muted/10 opacity-75 grayscale' : 'bg-card hover:bg-muted/30'}`}
								onClick={() => navigate(`/form/${form.id}/edit`)}
							>
								<CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-3">
									<Badge
										variant={form.status.toUpperCase() === 'ACTIVE' ? 'default' : 'secondary'}
										className={`flex items-center gap-1.5 shadow-sm ${form.status.toUpperCase() === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : ''}`}
									>
										{form.status.toUpperCase() === 'ACTIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />}
										{form.status.toUpperCase() === 'ACTIVE' ? 'Active' : 'Closed'}
									</Badge>
									<DropdownMenu>
										<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
											<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted/50 rounded-full">
												<MoreVertical className="w-4 h-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-48 bg-background">
											<DropdownMenuLabel>Actions</DropdownMenuLabel>
											<DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/form/${form.id}/edit`); }}>
												<FileText className="w-4 h-4 mr-2" /> Edit Form
											</DropdownMenuItem>
											<DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusToggle(form); }}>
												{form.status === 'active' ? <><X className="w-4 h-4 mr-2" /> Pause Form</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Publish Form</>}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameInit(form); }}>
												<LayoutTemplate className="w-4 h-4 mr-2" /> Rename
											</DropdownMenuItem>
											<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(form.id); }}>
												<AlertTriangle className="w-4 h-4 mr-2" /> Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</CardHeader>
								<CardContent className="relative pt-2 pb-5">
									<h3 className="font-bold text-2xl text-foreground mb-1 leading-tight line-clamp-2">
										{form.title}
									</h3>
									<div className="text-sm font-medium text-muted-foreground/80 mb-6 flex items-center gap-2">
										<Clock className="w-3.5 h-3.5" />
										{form.status.toUpperCase() === 'ACTIVE' ? `Created ${new Date(form.created_at).toLocaleDateString()}` : `Ended ${new Date(form.created_at).toLocaleDateString()}`}
									</div>

									{/* Premium Stats Grid */}
									<div className={`grid grid-cols-3 gap-1 py-4 bg-muted/30 rounded-xl border border-border/40 ${form.status.toUpperCase() === 'CLOSED' ? 'opacity-80' : ''}`}>
										<div className="flex flex-col items-center justify-center p-2">
											<div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
												<Users className="w-3.5 h-3.5" />
												<span className="text-[10px] uppercase font-bold tracking-wider">Responses</span>
											</div>
											<div className="text-2xl font-black text-foreground tabular-nums tracking-tight">{form.responses || 0}</div>
										</div>
										<div className="flex flex-col items-center justify-center p-2 border-l border-border/50">
											<div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
												<CheckCircle2 className="w-3.5 h-3.5" />
												<span className="text-[10px] uppercase font-bold tracking-wider">Verified</span>
											</div>
											<div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">{form.verified_pct || 0}%</div>
										</div>
										<div className="flex flex-col items-center justify-center p-2 border-l border-border/50">
											<div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
												<AlertTriangle className="w-3.5 h-3.5" />
												<span className="text-[10px] uppercase font-bold tracking-wider">Flagged</span>
											</div>
											<div className={`text-2xl font-black tabular-nums tracking-tight ${(form.flagged || 0) > 0 ? 'text-destructive drop-shadow-sm' : 'text-foreground'}`}>{form.flagged || 0}</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</main>

				<Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Rename Form</DialogTitle>
							<DialogDescription>
								Enter a new title for your form.
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<Label>Form Title</Label>
							<Input
								value={renameTitle}
								onChange={(e) => setRenameTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && renameTitle.trim()) {
										e.preventDefault();
										handleRenameSubmit();
										setIsRenameOpen(false);
									}
								}}
								placeholder="Enter new title"
								className="mt-2"
							/>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
							<Button onClick={() => { handleRenameSubmit(); setIsRenameOpen(false); }}>Save Changes</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</>
	);
}
