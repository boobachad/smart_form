import * as React from "react"
import { AppHeader } from "./app-header"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function BuilderLayout({
    children,
    rightSidebar,
    breadcrumbs = [],
    topNav,
    topActions
}: {
    children: React.ReactNode;
    rightSidebar?: React.ReactNode;
    breadcrumbs?: Array<{ label: string; href?: string }>;
    topNav?: React.ReactNode;
    topActions?: React.ReactNode;
}) {
    return (
        <div className="h-screen bg-background text-foreground font-display flex flex-col overflow-hidden">
            <AppHeader
                nav={breadcrumbs.length > 0 && (
                    <Breadcrumb>
                        <BreadcrumbList>
                            {breadcrumbs.map((crumb, index) => {
                                const isLast = index === breadcrumbs.length - 1;
                                return (
                                    <React.Fragment key={index}>
                                        <BreadcrumbItem>
                                            {isLast ? (
                                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink href={crumb.href}>
                                                    {crumb.label}
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                        {!isLast && <BreadcrumbSeparator />}
                                    </React.Fragment>
                                );
                            })}
                        </BreadcrumbList>
                    </Breadcrumb>
                )}
                actions={topActions}
            />

            {topNav && (
                <div className="border-b border-border bg-card px-6 py-2 flex justify-center">
                    {topNav}
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-y-auto">
                    {children}
                </main>

                {rightSidebar && (
                    <ResizableSidebar>
                        {rightSidebar}
                    </ResizableSidebar>
                )}
            </div>
        </div>
    )
}

function ResizableSidebar({ children }: { children: React.ReactNode }) {
    const [width, setWidth] = React.useState(320);
    const [isResizing, setIsResizing] = React.useState(false);
    const sidebarRef = React.useRef<HTMLElement>(null);

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = document.body.clientWidth - e.clientX;
            if (newWidth > 250 && newWidth < 600) {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <aside
            ref={sidebarRef}
            className="border-l border-border bg-card overflow-hidden relative flex flex-col h-full"
            style={{ width: `${width}px` }}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-50"
                onMouseDown={() => setIsResizing(true)}
            />
            {children}
        </aside>
    );
}
