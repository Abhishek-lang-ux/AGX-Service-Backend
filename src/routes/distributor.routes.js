import { Router } from "express";
import { getDistributorDashboard, getAssignedRetailers } from "../controllers/distributor.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("distributor"));

router.get("/dashboard", getDistributorDashboard);
router.get("/retailers", getAssignedRetailers);

export default router;
