import express from "express"
import userRoutes from "./../server/routes/auth.routes.js"
import productRoutes from "./../server/routes/product.routes.ts"
import connectDB from "./config/DB.ts";
import orderRoutes from "./routes/order.routes.ts"
import PaymentRoutes from "./routes/payment.routes.ts"
import cors from "cors"
import { stripeWebhook } from "./controllers/paymentController.ts";
const PORT=5000;
const app=express()
connectDB()

app.use(cors())
//stripe webhook
console.log(
  "STRIPE KEY:",
  process.env.STRIPE_SECRET_KEY?.slice(0, 12)
);
app.use(
    "/api/stripe/webhook",
    express.raw({type:"application/json"})
)
app.use(express.json())
app.use("/api/auth",userRoutes)
app.use("/api",productRoutes)
app.use("/api",orderRoutes)
app.use("/api/payment",PaymentRoutes );
app.post("/api/stripe/webhook", stripeWebhook);
app.listen(PORT,()=>{
    console.log(`your app is listening on http://localhost:${PORT}`)
})



