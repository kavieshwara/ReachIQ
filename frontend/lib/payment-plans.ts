export type CheckoutPlan = "starter" | "pro";

type PaymentPlanConfig = {
  label: string;
  shortLabel: string;
  price: number;
  originalPrice: number;
  color: string;
  features: string[];
  buttonLabel: string;
  helperText: string;
};

export const paymentPlanConfig: Record<CheckoutPlan, PaymentPlanConfig> = {
  starter: {
    label: "Starter Plan",
    shortLabel: "Starter",
    price: 499,
    originalPrice: 999,
    color: "#6C63FF",
    features: ["200 messages/day", "10 campaigns", "Auto follow-ups"],
    buttonLabel: "Upgrade to Starter",
    helperText: "Pay via UPI and submit your transaction ID for quick review."
  },
  pro: {
    label: "Pro Plan",
    shortLabel: "Pro",
    price: 999,
    originalPrice: 2499,
    color: "#FFB830",
    features: ["1000 messages/day", "Unlimited campaigns", "Priority support"],
    buttonLabel: "Upgrade to Pro",
    helperText: "Manual UPI checkout with admin approval for same-day activation."
  }
};

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function getRecommendedCheckoutPlan(currentPlan?: string | null): CheckoutPlan {
  const normalized = String(currentPlan || "").trim().toLowerCase();

  if (normalized === "starter" || normalized === "premium") {
    return "pro";
  }

  return "starter";
}

export function getCheckoutPlanLabel(currentPlan?: string | null) {
  const normalized = String(currentPlan || "").trim().toLowerCase();

  if (normalized === "starter") {
    return "Starter";
  }

  if (normalized === "pro") {
    return "Pro";
  }

  if (normalized === "premium") {
    return "Premium";
  }

  return "Free";
}
