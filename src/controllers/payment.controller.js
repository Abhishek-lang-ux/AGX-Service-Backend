import crypto from "node:crypto";
import Razorpay from "razorpay";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { createNotification } from "./notification.controller.js";

const razorpay = new Razorpay({
  key_id: env.razorpay.keyId,
  key_secret: env.razorpay.keySecret,
});

function mapPayment(row) {
  const statusMap = {
    paid: "Paid",
    pending: "Pending",
    failed: "Failed",
    refunded: "Refunded",
    cancelled: "Cancelled",
  };

  return {
    id: row.id,
    invoice: `INV-AGX-${String(row.id).padStart(5, "0")}`,
    request: row.request_number,
    requestId: row.request_id,
    service: row.service_name,
    date: row.paid_at || row.created_at,
    amount: Number(row.amount),
    status: statusMap[row.status] || row.status,
    method: row.metadata?.method || "—",
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    razorpayOrderId: row.metadata?.razorpay_order_id || null,
  };
}

const paymentSelect = `
  SELECT p.id, p.request_id, p.user_id, p.amount, p.currency, p.provider,
         p.provider_payment_id, p.status, p.paid_at, p.metadata, p.created_at,
         r.request_number, s.name AS service_name
  FROM payments p
  INNER JOIN requests r ON r.id = p.request_id
  INNER JOIN services s ON s.id = r.service_id
`;

export async function createPaymentOrder(req, res, next) {
  const connection = await db.getConnection();

  try {
    if (!env.razorpay.keyId || !env.razorpay.keySecret) {
      return res.status(503).json({
        success: false,
        message: "Razorpay is not configured on the server. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      });
    }

    const requestId = Number(req.body.requestId);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "Valid request ID is required" });
    }

    const [requests] = await connection.execute(
      `SELECT r.id, r.request_number, r.amount, r.status, s.name AS service_name
       FROM requests r
       INNER JOIN services s ON s.id = r.service_id
       WHERE r.id = ? AND r.user_id = ? LIMIT 1`,
      [requestId, req.user.id],
    );

    if (!requests.length) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const request = requests[0];
    const amount = Math.round(Number(request.amount) * 100);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "This service does not have a valid payable amount" });
    }

    const receipt = `AGX-${request.request_number}-${Date.now()}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        request_id: String(request.id),
        request_number: request.request_number,
        user_id: String(req.user.id),
      },
    });

    await connection.execute(
      `INSERT INTO payments
        (request_id, user_id, amount, currency, provider, provider_payment_id, status, metadata)
       VALUES (?, ?, ?, 'INR', 'razorpay', NULL, 'pending', ?)`,
      [
        request.id,
        req.user.id,
        Number(request.amount),
        JSON.stringify({
          razorpay_order_id: order.id,
          receipt: order.receipt,
        }),
      ],
    );

    res.status(201).json({
      success: true,
      keyId: env.razorpay.keyId,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      request: {
        id: request.id,
        requestNumber: request.request_number,
        serviceName: request.service_name,
        amount: Number(request.amount),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
}

export async function verifyPayment(req, res, next) {
  const connection = await db.getConnection();

  try {
    const {
      requestId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body;

    const numericRequestId = Number(requestId);

    if (
      !Number.isInteger(numericRequestId) ||
      numericRequestId <= 0 ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return res.status(400).json({ success: false, message: "Incomplete Razorpay payment response" });
    }

    const [payments] = await connection.execute(
      `SELECT id, request_id, user_id, amount, status, metadata
       FROM payments
       WHERE request_id = ? AND user_id = ? AND provider = 'razorpay'
       ORDER BY id DESC LIMIT 1`,
      [numericRequestId, req.user.id],
    );

    if (!payments.length) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    const payment = payments[0];
    const storedOrderId = payment.metadata?.razorpay_order_id;

    if (storedOrderId !== razorpayOrderId) {
      return res.status(400).json({ success: false, message: "Payment order mismatch" });
    }

    if (!env.razorpay.keySecret) {
      return res.status(503).json({
        success: false,
        message: "Razorpay is not configured on the server.",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", env.razorpay.keySecret)
      .update(`${storedOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const providedSignature = Buffer.from(String(razorpaySignature));
    const expectedSignature = Buffer.from(generatedSignature);
    const validSignature =
      providedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(expectedSignature, providedSignature);

    if (!validSignature) {
      await connection.execute(
        "UPDATE payments SET status = 'failed' WHERE id = ? AND user_id = ?",
        [payment.id, req.user.id],
      );
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    const [existingPaid] = await connection.execute(
      "SELECT id FROM payments WHERE provider = 'razorpay' AND provider_payment_id = ? LIMIT 1",
      [razorpayPaymentId],
    );

    if (existingPaid.length && existingPaid[0].id !== payment.id) {
      return res.status(409).json({ success: false, message: "This Razorpay payment is already linked to another payment record" });
    }

    await connection.beginTransaction();

    await connection.execute(
      `UPDATE payments
       SET provider_payment_id = ?, status = 'paid', paid_at = CURRENT_TIMESTAMP,
           metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.verified', true)
       WHERE id = ? AND user_id = ?`,
      [razorpayPaymentId, payment.id, req.user.id],
    );

    await connection.execute(
      `UPDATE requests
       SET status = CASE
         WHEN status IN ('submitted', 'pending') THEN 'processing'
         ELSE status
       END
       WHERE id = ? AND user_id = ?`,
      [numericRequestId, req.user.id],
    );

    await createNotification({
      userId: req.user.id,
      type: "payment",
      title: "Payment successful",
      message: `Payment for request #${numericRequestId} was completed successfully.`,
      link: "/payments",
      connection,
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Payment verified successfully",
      payment: {
        id: payment.id,
        requestId: numericRequestId,
        razorpayPaymentId,
        razorpayOrderId,
        status: "Paid",
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function listMyPayments(req, res, next) {
  try {
    const [rows] = await db.execute(
      `${paymentSelect}
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id],
    );

    res.json({ success: true, payments: rows.map(mapPayment) });
  } catch (error) {
    next(error);
  }
}
