import toast, { Toaster } from 'react-hot-toast'
import { Toast } from '@/components/ui/toast'
import React from 'react'

type ToastVariant = "default" | "success" | "error" | "warning" | "info"

interface ToastOptions {
  title?: string
  description?: string
  duration?: number
}

const createToast = (variant: ToastVariant) => (
  options: ToastOptions | string
) => {
  const toastOptions = typeof options === 'string' 
    ? { description: options } 
    : options

  return toast.custom((t) => 
    React.createElement(Toast, {
      variant,
      title: toastOptions.title,
      description: toastOptions.description,
      onClose: () => toast.dismiss(t.id)
    }),
    {
      duration: toastOptions.duration || 4000,
    }
  )
}

export const useToast = () => ({
  toast: createToast("default"),
  success: createToast("success"),
  error: createToast("error"),
  warning: createToast("warning"),
  info: createToast("info"),
  dismiss: toast.dismiss,
  remove: toast.remove,
})

export { Toaster }