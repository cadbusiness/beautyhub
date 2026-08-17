import { Receipt, FileText, Truck, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const LOOKS: Record<
  string,
  { icon: LucideIcon; className: string }
> = {
  ticket: {
    icon: Receipt,
    className: "bg-orange-50 text-orange-800 ring-orange-200",
  },
  invoice: {
    icon: FileText,
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  delivery_note: {
    icon: Truck,
    className: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
  credit_note: {
    icon: Undo2,
    className: "bg-rose-50 text-rose-800 ring-rose-200",
  },
};

export function saleDocLabelKey(docType: string): "ticket" | "invoice" | "delivery_note" | "credit_note" {
  if (docType === "invoice" || docType === "delivery_note" || docType === "credit_note") {
    return docType;
  }
  return "ticket";
}

export function SaleDocMark({
  type = "ticket",
  size = "sm",
  className,
}: {
  type?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const look = LOOKS[type] ?? LOOKS.ticket;
  const Icon = look.icon;
  const box = size === "md" ? "h-8 w-8" : "h-6 w-6";
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
        box,
        look.className,
        className,
      )}
      aria-hidden
    >
      <Icon className={icon} strokeWidth={1.8} />
    </span>
  );
}
