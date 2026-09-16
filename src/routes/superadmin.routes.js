import { Router } from "express";

import {
  getSuperAdminDashboard,
  getSuperAdminUsers,
  updateSuperAdminUserStatus,
  updateSuperAdminUserRole,

  getSuperAdminDocuments,
  viewSuperAdminDocument,
  downloadSuperAdminDocument,

  getSuperAdminPayments,
  viewSuperAdminPaymentScreenshot,
  downloadSuperAdminPaymentScreenshot,
  updateSuperAdminPaymentStatus,
} from "../controllers/superadmin.controller.js";

import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.js";

const router = Router();

/*
 * All SuperAdmin routes require:
 * 1. Authentication
 * 2. SuperAdmin role
 */
router.use(requireAuth);
router.use(requireSuperAdmin);

/* Dashboard */
router.get("/dashboard", getSuperAdminDashboard);

/* Users */
router.get("/users", getSuperAdminUsers);

router.patch(
  "/users/:id/status",
  updateSuperAdminUserStatus,
);

router.patch(
  "/users/:id/role",
  updateSuperAdminUserRole,
);

/* =========================================================
   DOCUMENTS
========================================================= */

router.get(
  "/documents",
  getSuperAdminDocuments,
);

router.get(
  "/documents/:id/view",
  viewSuperAdminDocument,
);

router.get(
  "/documents/:id/download",
  downloadSuperAdminDocument,
);

/* =========================================================
   PAYMENTS
========================================================= */

router.get(
  "/payments",
  getSuperAdminPayments,
);

router.get(
  "/payments/:id/view",
  viewSuperAdminPaymentScreenshot,
);

router.get(
  "/payments/:id/download",
  downloadSuperAdminPaymentScreenshot,
);

router.patch(
  "/payments/:id/status",
  updateSuperAdminPaymentStatus,
);

export default router;