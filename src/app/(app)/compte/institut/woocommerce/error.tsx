"use client";

import { Button } from "@/components/ui/button";

export default function WooCommerceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-red-600">
        Impossible d’afficher WooCommerce. Réessaie dans un instant.
      </p>
      <Button type="button" variant="outline" className="h-9" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
