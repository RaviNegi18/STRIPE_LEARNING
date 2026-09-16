import Stripe from 'stripe';
const stripe= new Stripe(process.env.STRIPE_SECRET_KEY as string)
console.log(
  "STRIPE SECRET KEY PREFIX:",
  process.env.STRIPE_SECRET_KEY?.slice(0, 16)
);
export default stripe;

