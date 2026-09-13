import { db } from "../config/database.js";

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

export async function createNotification({
  userId,
  type,
  title,
  message,
  link = null,
  connection = db,
}) {
  await connection.execute(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, message, link],
  );
}

export async function listNotifications(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT id, type, title, message, link, is_read, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id],
    );

    res.json({
      success: true,
      notifications: rows.map(mapNotification),
      unreadCount: rows.reduce((count, row) => count + (!row.is_read ? 1 : 0), 0),
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(req, res, next) {
  try {
    const [result] = await db.execute(
      `UPDATE notifications
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND is_read = 0`,
      [req.params.id, req.user.id],
    );

    if (!result.affectedRows) {
      const [rows] = await db.execute(
        "SELECT id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1",
        [req.params.id, req.user.id],
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsRead(req, res, next) {
  try {
    await db.execute(
      `UPDATE notifications
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND is_read = 0`,
      [req.user.id],
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const [result] = await db.execute(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    next(error);
  }
}
