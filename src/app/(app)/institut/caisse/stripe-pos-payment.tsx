"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  createStripePaymentIntent,
  finalizeStripeCheckout,
} from "../stripe-actions";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
}

function PaymentForm({
  cartJson,
  clientId,
  totalCents,
  onSuccess,
  onCancel,
}: {
  cartJson: string;
  clientId: string;
  totalCents: number;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (submitError) {
      setError(submitError.message ?? "Paiement echoue.");
      setPending(false);
      return;
    }
    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      setError("Paiement non confirme.");
      setPending(false);
      return;
    }

    const result = await finalizeStripeCheckout(
      paymentIntent.id,
      cartJson,
      clientId || null,
    );
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    onSuccess(result.message ?? "Paiement enregistre.");
    setPending(false);
  }

  return (
    <form onSubmit={handlePay} className="space-y-3">
      <PaymentElement />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" className="flex-1" disabled={pending || !stripe}>
          {pending ? "Paiement..." : `Payer ${formatPrice(totalCents)}`}
        </Button>
      </div>
    </form>
  );
}

export function StripePosPayment({
  cartJson,
  clientId: initialClientId,
  totalCents,
  clients,
  publishableKey,
  stripeAccountId,
  disabled,
  onSuccess,
}: {
  cartJson: string;
  clientId: string;
  totalCents: number;
  clients: Option[];
  publishableKey: string;
  stripeAccountId: string;
  disabled: boolean;
  onSuccess: (message: string) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stripePromise = useMemo(
    () => loadStripe(publishableKey, { stripeAccount: stripeAccountId }),
    [publishableKey, stripeAccountId],
  );

  async function startPayment() {
    setLoading(true);
    setError(null);
    const result = await createStripePaymentIntent(cartJson);
    if (result.error || !result.clientSecret) {
      setError(result.error ?? "Impossible de demarrer le paiement.");
      setLoading(false);
      return;
    }
    setClientSecret(result.clientSecret);
    setLoading(false);
  }

  if (clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentForm
          cartJson={cartJson}
          clientId={initialClientId}
          totalCents={totalCents}
          onSuccess={onSuccess}
          onCancel={() => setClientSecret(null)}
        />
      </Elements>
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled || loading}
        onClick={startPayment}
      >
        {loading ? "Preparation..." : `Stripe · ${formatPrice(totalCents)}`}
      </Button>
    </div>
  );
}
