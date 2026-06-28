"use client";

import { Button } from "@/components/ui/button";

export function PrintTicketButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 print:hidden"
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}
