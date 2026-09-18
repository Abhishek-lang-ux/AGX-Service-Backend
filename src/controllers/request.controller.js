import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import { createNotification } from "./notification.controller.js";
import { ensureDefaultServices } from "./service.controller.js";

function makeRequestNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `AGX-${stamp}-${random}`;
}

function getServicePrice(service, userRole) {
  if (userRole === "retailer") {
    return Number(service.retailer_price);
  }
  return Number(service.base_price);
}

function mapRequest(row) {
  return {
    id: row.id,
    requestNumber: row.request_number,
    serviceId: row.service_id,
    serviceName: row.service_name,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    amount: Number(row.amount),
    dueDate: row.due_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const requestSelect = `
  SELECT r.id, r.request_number, r.service_id, s.name AS service_name,
         r.title, r.description, r.status, r.priority, r.amount,
         r.due_date, r.completed_at, r.created_at, r.updated_at
  FROM requests r
  INNER JOIN services s ON s.id = r.service_id
`;

export async function createRequest(req, res, next) {
  const connection = await db.getConnection();

  try {
    // Prefer the immutable service slug sent by the frontend.
    // Numeric IDs can differ between databases after imports/seeding, which
    // previously caused a valid service to be reported as unavailable.
    const serviceSlug = String(req.body.serviceSlug || req.body.slug || "").trim().toLowerCase();
    const serviceId = Number(req.body.serviceId);
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim() || null;
    const priority = ["low", "normal", "high", "urgent"].includes(req.body.priority)
      ? req.body.priority
      : "normal";

    if ((!Number.isInteger(serviceId) || serviceId <= 0) && !serviceSlug) {
      return res.status(400).json({
        success: false,
        message: "A valid service is required",
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Request title is required",
      });
    }

    // Make sure a fresh production database has the catalog before resolving the request.
    // This prevents the old "Selected service is unavailable" error when seed.sql
    // was not executed on the production MySQL database.
    await ensureDefaultServices(connection);

    let services;

    if (serviceSlug) {
      // Slug is stable across environments and is the preferred identifier.
      [services] = await connection.execute(
        `SELECT id, name, slug, base_price, retailer_price
         FROM services
         WHERE slug = ? AND is_active = 1
         LIMIT 1`,
        [serviceSlug],
      );
    } else {
      [services] = await connection.execute(
        `SELECT id, name, slug, base_price, retailer_price
         FROM services
         WHERE id = ? AND is_active = 1
         LIMIT 1`,
        [serviceId],
      );
    }

    if (!services.length) {
      return res.status(404).json({
        success: false,
        message: "Selected service is unavailable",
      });
    }

    const service = services[0];
    const requestNumber = makeRequestNumber();

    const [result] = await connection.execute(
      `INSERT INTO requests
         (request_number, user_id, service_id, title, description, status, priority, amount)
       VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?)`,
      [
        requestNumber,
        req.user.id,
        service.id,
        title,
        description,
        priority,
        getServicePrice(service, req.user.role),
      ],
    );

    const [rows] = await connection.execute(
      `${requestSelect} WHERE r.id = ? AND r.user_id = ? LIMIT 1`,
      [result.insertId, req.user.id],
    );

    await createNotification({
      userId: req.user.id,
      type: "service",
      title: "Service request submitted",
      message: `Your ${service.name} request ${requestNumber} has been submitted successfully.`,
      link: "/myrequests",
      connection,
    });

    res.status(201).json({
      success: true,
      message: "Service request submitted successfully",
      request: mapRequest(rows[0]),
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
}

export async function listMyRequests(req, res, next) {
  try {
    const [rows] = await db.execute(
      `${requestSelect}
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id],
    );

    res.json({
      success: true,
      requests: rows.map(mapRequest),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyRequest(req, res, next) {
  try {
    const [rows] = await db.execute(
      `${requestSelect}
       WHERE r.id = ? AND r.user_id = ?
       LIMIT 1`,
      [req.params.id, req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    res.json({
      success: true,
      request: mapRequest(rows[0]),
    });
  } catch (error) {
    next(error);
  }
}

export async function submitRequestWithPayment(req, res, next) {
  const connection = await db.getConnection();

  try {
    const serviceSlug = String(
      req.body.serviceSlug || req.body.slug || "",
    )
      .trim()
      .toLowerCase();

    const serviceId = Number(req.body.serviceId);
    const title = String(req.body.title || "").trim();
    const description =
      String(req.body.description || "").trim() || null;

    const priority = [
      "low",
      "normal",
      "high",
      "urgent",
    ].includes(req.body.priority)
      ? req.body.priority
      : "normal";

    /*
     * Payment screenshot is mandatory.
     * Request must NEVER be created without it.
     */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment screenshot is required.",
      });
    }

    if ((!Number.isInteger(serviceId) || serviceId <= 0) && !serviceSlug) {
      return res.status(400).json({
        success: false,
        message: "A valid service is required.",
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Request title is required.",
      });
    }

    await ensureDefaultServices(connection);

    let services;

    if (serviceSlug) {
      [services] = await connection.execute(
        `SELECT id, name, slug, base_price, retailer_price
         FROM services
         WHERE slug = ? AND is_active = 1
         LIMIT 1`,
        [serviceSlug],
      );
    } else {
      [services] = await connection.execute(
        `SELECT id, name, slug, base_price, retailer_price
         FROM services
         WHERE id = ? AND is_active = 1
         LIMIT 1`,
        [serviceId],
      );
    }

    if (!services.length) {
      return res.status(404).json({
        success: false,
        message: "Selected service is unavailable.",
      });
    }

    const service = services[0];
    const amount = getServicePrice(service, req.user.role);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "This service does not have a valid payable amount.",
      });
    }

    const requestNumber = makeRequestNumber();

    await connection.beginTransaction();

    /*
     * 1. Create request ONLY after screenshot has been received.
     */
    const [requestResult] = await connection.execute(
      `INSERT INTO requests
        (
          request_number,
          user_id,
          service_id,
          title,
          description,
          status,
          priority,
          amount
        )
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        requestNumber,
        req.user.id,
        service.id,
        title,
        description,
        priority,
        amount,
      ],
    );

    const requestId = requestResult.insertId;

    /*
     * 2. Create manual QR payment record.
     */
    await connection.execute(
      `INSERT INTO payments
        (
          request_id,
          user_id,
          amount,
          currency,
          provider,
          provider_payment_id,
          status,
          metadata
        )
       VALUES (?, ?, ?, 'INR', 'manual_qr', NULL, 'pending', ?)`,
      [
        requestId,
        req.user.id,
        amount,
        JSON.stringify({
          method: "manual_qr",
          payment_screenshot: `/uploads/payment-screenshots/${req.file.filename}`,
          original_filename: req.file.originalname,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
        }),
      ],
    );

    /*
     * 3. Fetch newly created request.
     */
    const [rows] = await connection.execute(
      `${requestSelect}
       WHERE r.id = ? AND r.user_id = ?
       LIMIT 1`,
      [requestId, req.user.id],
    );

    if (!rows.length) {
      throw new Error("Request could not be loaded after creation.");
    }

    /*
     * 4. Notify client.
     */
    await createNotification({
      userId: req.user.id,
      type: "payment",
      title: "Payment proof submitted",
      message: `Payment proof for request ${requestNumber} has been submitted and is awaiting verification.`,
      link: "/payments",
      connection,
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        "Payment proof submitted successfully. Your request is awaiting payment verification.",
      request: mapRequest(rows[0]),
      payment: {
        status: "Pending",
        method: "manual_qr",
        screenshot: `/uploads/payment-screenshots/${req.file.filename}`,
      },
    });
  } catch (error) {
    await connection.rollback();

    /*
     * If DB creation failed after the screenshot was uploaded,
     * remove the orphaned screenshot.
     */
    if (req.file?.path) {
      try {
        const fs = await import("node:fs/promises");
        await fs.unlink(req.file.path);
      } catch {
        // Ignore cleanup failure.
      }
    }

    next(error);
  } finally {
    connection.release();
  }
}