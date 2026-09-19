import { documentUpload } from "../config/uploads.js";
import { Router } from "express";
import { createDistributor, getDistributors, updateDistributorStatus } from "../controllers/superadmin.controller.js";

import {
  getSuperAdminDashboard,
  getSuperAdminUsers,
  getSuperAdminRetailers,
  getPendingRetailers,
  updateRetailerApproval,
  updateRetailerServicePrice,
  updateSuperAdminUserStatus,
  updateSuperAdminUserRole,

  getSuperAdminDocuments,
  viewSuperAdminDocument,
  downloadSuperAdminDocument,

  getSuperAdminPayments,
  viewSuperAdminPaymentScreenshot,
  downloadSuperAdminPaymentScreenshot,
  updateSuperAdminPaymentStatus,
  getSuperAdminRequests,
  getSuperAdminRequest,
  updateSuperAdminRequestStatus,
    uploadFinalReceipt,
} from "../controllers/superadmin.controller.js";

import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.js";

const router = Router();

const clientScope = (req, res, next) => {
  req.superAdminScopeRole = "client";
  next();
};

const retailerScope = (req, res, next) => {
  req.superAdminScopeRole = "retailer";
  next();
};

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
router.get("/retailers", getSuperAdminRetailers);
router.get("/retailers/pending", getPendingRetailers);

router.patch(
  "/retailers/:id/approval",
  updateRetailerApproval,
);

router.patch("/services/:id/retailer-price", updateRetailerServicePrice);

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
  "/documents", clientScope,
  getSuperAdminDocuments,
);

router.get(
  "/documents/:id/view", clientScope,
  viewSuperAdminDocument,
);

router.get(
  "/documents/:id/download", clientScope,
  downloadSuperAdminDocument,
);

/* =========================================================
   PAYMENTS
========================================================= */

router.get(
  "/payments", clientScope,
  getSuperAdminPayments,
);

router.get(
  "/payments/:id/view", clientScope,
  viewSuperAdminPaymentScreenshot,
);

router.get(
  "/payments/:id/download", clientScope,
  downloadSuperAdminPaymentScreenshot,
);

router.patch(
  "/payments/:id/status", clientScope,
  updateSuperAdminPaymentStatus,
);

/* =========================================================
   RETAILER MANAGEMENT - REQUESTS, DOCUMENTS, PAYMENTS
========================================================= */

router.get("/retailers/requests", retailerScope, getSuperAdminRequests);
router.get("/retailers/requests/:id", retailerScope, getSuperAdminRequest);
router.patch("/retailers/requests/:id/status", retailerScope, updateSuperAdminRequestStatus);
router.post("/retailers/requests/:id/final-receipt", retailerScope, documentUpload.single("finalReceipt"), uploadFinalReceipt);

router.get("/retailers/documents", retailerScope, getSuperAdminDocuments);
router.get("/retailers/documents/:id/view", retailerScope, viewSuperAdminDocument);
router.get("/retailers/documents/:id/download", retailerScope, downloadSuperAdminDocument);

router.get("/retailers/payments", retailerScope, getSuperAdminPayments);
router.get("/retailers/payments/:id/view", retailerScope, viewSuperAdminPaymentScreenshot);
router.get("/retailers/payments/:id/download", retailerScope, downloadSuperAdminPaymentScreenshot);
router.patch("/retailers/payments/:id/status", retailerScope, updateSuperAdminPaymentStatus);



/* =========================================================
   CLIENT REQUESTS
========================================================= */

router.get("/requests", clientScope, getSuperAdminRequests);
router.get("/requests/:id", clientScope, getSuperAdminRequest);
router.patch("/requests/:id/status", clientScope, updateSuperAdminRequestStatus);
router.post("/requests/:id/final-receipt", clientScope, documentUpload.single("finalReceipt"), uploadFinalReceipt);

export default router;

  
// Distributor Management
router.get("/distributors", getDistributors);
router.post("/distributors", createDistributor);
router.patch("/distributors/:id/status", updateDistributorStatus);
