import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Home, FileQuestion, ArrowRight } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.05),transparent_50%)]" />

            <div className="relative w-full max-w-2xl">
                <div className="text-center space-y-8">

                    <div className="flex justify-center mb-12">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />

                            <div className="relative h-32 w-32 bg-card border-2 border-primary/30 rounded-3xl flex items-center justify-center shadow-2xl">
                                <FileQuestion className="h-16 w-16 text-primary" strokeWidth={1.5} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h1 className="text-8xl md:text-9xl font-black text-primary tracking-tighter">
                                404
                            </h1>
                            <div className="h-1 w-24 bg-primary mx-auto rounded-full" />
                        </div>

                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                            Page Not Found
                        </h2>

                        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                            This page doesn't exist. You may have mistyped the address or the page has been moved.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                        <Button asChild size="lg" className="shadow-lg hover:shadow-xl">
                            <Link to="/">
                                <Home className="w-5 h-5 mr-2" />
                                Back to Home
                            </Link>
                        </Button>

                        <Button asChild variant="outline" size="lg" className="group">
                            <Link to="/workspace">
                                <span>Go to Workspace</span>
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1" />
                            </Link>
                        </Button>
                    </div>

                    <div className="pt-12">
                        <p className="text-sm text-muted-foreground">
                            Looking for a form?{" "}
                            <span className="text-foreground font-medium">
                                Use the complete link provided by your administrator
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
