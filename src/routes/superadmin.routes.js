import { Router } from "express";

import {
  getSuperAdminDashboard,
} from "../controllers/superadmin.controller.js";

import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get("/dashboard", getSuperAdminDashboard);

export default router;