import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        default: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
        "2xl": "h-24 w-24",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string
  alt?: string
  fallback?: string
  status?: "online" | "offline" | "busy" | "away"
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, src, alt, fallback, status, ...props }, ref) => {
    return (
      <div className="relative inline-block">
        <div ref={ref} className={cn(avatarVariants({ size, className }))} {...props}>
          {src ? (
            <img
              src={src}
              alt={alt || "Avatar"}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-500 font-medium">
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
              size === "sm" ? "h-2 w-2" : size === "default" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"
            )}
          />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar, avatarVariants }
