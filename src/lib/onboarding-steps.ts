export const STEPS = ["business", "bank", "payments", "tax", "brand"] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABELS: Record<Step, string> = {
  business: "Your company",
  bank: "Bank account",
  payments: "Online payments",
  tax: "Tax & terms",
  brand: "Branding",
};
