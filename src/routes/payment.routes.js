import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createPaymentOrder, listMyPayments, verifyPayment } from "../controllers/payment.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", listMyPayments);
router.post("/order", createPaymentOrder);
router.post("/verify", verifyPayment);
export default router;
