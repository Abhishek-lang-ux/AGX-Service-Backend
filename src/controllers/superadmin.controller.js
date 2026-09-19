import { db } from "../config/database.js";
import { createNotification } from "./notification.controller.js";
import fs from "node:fs/promises";
import path from "node:path";

const uploadRoot = path.resolve(process.cwd(), "uploads");

/* =========================================================
   SUPERADMIN DASHBOARD
========================================================= */

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
          SUM(status = 'pending') AS pending,
          SUM(status = 'rejected') AS rejected
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
          COALESCE(
            SUM(
              CASE
                WHEN status = 'paid' THEN amount
                ELSE 0
              END
            ),
            0
          ) AS paidAmount,
          COALESCE(
            SUM(
              CASE
                WHEN status = 'pending' THEN amount
                ELSE 0
              END
            ),
            0
          ) AS pendingAmount
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
        LEFT JOIN profiles p
          ON p.user_id = u.id
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
        INNER JOIN users u
          ON u.id = r.user_id
        LEFT JOIN profiles p
          ON p.user_id = u.id
        INNER JOIN services s
          ON s.id = r.service_id
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
        documentsRequired: Number(
          requests.documentsRequired || 0
        ),
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
  rejected: Number(payments.rejected || 0),
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

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const offset = (currentPage - 1) * perPage;

    const conditions = [];
    const values = [];

    /* Search */

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
        searchTerm
      );
    }

    /* Role */

    if (role.trim()) {
      conditions.push("u.role = ?");
      values.push(role.trim());
    }

    /* Status */

    if (status.trim()) {
      conditions.push("u.status = ?");
      values.push(status.trim());
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    /* Total */

    const [[countResult]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN profiles p
          ON p.user_id = u.id
        ${whereClause}
      `,
      values
    );

    const total = Number(
      countResult?.total || 0
    );

    /* Users */

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
      values
    );

    const totalPages = Math.max(
      Math.ceil(total / perPage),
      1
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
   RETAILER APPLICATIONS
========================================================= */

export async function getSuperAdminRetailers(req, res, next) {
  try {
    const [rows] = await db.execute(`
      SELECT
        u.id,
        u.email,
        u.status,
        u.created_at,
        p.first_name,
        p.last_name,
        p.phone
      FROM users u
      LEFT JOIN profiles p
        ON p.user_id = u.id
      WHERE u.role = "retailer"
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      retailers: rows,
    });
  } catch (error) {
    next(error);
  }
}


