import * as React from "react"
import { cn } from "@/lib/utils"

export interface CategoryTagProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const CategoryTag = React.forwardRef<HTMLButtonElement, CategoryTagProps>(
  ({ className, active, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-pill px-4 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-c-border-focus",
          active 
            ? "bg-primary text-white shadow-soft-glow"
            : "bg-blush-light text-secondary hover:bg-blush-mid hover:text-white",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
CategoryTag.displayName = "CategoryTag"

export { CategoryTag }
