import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";

import { listMyPayments } from "../controllers/payment.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", listMyPayments);

export default router;