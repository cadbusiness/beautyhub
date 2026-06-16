"use client";

import { useActionState, useMemo, useState } from "react";
import { checkout, type ActionResult } from "../woo-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
}
interface Option {
  id: string;
  label: string;
}

const initial: ActionResult = {};

export function PosTerminal({
  products,
  clients,
}: {
  products: Product[];
  clients: Option[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [state, action, pending] = useActionState(checkout, initial);

  const total = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + p.price_cents * (cart[p.id] ?? 0),
        0,
      ),
    [cart, products],
  );

  const lines = products.filter((p) => cart[p.id]);

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function remove(id: string) {
    setCart((c) => {
      const next = { ...c };
      const q = (next[id] ?? 0) - 1;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => add(p.id)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
          >
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                className="mb-2 h-24 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 h-24 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
            )}
            <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
              {p.name}
            </p>
            <p className="text-sm text-slate-500">{formatPrice(p.price_cents)}</p>
          </button>
        ))}
      </div>

      <Card className="h-fit space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Panier
        </h2>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun article.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="flex-1 text-slate-700 dark:text-slate-300">{p.name}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => remove(p.id)} className="px-2 text-slate-500">
                    -
                  </button>
                  <span className="w-6 text-center">{cart[p.id]}</span>
                  <button type="button" onClick={() => add(p.id)} className="px-2 text-slate-500">
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatPrice(total)}
          </span>
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="cart" value={JSON.stringify(cart)} />
          <Select name="client_id" defaultValue="">
            <option value="">— Sans client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
          <Button type="submit" className="w-full" disabled={pending || lines.length === 0}>
            {pending ? "Encaissement..." : `Encaisser ${formatPrice(total)}`}
          </Button>
        </form>
      </Card>
    </div>
  );
}
