import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { db } from "../config/database.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const payload = jwt.verify(token, env.jwt.secret);

    const [rows] = await db.execute(
      `SELECT id, uuid, email, role, status FROM users
       WHERE id = ? AND status = 'active' LIMIT 1`,
      [payload.sub],
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: "User account is unavailable" });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid or expired authentication token" });
    }
    next(error);
  }
}
