import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "success" | "error" | "warning" | "info"
  onClose?: () => void
}

const Toast = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & ToastProps
>(({ className, title, description, variant = "default", onClose, ...props }, ref) => {
  const icons = {
    default: Info,
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  }

  const Icon = icons[variant]

  const variantStyles = {
    default: "bg-gray-800 border-gray-700 text-gray-100",
    success: "bg-green-800 border-green-700 text-green-100",
    error: "bg-red-800 border-red-700 text-red-100",
    warning: "bg-yellow-800 border-yellow-700 text-yellow-100",
    info: "bg-blue-800 border-blue-700 text-blue-100",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className="flex items-center space-x-3">
        <Icon className="h-5 w-5 flex-shrink-0" />
        <div className="space-y-1">
          {title && (
            <div className="text-sm font-semibold">{title}</div>
          )}
          {description && (
            <div className="text-sm opacity-90">{description}</div>
          )}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})
Toast.displayName = "Toast"

export { Toast }