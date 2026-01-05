import { Link } from "react-router";
import { ModeToggle } from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";
import * as React from "react";

interface AppHeaderProps {
    nav?: React.ReactNode;
    actions?: React.ReactNode;
    titleSuffix?: React.ReactNode;
}

export function AppHeader({ nav, actions, titleSuffix }: AppHeaderProps) {
    return (
        <header className="w-full flex items-center justify-between border-b border-border bg-card px-6 py-3 h-16 z-20 sticky top-0 backdrop-blur-md bg-card/95 shadow-sm">
            <div className="flex items-center gap-6 text-foreground min-w-fit">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="h-9 w-9 rounded-lg overflow-hidden shadow-sm ring-1 ring-border group-hover:shadow-md group-hover:ring-primary/50">
                        <img src="/assets/logo.png" alt="SmartForms" className="h-full w-full object-cover" />
                    </div>

                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight">
                            <span className="text-foreground">Smart</span>
                            <span className="text-primary">Forms</span>
                        </h1>
                        {titleSuffix}
                    </div>
                </Link>

                {nav && (
                    <>
                        <div className="h-6 w-px bg-border" />
                        <div className="flex items-center">{nav}</div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-3">
                {actions}
                <div className="flex items-center gap-2 border-l border-border pl-3">
                    <ModeToggle />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
}
