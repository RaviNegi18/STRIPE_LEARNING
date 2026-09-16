import type { Request, Response } from "express";
import stripe from "../config/stripe.ts";
import Order from "../models/order.ts";
import Stripe from "stripe";

const minimumPaymentAmounts: Record<string, number> = {
  inr: 5000,
  usd: 50,
  cad: 50,
};

// so yha payment intennt or [payment checkout flow hai ye dono ko hum ek dusre ke alternative kah sakte hai yha par but the diff is checkout privide us built in  UI while payment interne me
// payment internt me hme khud se custom UI bnana padta hai]
const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    // 1. Check orderId
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // 2. Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currency = order.currency.toLowerCase();
    const amount = Math.round(order.totalAmount * 100);
    const minimumAmount = minimumPaymentAmounts[currency];

    if (minimumAmount && amount < minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Order amount is too small for Stripe. Minimum for ${order.currency} is ${minimumAmount / 100}.`,
      });
    }

    // 3. Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        orderId: order._id.toString(),
        userId: order.user.toString(),
      },
    });

    console.log("CREATED PAYMENT INTENT:", paymentIntent.id);
    console.log("METADATA:", paymentIntent.metadata);
    // 4. Save Stripe PaymentIntent ID in our Order
    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    // 5. Send clientSecret to frontend

    //the client secret form during payment intent create
    return res.status(200).json({
      success: true,
      message: "PaymentIntent created successfully",
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: unknown) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create PaymentIntent",
    });
  }
};

//separate contorller router

const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // 1. Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 2. Check order status
    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot checkout a cancelled order",
      });
    }

    // 3. Check payment status
    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Order is already paid",
      });
    }

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: order.items.map((item) => ({
        price_data: {
          currency: order.currency.toLowerCase(),

          product_data: {
            name: item.name,
          },

          unit_amount: item.price * 100,
        },

        quantity: item.quantity,
      })),

      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,

      metadata: {
        orderId: order._id.toString(),
      },
    });

    // 5. Save Stripe session ID in our order
    order.stripeSessionId = session.id;

    await order.save();

    // 6. Send Checkout URL to frontend
    return res.status(200).json({
      success: true,
      message: "Stripe Checkout Session created",
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create Stripe Checkout Session",
    });
  }
};

const stripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({
      success: false,
      message: "Stripe signature is missing",
    });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (error: unknown) {
    console.error("Webhook signature verification failed:", error);

    return res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature",
    });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const orderId = paymentIntent.metadata.orderId;

        if (!orderId) {
          console.error("Order ID missing in PaymentIntent metadata");
          break;
        }

        const order = await Order.findById(orderId);

        if (!order) {
          console.error(`Order not found: ${orderId}`);
          break;
        }

        // Idempotency: already paid → don't process again
        if (order.paymentStatus === "paid") {
          console.log(`Order ${orderId} is already marked as paid`);
          break;
        }

        order.paymentStatus = "paid";
        order.orderStatus = "confirmed";
        order.stripePaymentIntentId = paymentIntent.id;

        await order.save();

        console.log(`Order ${orderId} marked as paid`);

        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error: unknown) {
    console.error("Webhook processing failed:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

export { createPaymentIntent, createCheckoutSession, stripeWebhook };
