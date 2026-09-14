import { Router } from "express";

import {
  createRequest,
  getMyRequest,
  listMyRequests,
  submitRequestWithPayment,
} from "../controllers/request.controller.js";

import { requireAuth } from "../middleware/auth.js";
import { uploadPaymentScreenshot } from "../middleware/upload.js";

const router = Router();

router.use(requireAuth);

router.get("/", listMyRequests);

/*
 * OLD request creation endpoint
 * Kept for backward compatibility.
 */
router.post("/", createRequest);

/*
 * NEW MANUAL QR PAYMENT FLOW
 *
 * Payment screenshot is mandatory.
 * Request is created only after screenshot upload.
 */
router.post(
  "/submit-with-payment",
  uploadPaymentScreenshot,
  submitRequestWithPayment,
);

router.get("/:id", getMyRequest);

export default router;