export async function getPendingRetailers(req, res, next) {
  try {
    const [rows] = await db.execute(
      `
        SELECT
          u.id,
          u.uuid,
          u.email,
          u.role,
          u.status,
          u.created_at,
          p.first_name,
          p.last_name,
          p.phone,
          p.city,
          p.state
        FROM users u
        LEFT JOIN profiles p
          ON p.user_id = u.id
        WHERE u.role = 'retailer'
          AND u.status = 'pending'
        ORDER BY u.created_at ASC
      `,
    );

    res.json({
      success: true,
      retailers: rows.map((retailer) => ({
        id: retailer.id,
        uuid: retailer.uuid,
        email: retailer.email,
        role: retailer.role,
        status: retailer.status,
        createdAt: retailer.created_at,
        firstName: retailer.first_name ?? null,
        lastName: retailer.last_name ?? null,
        phone: retailer.phone ?? null,
        city: retailer.city ?? null,
        state: retailer.state ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRetailerApproval(req, res, next) {
  try {
    const retailerId = Number(req.params.id);
    const { action } = req.body;

    if (!Number.isInteger(retailerId) || retailerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid retailer ID.",
      });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be approve or reject.",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT id, role, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [retailerId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Retailer not found.",
      });
    }

    const retailer = rows[0];

    if (retailer.role !== "retailer") {
      return res.status(400).json({
        success: false,
        message: "This user is not a retailer.",
      });
    }

    if (retailer.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Retailer account is already ${retailer.status}.`,
      });
    }

    const newStatus = action === "approve" ? "active" : "suspended";

    await db.execute(
      `
        UPDATE users
        SET status = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [newStatus, retailerId],
    );

    res.json({
      success: true,
      message:
        action === "approve"
          ? "Retailer approved successfully."
          : "Retailer rejected successfully.",
      retailer: {
        id: retailerId,
        status: newStatus,
      },
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
  next
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

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
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

    if (userId === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot change your own account status.",
      });
    }

    const [result] = await db.execute(
      `
        UPDATE users
        SET status = ?
        WHERE id = ?
      `,
      [status, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      message:
        "User status updated successfully.",
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
  next
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

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
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

    if (userId === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot change your own role.",
      });
    }

    const [result] = await db.execute(
      `
        UPDATE users
        SET role = ?
        WHERE id = ?
      `,
      [role, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      message:
        "User role updated successfully.",
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   SUPERADMIN DOCUMENTS
========================================================= */

export async function getSuperAdminDocuments(
  req,
  res,
  next
) {
  try {
    const [rows] = await db.execute(`
      SELECT
        d.id,
        d.request_id,
        d.original_name,
        d.mime_type,
        d.file_size,
        d.document_type,
        d.status,
        d.rejection_reason,
        d.created_at,
        d.updated_at,

        r.request_number,
        r.title AS request_title,
        r.status AS request_status,

        u.id AS user_id,
        u.email AS user_email,

        p.first_name,
        p.last_name,
        p.phone,

        s.name AS service_name

      FROM request_documents d

      INNER JOIN requests r
        ON r.id = d.request_id

      INNER JOIN users u
        ON u.id = r.user_id

      LEFT JOIN profiles p
        ON p.user_id = u.id

      LEFT JOIN services s
        ON s.id = r.service_id

      WHERE u.role = ?
      ORDER BY d.created_at DESC
    `, [req.superAdminScopeRole || "client"]);

    res.json({
      success: true,

      documents: rows.map((row) => ({
        id: row.id,
        requestId: row.request_id,

        originalName: row.original_name,
        mimeType: row.mime_type,
        fileSize: Number(row.file_size || 0),

        documentType: row.document_type,
        status: row.status,
        rejectionReason: row.rejection_reason,

        createdAt: row.created_at,
        updatedAt: row.updated_at,

        requestNumber: row.request_number,
        requestTitle: row.request_title,
        requestStatus: row.request_status,

        userId: row.user_id,
        userEmail: row.user_email,

        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,

        serviceName: row.service_name,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   SUPERADMIN DOCUMENT VIEW
========================================================= */

export async function viewSuperAdminDocument(
  req,
  res,
  next
) {
  try {
    const documentId = Number(req.params.id);

    if (
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT
          original_name,
          storage_path,
          mime_type
        FROM request_documents d
        INNER JOIN requests r
          ON r.id = d.request_id
        INNER JOIN users u
          ON u.id = r.user_id
        WHERE d.id = ?
          AND u.role = ?
        LIMIT 1
      `,
      [documentId, req.superAdminScopeRole || "client"]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = rows[0];

    const absolutePath = path.resolve(
      process.cwd(),
      document.storage_path
    );

    /* Prevent path traversal */

    const relativePath = path.relative(
      uploadRoot,
      absolutePath
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(403).json({
        success: false,
        message: "Document access denied",
      });
    }

    /* Check file */

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({
        success: false,
        message:
          "Document file not found on server",
      });
    }

    res.setHeader(
      "Content-Type",
      document.mime_type ||
        "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(
        document.original_name
      )}`
    );

    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   SUPERADMIN DOCUMENT DOWNLOAD
========================================================= */

export async function downloadSuperAdminDocument(
  req,
  res,
  next
) {
  try {
    const documentId = Number(req.params.id);

    if (
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT
          d.original_name,
          d.storage_path,
          d.mime_type
        FROM request_documents d
        INNER JOIN requests r
          ON r.id = d.request_id
        INNER JOIN users u
          ON u.id = r.user_id
        WHERE d.id = ?
          AND u.role = ?
        LIMIT 1
      `,
      [documentId, req.superAdminScopeRole || "client"]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = rows[0];

    const absolutePath = path.resolve(
      process.cwd(),
      document.storage_path
    );

    /* Prevent path traversal */

    const relativePath = path.relative(
      uploadRoot,
      absolutePath
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(403).json({
        success: false,
        message: "Document access denied",
      });
    }

    /* Check file */

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({
        success: false,
        message:
          "Document file not found on server",
      });
    }

    return res.download(
      absolutePath,
      document.original_name
    );
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   SUPERADMIN PAYMENTS
========================================================= */

function parsePaymentMetadata(value) {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}


/* =========================================================
   LIST PAYMENTS
========================================================= */

export async function getSuperAdminPayments(req, res, next) {
  try {
    const [rows] = await db.execute(`
      SELECT
        p.id,
        p.request_id,
        p.user_id,
        p.amount,
        p.currency,
        p.provider,
        p.provider_payment_id,
        p.status,
        p.paid_at,
        p.metadata,
        p.created_at,
        p.updated_at,

        r.request_number,
        r.title AS request_title,

        u.email AS user_email,

        pr.first_name,
        pr.last_name,
        pr.phone,

        s.name AS service_name

      FROM payments p

      INNER JOIN requests r
        ON r.id = p.request_id

      INNER JOIN users u
        ON u.id = p.user_id

      LEFT JOIN profiles pr
        ON pr.user_id = u.id

      LEFT JOIN services s
        ON s.id = r.service_id

      WHERE u.role = ?

      ORDER BY p.created_at DESC
    `, [req.superAdminScopeRole || "client"]);

    res.json({
      success: true,

      payments: rows.map((payment) => {
        const metadata = parsePaymentMetadata(payment.metadata);

        return {
          id: payment.id,

          requestId: payment.request_id,
          requestNumber: payment.request_number,
          requestTitle: payment.request_title,

          serviceName: payment.service_name,

          userId: payment.user_id,
          userEmail: payment.user_email,
          firstName: payment.first_name,
          lastName: payment.last_name,
          phone: payment.phone,

          amount: Number(payment.amount || 0),
          currency: payment.currency,

          provider: payment.provider,
          providerPaymentId: payment.provider_payment_id,

          status: payment.status,

          paidAt: payment.paid_at,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at,

          screenshot: metadata.payment_screenshot || null,
          originalFilename:
            metadata.original_filename || null,
          mimeType:
            metadata.mime_type || null,
          fileSize:
            Number(metadata.file_size || 0),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}


/* =========================================================
   VIEW PAYMENT SCREENSHOT
========================================================= */

export async function viewSuperAdminPaymentScreenshot(
  req,
  res,
  next
) {
  try {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT
          metadata
        FROM payments p
        INNER JOIN users u
          ON u.id = p.user_id
        WHERE p.id = ?
          AND u.role = ?
        LIMIT 1
      `,
      [paymentId, req.superAdminScopeRole || "client"]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    const metadata = parsePaymentMetadata(rows[0].metadata);

    if (!metadata.payment_screenshot) {
      return res.status(404).json({
        success: false,
        message: "Payment screenshot not found.",
      });
    }

    const storedPath = String(metadata.payment_screenshot || "")
  .replace(/^[/\\]+/, "")
  .replace(/^uploads[/\\]+/, "");

const absolutePath = path.resolve(
  uploadRoot,
  storedPath
);

    /* Prevent path traversal */

    const relativePath = path.relative(
      uploadRoot,
      absolutePath
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(403).json({
        success: false,
        message: "Payment screenshot access denied.",
      });
    }

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: "Payment screenshot file not found on server.",
      });
    }

    res.setHeader(
      "Content-Type",
      metadata.mime_type || "image/jpeg"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(
        metadata.original_filename || `payment-${paymentId}`
      )}`
    );

    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
}


/* =========================================================
   DOWNLOAD PAYMENT SCREENSHOT
========================================================= */

export async function downloadSuperAdminPaymentScreenshot(
  req,
  res,
  next
) {
  try {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT
          metadata
        FROM payments p
        INNER JOIN users u
          ON u.id = p.user_id
        WHERE p.id = ?
          AND u.role = ?
        LIMIT 1
      `,
      [paymentId, req.superAdminScopeRole || "client"]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    const metadata = parsePaymentMetadata(rows[0].metadata);

    if (!metadata.payment_screenshot) {
      return res.status(404).json({
        success: false,
        message: "Payment screenshot not found.",
      });
    }

    const storedPath = String(metadata.payment_screenshot || "")
  .replace(/^[/\\]+/, "")
  .replace(/^uploads[/\\]+/, "");

const absolutePath = path.resolve(
  uploadRoot,
  storedPath
);

    /* Prevent path traversal */

    const relativePath = path.relative(
      uploadRoot,
      absolutePath
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(403).json({
        success: false,
        message: "Payment screenshot access denied.",
      });
    }

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: "Payment screenshot file not found on server.",
      });
    }

    return res.download(
      absolutePath,
      metadata.original_filename ||
        `payment-${paymentId}`
    );
  } catch (error) {
    next(error);
  }
}


/* =========================================================
   ACCEPT / REJECT PAYMENT
========================================================= */

export async function updateSuperAdminPaymentStatus(
  req,
  res,
  next
) {
  let connection;

  try {
    const paymentId = Number(req.params.id);
    const { status, rejectionReason = "" } = req.body;

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const allowedStatuses = ["paid", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status.",
      });
    }

    connection = await db.getConnection();

    await connection.beginTransaction();

    /*
     * Lock payment row so two SuperAdmins cannot
     * process the same pending payment simultaneously.
     */

    const [paymentRows] = await connection.execute(
      `
        SELECT
          p.id,
          p.request_id,
          p.user_id,
          p.amount,
          p.status,
          r.request_number,
          s.name AS service_name
        FROM payments p
        INNER JOIN users u
          ON u.id = p.user_id
        INNER JOIN requests r
          ON r.id = p.request_id
        INNER JOIN services s
          ON s.id = r.service_id
        WHERE p.id = ?
          AND u.role = ?
        LIMIT 1
        FOR UPDATE
      `,
      [paymentId, req.superAdminScopeRole || "client"]
    );

    if (!paymentRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    const payment = paymentRows[0];

    if (payment.status !== "pending") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: `Payment has already been ${payment.status}.`,
      });
    }

    /*
     * ACCEPT
     */

    if (status === "paid") {
      await connection.execute(
        `
          UPDATE payments
          SET
            status = 'paid',
            paid_at = NOW(),
            updated_at = NOW()
          WHERE p.id = ?
          AND u.role = ?
          AND u.role = ?
        `,
        [paymentId, req.superAdminScopeRole || "client"]
      );

      /*
       * Keep request status as pending for now.
       * Payment verification and request processing
       * remain separate.
       */

      await createNotification({
        userId: payment.user_id,
        type: "payment",
        title: "Payment accepted",
        message:
          `Your payment for request ${payment.request_number} has been verified successfully.`,
        link: "/payments",
        connection,
      });
    }

    /*
     * REJECT
     */

    if (status === "rejected") {
      await connection.execute(
        `
          UPDATE payments
          SET
            status = 'rejected',
            updated_at = NOW()
          WHERE p.id = ?
          AND u.role = ?
          AND u.role = ?
        `,
        [paymentId, req.superAdminScopeRole || "client"]
      );

      const cleanReason = String(
        rejectionReason || ""
      ).trim();

      const reasonText = cleanReason
        ? ` Reason: ${cleanReason}`
        : "";

      await createNotification({
        userId: payment.user_id,
        type: "payment",
        title: "Payment rejected",
        message:
          `Your payment proof for request ${payment.request_number} was rejected.${reasonText}`,
        link: "/payments",
        connection,
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message:
        status === "paid"
          ? "Payment accepted successfully."
          : "Payment rejected successfully.",
      payment: {
        id: paymentId,
        status,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/* =========================================================
   SUPERADMIN REQUESTS — LIST
========================================================= */

export async function getSuperAdminRequests(req, res, next) {
  try {
    const { search = "", status = "" } = req.query;

    const conditions = ["u.role = ?"];
    const values = [req.superAdminScopeRole || "client"];


    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;

      conditions.push(`
        (
          r.request_number LIKE ?
          OR r.title LIKE ?
          OR u.email LIKE ?
          OR p.first_name LIKE ?
          OR p.last_name LIKE ?
          OR s.name LIKE ?
        )
      `);

      values.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      );
    }

    if (status.trim()) {
      conditions.push("r.status = ?");
      values.push(status.trim());
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await db.execute(
      `
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
          p.phone,

          s.name AS service_name

        FROM requests r

        INNER JOIN users u
          ON u.id = r.user_id

        LEFT JOIN profiles p
          ON p.user_id = u.id

        INNER JOIN services s
          ON s.id = r.service_id

        ${whereClause}

        ORDER BY r.created_at DESC
      `,
      values
    );

    res.json({
      success: true,

      requests: rows.map((request) => ({
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
          phone: request.phone,
        },

        createdAt: request.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   SUPERADMIN REQUEST — SINGLE (with payments + documents)
========================================================= */

export async function getSuperAdminRequest(req, res, next) {
  try {
    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT
          r.id,
          r.request_number,
          r.title,
          r.description,
          r.status,
          r.priority,
          r.amount,
          r.created_at,
          r.updated_at,

          u.id AS user_id,
          u.email AS user_email,

          p.first_name,
          p.last_name,
          p.phone,

          s.name AS service_name

        FROM requests r

        INNER JOIN users u
          ON u.id = r.user_id

        LEFT JOIN profiles p
          ON p.user_id = u.id

        INNER JOIN services s
          ON s.id = r.service_id

        WHERE r.id = ?
          AND u.role = ?
        LIMIT 1
      `,
      [requestId, req.superAdminScopeRole || "client"]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    const request = rows[0];

    const [payments] = await db.execute(
      `
        SELECT id, amount, status
        FROM payments
        WHERE request_id = ?
        ORDER BY created_at DESC
      `,
      [requestId, req.superAdminScopeRole || "client"]
    );

    const [documents] = await db.execute(
      `
        SELECT id, original_name, document_type, status
        FROM request_documents
        WHERE request_id = ?
        ORDER BY created_at DESC
      `,
      [requestId, req.superAdminScopeRole || "client"]
    );

    res.json({
      success: true,

      request: {
        id: request.id,
        requestNumber: request.request_number,
        title: request.title,
        description: request.description,
        serviceName: request.service_name,
        status: request.status,
        priority: request.priority,
        amount: Number(request.amount || 0),

        user: {
          id: request.user_id,
          email: request.user_email,
          firstName: request.first_name,
          lastName: request.last_name,
          phone: request.phone,
        },

        payments: payments.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount || 0),
          status: payment.status,
        })),

        documents: documents.map((doc) => ({
          id: doc.id,
          original_filename: doc.original_name,
          document_type: doc.document_type,
          status: doc.status,
        })),

        createdAt: request.created_at,
        updatedAt: request.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   UPDATE REQUEST STATUS
========================================================= */

export async function updateSuperAdminRequestStatus(
  req,
  res,
  next
) {
  let connection;

  try {
    const requestId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "submitted",
      "in_review",
      "documents_required",
      "processing",
      "completed",
      "rejected",
      "cancelled",
    ];

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request status.",
      });
    }

    connection = await db.getConnection();

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          r.id,
          r.request_number,
          r.user_id,
          r.status
        FROM requests r
        INNER JOIN users u
          ON u.id = r.user_id
        WHERE r.id = ?
          AND u.role = ?
        LIMIT 1
        FOR UPDATE
      `,
      [requestId, req.superAdminScopeRole || "client"]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    const request = rows[0];

    await connection.execute(
      `
        UPDATE requests
        SET status = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [status, requestId]
    );

    await createNotification({
      userId: request.user_id,
      type: "request",
      title: "Request status updated",
      message: `Your request ${request.request_number} status is now "${status}".`,
      link: "/requests",
      connection,
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Request status updated successfully.",
      request: {
        id: requestId,
        status,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/* =========================================================
   UPDATE RETAILER SERVICE PRICE
========================================================= */

export async function updateRetailerServicePrice(req, res, next) {
  try {
    const serviceId = Number(req.params.id);
    const retailerPrice = Number(req.body?.retailerPrice);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    if (!Number.isFinite(retailerPrice) || retailerPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid retailer price.",
      });
    }

    const [result] = await db.execute(
      `
        UPDATE services
        SET retailer_price = ?
        WHERE id = ?
        LIMIT 1
      `,
      [retailerPrice, serviceId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT id, name, base_price, retailer_price
        FROM services
        WHERE id = ?
        LIMIT 1
      `,
      [serviceId]
    );

    const service = rows[0];

    res.json({
      success: true,
      message: "Retailer service price updated successfully.",
      service: {
        id: service.id,
        name: service.name,
        basePrice: Number(service.base_price),
        retailerPrice: Number(service.retailer_price),
      },
    });
  } catch (error) {
    next(error);
  }
}
