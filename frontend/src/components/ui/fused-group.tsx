import * as React from "react"
import { cn } from "@/lib/utils"

/*
  FusedGroup System
  Extracted from inspire/builder.html
  
  Structure:
  .fused-group (Container)
    .fused-input (Input)
    .fused-action (Button/Select)
    .fused-label (Static Label)
*/

interface FusedGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    focusWithin?: boolean
}

const FusedGroup = React.forwardRef<HTMLDivElement, FusedGroupProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex items-stretch border border-border rounded   overflow-hidden bg-background",
                    "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
FusedGroup.displayName = "FusedGroup"

const FusedInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    "flex-1 border-none outline-none px-3 py-2 bg-transparent text-sm min-w-0 text-foreground placeholder-muted-foreground focus:ring-0",
                    className
                )}
                {...props}
            />
        )
    }
)
FusedInput.displayName = "FusedInput"

const FusedAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex items-center justify-center px-3 bg-muted/50 border-l border-border cursor-pointer text-sm font-medium text-muted-foreground  hover:bg-muted hover:text-foreground",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
FusedAction.displayName = "FusedAction"

const FusedLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex items-center px-3 bg-muted/50 border-r border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
FusedLabel.displayName = "FusedLabel"

const FusedTextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    "flex-1 border-none outline-none px-3 py-2 bg-transparent text-sm min-w-0 text-foreground placeholder-muted-foreground focus:ring-0 resize-y",
                    className
                )}
                {...props}
            />
        )
    }
)
FusedTextArea.displayName = "FusedTextArea"

export { FusedGroup, FusedInput, FusedAction, FusedLabel, FusedTextArea }
