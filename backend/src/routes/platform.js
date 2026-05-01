import express from "express";
import { getPublicPaymentCheckout, getPublicPlatformSettings } from "../services/paymentService.js";

const router = express.Router();

router.get("/settings", async (req, res, next) => {
  try {
    const settings = await getPublicPlatformSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.get("/payment-checkout", async (req, res, next) => {
  try {
    const checkout = await getPublicPaymentCheckout(req.query.plan);
    res.json(checkout);
  } catch (error) {
    next(error);
  }
});

export default router;
