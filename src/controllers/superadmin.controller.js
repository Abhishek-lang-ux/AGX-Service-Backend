import { db } from "../config/database.js";

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