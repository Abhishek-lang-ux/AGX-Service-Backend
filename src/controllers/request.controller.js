import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import { createNotification } from "./notification.controller.js";

function makeRequestNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `AGX-${stamp}-${random}`;
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

    let services;

    if (serviceSlug) {
      // Slug is stable across environments and is the preferred identifier.
      [services] = await connection.execute(
        `SELECT id, name, slug, base_price
         FROM services
         WHERE slug = ? AND is_active = 1
         LIMIT 1`,
        [serviceSlug],
      );
    } else {
      [services] = await connection.execute(
        `SELECT id, name, slug, base_price
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
        service.base_price,
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
