import { db } from "../config/database.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function getSuperAdminDashboard(req, res, next) {
  try {
    const [
      [userStats],
      [requestStats],
      [documentStats],
      [paymentStats],
      [recentUsers],
      [recentRequests],
    ] = await Promise.all([
      db.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(role = 'client') AS clients,
          SUM(role = 'staff') AS staff,
          SUM(role = 'admin') AS admins,
          SUM(role = 'superadmin') AS superadmins,
          SUM(status = 'active') AS active,
          SUM(status = 'inactive') AS inactive,
          SUM(status = 'suspended') AS suspended,
          SUM(status = 'pending') AS pending
        FROM users
      `),

      db.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(status = 'pending') AS pending,
          SUM(status = 'submitted') AS submitted,
          SUM(status = 'in_review') AS inReview,
          SUM(status = 'documents_required') AS documentsRequired,
          SUM(status = 'processing') AS processing,
          SUM(status = 'completed') AS completed,
          SUM(status = 'rejected') AS rejected,
          SUM(status = 'cancelled') AS cancelled,
          COALESCE(SUM(amount), 0) AS totalAmount
        FROM requests
      `),

      db.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(status = 'uploaded') AS uploaded,
          SUM(status = 'verified') AS verified,
          SUM(status = 'rejected') AS rejected
        FROM request_documents
      `),

      db.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(status = 'paid') AS paid,
          SUM(status = 'pending') AS pending,
          SUM(status = 'failed') AS failed,
          SUM(status = 'refunded') AS refunded,
          SUM(status = 'cancelled') AS cancelled,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paidAmount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingAmount
        FROM payments
      `),

      db.execute(`
        SELECT
          u.id,
          u.uuid,
          u.email,
          u.role,
          u.status,
          u.created_at,
          u.last_login_at,
          p.first_name,
          p.last_name,
          p.phone
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 10
      `),

      db.execute(`
        SELECT
          r.id,
          r.request_number,
          r.title,
          r.status,
          r.priority,
          r.amount,
          r.created_at,
          u.email AS user_email,
          p.first_name,
          p.last_name,
          s.name AS service_name
        FROM requests r
        INNER JOIN users u ON u.id = r.user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        INNER JOIN services s ON s.id = r.service_id
        ORDER BY r.created_at DESC
        LIMIT 10
      `),
    ]);

    const users = userStats[0] || {};
    const requests = requestStats[0] || {};
    const documents = documentStats[0] || {};
    const payments = paymentStats[0] || {};

    res.json({
      success: true,

      admin: {
        id: req.user.id,
        uuid: req.user.uuid,
        email: req.user.email,
        role: req.user.role,
      },

      users: {
        total: Number(users.total || 0),
        clients: Number(users.clients || 0),
        staff: Number(users.staff || 0),
        admins: Number(users.admins || 0),
        superadmins: Number(users.superadmins || 0),
        active: Number(users.active || 0),
        inactive: Number(users.inactive || 0),
        suspended: Number(users.suspended || 0),
        pending: Number(users.pending || 0),
      },

      requests: {
        total: Number(requests.total || 0),
        pending: Number(requests.pending || 0),
        submitted: Number(requests.submitted || 0),
        inReview: Number(requests.inReview || 0),
        documentsRequired: Number(requests.documentsRequired || 0),
        processing: Number(requests.processing || 0),
        completed: Number(requests.completed || 0),
        rejected: Number(requests.rejected || 0),
        cancelled: Number(requests.cancelled || 0),
        totalAmount: Number(requests.totalAmount || 0),
      },

      documents: {
        total: Number(documents.total || 0),
        uploaded: Number(documents.uploaded || 0),
        verified: Number(documents.verified || 0),
        rejected: Number(documents.rejected || 0),
      },

      payments: {
        total: Number(payments.total || 0),
        paid: Number(payments.paid || 0),
        pending: Number(payments.pending || 0),
        failed: Number(payments.failed || 0),
        refunded: Number(payments.refunded || 0),
        cancelled: Number(payments.cancelled || 0),
        paidAmount: Number(payments.paidAmount || 0),
        pendingAmount: Number(payments.pendingAmount || 0),
      },

      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
        status: user.status,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      })),

      recentRequests: recentRequests.map((request) => ({
        id: request.id,
        requestNumber: request.request_number,
        title: request.title,
        serviceName: request.service_name,
        status: request.status,
        priority: request.priority,
        amount: Number(request.amount || 0),
        user: {
          email: request.user_email,
          firstName: request.first_name,
          lastName: request.last_name,
        },
        createdAt: request.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   SUPERADMIN USERS
========================================================= */

export async function getSuperAdminUsers(req, res, next) {
  try {
    const {
      search = "",
      role = "",
      status = "",
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100,
    );

    const offset = (currentPage - 1) * perPage;

    const conditions = [];
    const values = [];

    /*
     * Search
     */
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;

      conditions.push(`
        (
          u.email LIKE ?
          OR u.uuid LIKE ?
          OR p.first_name LIKE ?
          OR p.last_name LIKE ?
          OR p.phone LIKE ?
        )
      `);

      values.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    /*
     * Role filter
     */
    if (role.trim()) {
      conditions.push("u.role = ?");
      values.push(role.trim());
    }

    /*
     * Status filter
     */
    if (status.trim()) {
      conditions.push("u.status = ?");
      values.push(status.trim());
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    /*
     * Total count
     */
    const [[countResult]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN profiles p
          ON p.user_id = u.id
        ${whereClause}
      `,
      values,
    );

    const total = Number(countResult?.total || 0);

    /*
     * Users
     *
     * NOTE:
     * Password/hash is intentionally NOT selected.
     */
    const [users] = await db.execute(
      `
        SELECT
          u.id,
          u.uuid,
          u.email,
          u.role,
          u.status,
          u.created_at,
          u.last_login_at,

          p.first_name,
          p.last_name,
          p.phone

        FROM users u

        LEFT JOIN profiles p
          ON p.user_id = u.id

        ${whereClause}

        ORDER BY u.created_at DESC

        LIMIT ${perPage}
        OFFSET ${offset}
      `,
      values,
    );

    const totalPages = Math.max(
      Math.ceil(total / perPage),
      1,
    );

    res.json({
      success: true,

      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        totalPages,
      },

      users: users.map((user) => ({
        id: user.id,
        uuid: user.uuid,
        email: user.email,

        role: user.role,
        status: user.status,

        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,

        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      })),
    });
  } catch (error) {
    next(error);
  }
}


/* =========================================================
   UPDATE USER STATUS
========================================================= */

export async function updateSuperAdminUserStatus(
  req,
  res,
  next,
) {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "active",
      "inactive",
      "suspended",
      "pending",
    ];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status.",
      });
    }

    /*
     * Prevent SuperAdmin from suspending/deactivating
     * their own account.
     */
    if (userId === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status.",
      });
    }

    const [result] = await db.execute(
      `
        UPDATE users
        SET status = ?
        WHERE id = ?
      `,
      [status, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      message: "User status updated successfully.",
    });
  } catch (error) {
    next(error);
  }
}


/* =========================================================
   UPDATE USER ROLE
========================================================= */

export async function updateSuperAdminUserRole(
  req,
  res,
  next,
) {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;

    const allowedRoles = [
      "client",
      "staff",
      "admin",
      "superadmin",
    ];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    /*
     * Prevent SuperAdmin from changing their own role.
     */
    if (userId === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role.",
      });
    }

    const [result] = await db.execute(
      `
        UPDATE users
        SET role = ?
        WHERE id = ?
      `,
      [role, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      message: "User role updated successfully.",
    });
  } catch (error) {
    next(error);
  }
}

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocuments,
} from "../controllers/document.controller.js";
import { documentUpload } from "../config/uploads.js";

const router = Router();

router.use(requireAuth);

router.get("/request/:requestId", listDocuments);

router.post(
  "/request/:requestId",
  documentUpload.array("documents", 5),
  uploadDocuments,
);

router.get("/:id/download", downloadDocument);
router.delete("/:id", deleteDocument);

export default router;
