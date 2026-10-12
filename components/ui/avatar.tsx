import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        default: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
        "2xl": "h-24 w-24",
      },
      rounded: {
        full: "rounded-full",
        "2xl": "rounded-2xl",
        xl: "rounded-xl",
        lg: "rounded-lg",
      },
    },
    defaultVariants: {
      size: "default",
      rounded: "full",
    },
  }
)

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string
  alt?: string
  fallback?: string
  /** Overrides the fallback circle's background/text classes (default: bg-slate-100 text-slate-500). */
  fallbackClassName?: string
  status?: "online" | "offline" | "busy" | "away"
}

const roundedClassMap = {
  full: "rounded-full",
  "2xl": "rounded-2xl",
  xl: "rounded-xl",
  lg: "rounded-lg",
} as const

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, rounded, src, alt, fallback, fallbackClassName, status, ...props }, ref) => {
    const roundedClass = roundedClassMap[rounded || "full"]
    return (
      <div className="relative inline-block">
        <div ref={ref} className={cn(avatarVariants({ size, rounded, className }))} {...props}>
          {src ? (
            <img
              src={src}
              alt={alt || "Avatar"}
              className="block h-full w-full object-cover object-center"
            />
          ) : (
            <div className={cn("flex h-full w-full items-center justify-center bg-slate-100 text-slate-500 font-medium", roundedClass, fallbackClassName)}>
              {fallback || "U"}
            </div>
          )}
        </div>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-white",
              {
                "bg-green-500": status === "online",
                "bg-slate-300": status === "offline",
                "bg-red-500": status === "busy",
                "bg-yellow-500": status === "away",
              },
              size === "sm" ? "h-2 w-2" : size === "default" ? "h-2.5 w-2.5" : size === "lg" ? "h-3 w-3" : size === "xl" ? "h-3.5 w-3.5" : "h-5 w-5"
            )}
          />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar, avatarVariants }
