import { BadgeCheck, Bot, Globe2, LineChart, Mail, MessageSquareText, Sparkles, Users, Wand2, Workflow } from "lucide-react";
import type { ComponentType } from "react";
import { formatInr, paymentPlanConfig, type CheckoutPlan } from "@/lib/payment-plans";

export type PricingPlan = {
  name: string;
  badge: string;
  subtitle: string;
  originalPrice: string | null;
  currentPrice: string;
  priceSuffix: string;
  accentClass: string;
  borderClass: string;
  buttonLabel: string;
  buttonVariant?: "primary" | "secondary";
  buttonHref?: string;
  buttonDisabled?: boolean;
  helperText: string;
  waitlistText?: string;
  waitlistMessage?: string;
  highlighted?: boolean;
  checkoutPlan?: CheckoutPlan;
  features: Array<{
    label: string;
    included: boolean;
    icon?: ComponentType<{ className?: string }>;
  }>;
};

export const supportFallbackNumber = "919025929032";

export const pricingPlans: PricingPlan[] = [
  {
    name: "Free",
    badge: "14-Day Trial",
    subtitle: "30 leads/day + 30 WhatsApp messages/day",
    originalPrice: null,
    currentPrice: "Rs 0",
    priceSuffix: "/ 14 days",
    accentClass: "text-accent",
    borderClass: "border-accent/20",
    buttonLabel: "Start Free",
    buttonHref: "/signup",
    helperText: "Invite friends -> earn +10 messages/day each",
    features: [
      { label: "30 WhatsApp messages/day", included: true, icon: MessageSquareText },
      { label: "1 active campaign", included: true, icon: Workflow },
      { label: "Discover or upload up to 30 leads/day", included: true, icon: Users },
      { label: "2 message templates", included: true, icon: Sparkles },
      { label: "Local business lead finder", included: true, icon: Globe2 },
      { label: "1 AI website generator", included: true, icon: Wand2 },
      { label: "AI chat assistant", included: true, icon: Bot },
      { label: "Basic campaign reports", included: true, icon: LineChart },
      { label: "Auto follow-ups", included: false },
      { label: "Bulk campaigns", included: false },
      { label: "Priority support", included: false, icon: Mail }
    ]
  },
  {
    name: "Starter",
    badge: "Most Popular",
    subtitle: "Save 50% - Launch Offer",
    originalPrice: formatInr(paymentPlanConfig.starter.originalPrice),
    currentPrice: formatInr(paymentPlanConfig.starter.price),
    priceSuffix: "/ month",
    accentClass: "text-primary",
    borderClass: "border-primary/40",
    buttonLabel: paymentPlanConfig.starter.buttonLabel,
    buttonVariant: "primary",
    buttonDisabled: false,
    helperText: paymentPlanConfig.starter.helperText,
    checkoutPlan: "starter",
    highlighted: true,
    features: [
      { label: "200 WhatsApp messages/day", included: true, icon: MessageSquareText },
      { label: "10 active campaigns", included: true, icon: Workflow },
      { label: "Unlimited leads (CSV + search)", included: true, icon: Users },
      { label: "Unlimited message templates", included: true, icon: Sparkles },
      { label: "Auto follow-up sequences (3 steps)", included: true, icon: BadgeCheck },
      { label: "5 AI website generators/month", included: true, icon: Wand2 },
      { label: "Campaign analytics and reports", included: true, icon: LineChart },
      { label: "AI pitch message generator", included: true, icon: Bot },
      { label: "Email support (24hr reply)", included: true, icon: Mail },
      { label: "Priority queue processing", included: true, icon: BadgeCheck },
      { label: "Team members", included: false },
      { label: "Custom domain websites", included: false },
      { label: "API access", included: false }
    ]
  },
  {
    name: "Pro",
    badge: "For Agencies",
    subtitle: "Save 60% - Launch Offer",
    originalPrice: formatInr(paymentPlanConfig.pro.originalPrice),
    currentPrice: formatInr(paymentPlanConfig.pro.price),
    priceSuffix: "/ month",
    accentClass: "text-warning",
    borderClass: "border-warning/30",
    buttonLabel: paymentPlanConfig.pro.buttonLabel,
    buttonVariant: "primary",
    buttonDisabled: false,
    helperText: paymentPlanConfig.pro.helperText,
    checkoutPlan: "pro",
    features: [
      { label: "1,000 WhatsApp messages/day", included: true, icon: MessageSquareText },
      { label: "Unlimited campaigns", included: true, icon: Workflow },
      { label: "Unlimited leads", included: true, icon: Users },
      { label: "Unlimited templates", included: true, icon: Sparkles },
      { label: "Auto follow-up (7 steps)", included: true, icon: BadgeCheck },
      { label: "20 AI websites/month", included: true, icon: Wand2 },
      { label: "White-label website URLs", included: true, icon: Globe2 },
      { label: "Advanced analytics dashboard", included: true, icon: LineChart },
      { label: "Priority support (4hr reply)", included: true, icon: Mail },
      { label: "API access (coming soon)", included: true, icon: BadgeCheck },
      { label: "Team members (coming soon)", included: true, icon: BadgeCheck },
      { label: "Bulk CSV send", included: true, icon: Users }
    ]
  }
];

export const comparisonRows = [
  ["Messages/day", "30", "200", "1,000"],
  ["Campaigns", "1", "10", "Unlimited"],
  ["Lead discoveries/day", "30", "200", "1,000"],
  ["Trial length", "14 days", "Paid plan", "Paid plan"],
  ["Lead CSV upload", "30/day", "Unlimited", "Unlimited"],
  ["Local business finder", "Yes", "Yes", "Yes"],
  ["AI Chat", "Yes", "Yes", "Yes"],
  ["Follow-ups", "No", "3 steps", "7 steps"],
  ["AI Websites", "1", "5/mo", "20/mo"],
  ["Analytics", "Basic", "Full", "Advanced"],
  ["Support", "Community", "Email 24hr", "Priority 4hr"]
];

export const pricingFaqs = [
  {
    question: "Will my WhatsApp number get banned?",
    answer:
      "ReachIQ reduces risk with enforced delays and clear onboarding guidance, but no platform can guarantee zero sender risk. Start with low daily volume, use a dedicated business number, and follow consent-based outreach practices."
  },
  {
    question: "What happens when I reach my daily limit?",
    answer:
      "ReachIQ pauses new sends and lead imports for the rest of the day. Your campaigns and saved data stay intact, and the app guides you to upgrade or continue again when the next daily window opens."
  },
  {
    question: "How does the referral bonus work?",
    answer:
      "Every friend who signs up through your referral link gives both of you +10 extra messages per day. The bonus stacks permanently, so referrals keep making the free plan more powerful over time."
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Every new account starts with a 14-day free trial that includes up to 30 leads per day and 30 WhatsApp messages per day. When the trial or daily limit is used up, ReachIQ prompts the user to upgrade."
  },
  {
    question: "Can I use ReachIQ for my clients (agency use)?",
    answer:
      "Yes. ReachIQ is designed with agencies and freelancers in mind. The Pro plan is aimed at multi-client workflows, higher send volume, and more advanced reporting."
  }
];
