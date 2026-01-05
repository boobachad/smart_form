import * as React from "react"
import { Link, useNavigate } from "react-router"
import { AppHeader } from "./app-header"
import { authClient } from "@/lib/auth-client"

export function RespondentLayout({ children, pageTitle }: { children: React.ReactNode, pageTitle?: string }) {
    const navigate = useNavigate();
    const [userRole, setUserRole] = React.useState<number | null>(null);

    React.useEffect(() => {
        const checkRole = async () => {
            const session = await authClient.getSession();
            setUserRole(session?.user?.role as number || null);
        };
        checkRole();
    }, []);

    return (
        <div className="theme-student min-h-screen bg-muted/30 dark:bg-black/50 text-foreground font-display antialiased flex flex-col items-center relative selection:bg-primary/20">
            <AppHeader
                titleSuffix={
                    <>
                        <span className="text-muted-foreground mx-2 text-xl font-light">/</span>
                        <span className="text-muted-foreground font-medium text-sm">{pageTitle || 'Form Portal'}</span>
                    </>
                }
                nav={
                    (userRole !== null && (userRole & 2) !== 0) ? (
                        <nav className="flex items-center gap-6 text-sm font-medium">
                            <Link to="/workspace" className="text-foreground hover:text-muted-foreground">Workspace</Link>
                        </nav>
                    ) : null
                }
                actions={null}
            />

            <main className="w-full max-w-5xl bg-card border border-border/60 shadow-2xl shadow-black/5 rounded-2xl px-8 md:px-12 py-12 flex flex-col gap-10 relative z-10 my-8 mx-4 selection:bg-primary/10">
                {children}
            </main>
        </div>
    )
}
