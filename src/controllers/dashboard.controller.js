import { db } from "../config/database.js";

function mapRequest(row) {
  const progressByStatus = {
    pending: 10,
    submitted: 20,
    in_review: 40,
    documents_required: 50,
    processing: 70,
    completed: 100,
    rejected: 100,
    cancelled: 100,
  };

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
    progress: progressByStatus[row.status] ?? 0,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function formatDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export async function getDashboard(req, res, next) {
  try {
    const userId = req.user.id;

    const [
      [profileRows],
      [requestRows],
      [notificationRows],
      [documentRows],
    ] = await Promise.all([
      db.execute(
        `SELECT u.email, u.role, u.status, u.created_at,
                p.first_name, p.last_name, p.phone
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id = ?
         LIMIT 1`,
        [userId],
      ),
      db.execute(
        `SELECT r.id, r.request_number, r.service_id, s.name AS service_name,
                r.title, r.description, r.status, r.priority, r.amount,
                r.due_date, r.completed_at, r.created_at, r.updated_at
         FROM requests r
         INNER JOIN services s ON s.id = r.service_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [userId],
      ),
      db.execute(
        `SELECT id, type, title, message, link, is_read, read_at, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId],
      ),
      db.execute(
        `SELECT COUNT(*) AS total
         FROM request_documents d
         INNER JOIN requests r ON r.id = d.request_id
         WHERE r.user_id = ?`,
        [userId],
      ),
    ]);

    if (!profileRows.length) {
      return res.status(404).json({
        success: false,
        message: "Account profile not found",
      });
    }

    const profile = profileRows[0];
    const requests = requestRows.map(mapRequest);

    const completed = requests.filter((item) => item.status === "completed").length;
    const actionRequired = requests.filter(
      (item) => item.status === "documents_required",
    ).length;
    const active = requests.filter(
      (item) => !["completed", "rejected", "cancelled"].includes(item.status),
    ).length;

    const unreadNotifications = notificationRows.filter(
      (item) => !item.is_read,
    ).length;

    res.json({
      success: true,
      profile: {
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        memberSince: formatDate(profile.created_at),
      },
      stats: {
        totalRequests: requests.length,
        activeRequests: active,
        completedRequests: completed,
        actionRequired,
        documents: Number(documentRows[0]?.total || 0),
        unreadNotifications,
      },
      requests: requests.slice(0, 5),
      notifications: notificationRows.map(mapNotification),
    });
  } catch (error) {
    next(error);
  }
}
