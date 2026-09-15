import { db } from "../config/database.js";
import { createNotification } from "./notification.controller.js";

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
    method: row.metadata?.method || "Manual Payment",
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    razorpayOrderId: null,
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

export async function listMyPayments(req, res, next) {
  try {
    const [rows] = await db.execute(
      `${paymentSelect}
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id],
    );

    res.json({
      success: true,
      payments: rows.map(mapPayment),
    });
  } catch (error) {
    next(error);
  }
}