import { useQueryClient } from "@tanstack/react-query";
import PaystackPop from "@paystack/inline-js";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError, payForOrder, verifyPayment } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { usePendingOrder } from "@/store/pendingOrder";

export function usePendingPayment(options: { onReference?: (reference: string) => void } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuth((s) => s.session?.access_token);
  const [busyReference, setBusyReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finish(reference: string) {
    try {
      await verifyPayment(reference, token);
    } catch {
      /* the receipt page shows the real status */
    }
    setBusyReference(null);
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["order", reference] });
    usePendingOrder.getState().clear();
    navigate(`/order/${reference}`);
  }

  async function pay(reference: string) {
    setError(null);
    setBusyReference(reference);
    try {
      const result = await payForOrder(reference, token);
      void queryClient.invalidateQueries({ queryKey: ["orders"] }); // the reference may have changed

      if (result.status === "paid") {
        setBusyReference(null);
        usePendingOrder.getState().clear();
        navigate(`/order/${result.reference}`);
        return;
      }

      options.onReference?.(result.reference);
      usePendingOrder.getState().remember(result.reference);

      const popup = new PaystackPop();
      popup.resumeTransaction(result.accessCode, {
        onSuccess: () => {
          void finish(result.reference);
        },
        onCancel: () => {
          setBusyReference(null);
          setError("Payment cancelled. You can try again.");
        },
        onError: () => {
          setBusyReference(null);
          setError("The payment window ran into a problem. Please try again.");
        },
      });
    } catch (err) {
      setBusyReference(null);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
      setError(err instanceof ApiError ? err.message : "We could not start the payment. Please try again.");
    }
  }

  return { pay, busyReference, error };
}