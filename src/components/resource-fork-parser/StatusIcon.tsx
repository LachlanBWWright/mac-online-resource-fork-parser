import { Check, X, AlertTriangle } from "lucide-react";

interface StatusIconProps {
  status: "valid" | "error" | "warning";
}

export default function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case "valid":
      return <Check className="h-4 w-4 text-green-500" />;
    case "error":
      return <X className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return null;
  }
}