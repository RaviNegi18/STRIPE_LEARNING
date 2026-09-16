
import { useEffect, useState, type FormEvent } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import axios from "axios";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ===============================
// Payment Form
// ===============================

const PaymentForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setMessage("");

    const returnUrl = `${window.location.origin}/payment/success`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (error) {
      console.error("Payment error:", error);

      setMessage(error.message ?? "Payment failed");
      setLoading(false);
    }

    // If payment succeeds, Stripe handles the redirect
    // to return_url.
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
    >
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        Complete Payment
      </h1>

      <PaymentElement />

      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>

      {message && (
        <p className="mt-4 text-center text-sm text-red-500">
          {message}
        </p>
      )}
    </form>
  );
};

// ===============================
// Payment Success
// ===============================

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();

  const redirectStatus = searchParams.get("redirect_status");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-emerald-400">
          Payment Successful
        </h1>

        <p className="mt-3 text-slate-300">
          {redirectStatus === "succeeded"
            ? "Your payment was completed successfully."
            : "Your payment was completed successfully and your order is being confirmed."}
        </p>
      </div>
    </div>
  );
};

// ===============================
// Payment Cancelled
// ===============================

export const PaymentCancelled = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-amber-400">
          Payment Cancelled
        </h1>

        <p className="mt-3 text-slate-300">
          Your payment was cancelled. You can try again anytime.
        </p>

        <button
          onClick={() => navigate("/cart")}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold"
        >
          Back to Cart
        </button>
      </div>
    </div>
  );
};

// ===============================
// Payment Page
// ===============================

const Payment = () => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const stateOrderId = (
    location.state as { orderId?: string } | null
  )?.orderId;

  const orderId =
    stateOrderId || localStorage.getItem("lastOrderId");

  // ===============================
  // Create PaymentIntent
  // ===============================

  useEffect(() => {
    const createPaymentIntent = async () => {
      if (!orderId) {
        setErrorMessage(
          "No order found. Please start checkout again."
        );

        navigate("/cart", { replace: true });
        return;
      }

      try {
        const token = localStorage.getItem("token");

        const response = await axios.post(
          `${API_URL}/payment/create-payment-intent`,
          {
            orderId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setClientSecret(response.data.clientSecret);
      } catch (error: unknown) {
        console.error("Create PaymentIntent error:", error);

        if (axios.isAxiosError(error)) {
          setErrorMessage(
            error.response?.data?.message ||
              "Unable to start payment. Please try checkout again."
          );
        } else {
          setErrorMessage(
            "Unable to start payment. Please try checkout again."
          );
        }
      }
    };

    createPaymentIntent();
  }, [orderId, navigate]);

  // ===============================
  // Error State
  // ===============================

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <p className="text-red-400">{errorMessage}</p>

          <button
            onClick={() => navigate("/cart")}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold"
          >
            Back to Cart
          </button>
        </div>
      </div>
    );
  }

  // ===============================
  // Loading State
  // ===============================

  if (!clientSecret) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading payment...
      </div>
    );
  }

  // ===============================
  // Stripe PaymentElement
  // ===============================

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12">
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
        }}
      >
        <PaymentForm />
      </Elements>
    </div>
  );
};

export default Payment