import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null = null;
export function getStripe() {
  return (stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!));
}

export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
