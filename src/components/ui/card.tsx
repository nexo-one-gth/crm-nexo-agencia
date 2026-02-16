import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "glass-card border border-white/20 bg-white/10 dark:bg-black/20 text-slate-900 dark:text-slate-100 shadow-xl",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

export { Card }
