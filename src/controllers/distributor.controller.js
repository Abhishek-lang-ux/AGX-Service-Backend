import { db } from "../config/database.js";

export async function getDistributorDashboard(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT
         d.id,
         d.distributor_code,
         d.status AS distributor_status,
         d.created_at,
         u.id AS user_id,
         u.email,
         u.phone,
         u.status AS user_status,
         p.first_name,
         p.last_name
       FROM distributors d
       INNER JOIN users u ON u.id = d.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE d.user_id = ?
       LIMIT 1`,
      [req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Distributor account was not found",
      });
    }

    const distributor = rows[0];

    if (
      distributor.distributor_status !== "active" ||
      distributor.user_status !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "Distributor account is not active",
      });
    }

    const [retailerStats] = await db.execute(
      `SELECT
         COUNT(*) AS totalRetailers,
         SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS activeRetailers,
         SUM(CASE WHEN u.status = 'pending' THEN 1 ELSE 0 END) AS pendingRetailers
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.role = 'retailer'
         AND p.distributor_id = ?`,
      [distributor.id],
    ).catch(() => [[{
      totalRetailers: 0,
      activeRetailers: 0,
      pendingRetailers: 0,
    }]]);

    return res.json({
      success: true,
      distributor: {
        id: distributor.id,
        userId: distributor.user_id,
        distributorCode: distributor.distributor_code,
        status: distributor.distributor_status,
        email: distributor.email,
        phone: distributor.phone,
        firstName: distributor.first_name,
        lastName: distributor.last_name,
        createdAt: distributor.created_at,
      },
      stats: {
        totalRetailers: Number(retailerStats[0]?.totalRetailers || 0),
        activeRetailers: Number(retailerStats[0]?.activeRetailers || 0),
        pendingRetailers: Number(retailerStats[0]?.pendingRetailers || 0),
        totalCommission: 0,
        availableWallet: 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAssignedRetailers(req, res, next) {
  try {
    const distributorUserId = Number(req.user?.id || req.user?.sub);

    if (!Number.isInteger(distributorUserId) || distributorUserId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid distributor authentication",
      });
    }

    const [distributorRows] = await db.execute(
      `
        SELECT id, distributor_code, status
        FROM distributors
        WHERE user_id = ?
        LIMIT 1
      `,
      [distributorUserId]
    );

    if (!distributorRows.length) {
      return res.status(404).json({
        success: false,
        message: "Distributor profile not found",
      });
    }

    const distributor = distributorRows[0];

    if (distributor.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Distributor account is not active",
      });
    }

    const [rows] = await db.execute(
      `
        SELECT
          u.id,
          u.uuid,
          u.email,
          u.status,
          u.created_at,
          p.first_name,
          p.last_name,
          p.phone,
          p.distributor_id
        FROM profiles p
        INNER JOIN users u ON u.id = p.user_id
        WHERE u.role = 'retailer'
          AND p.distributor_id = ?
        ORDER BY u.created_at DESC
      `,
      [distributor.id]
    );

    return res.json({
      success: true,
      distributor: {
        id: distributor.id,
        code: distributor.distributor_code,
        status: distributor.status,
      },
      retailers: rows.map((retailer) => ({
        id: retailer.id,
        uuid: retailer.uuid,
        email: retailer.email,
        status: retailer.status,
        createdAt: retailer.created_at,
        firstName: retailer.first_name,
        lastName: retailer.last_name,
        phone: retailer.phone,
        distributorId: retailer.distributor_id,
      })),
      total: rows.length,
    });
  } catch (error) {
    next(error);
  }
}
