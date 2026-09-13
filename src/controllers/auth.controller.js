import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";

function createToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, uuid: user.uuid },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn },
  );
}

function publicUser(user) {
  return {
    id: user.id,
    uuid: user.uuid,
    email: user.email,
    role: user.role,
    status: user.status,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
  };
}

export async function register(req, res, next) {
  const connection = await db.getConnection();

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim() || null;

    if (!email || !password || !firstName) {
      return res.status(400).json({ success: false, message: "First name, email and password are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const [existing] = await connection.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (existing.length) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const uuid = randomUUID();

    await connection.beginTransaction();

    const [userResult] = await connection.execute(
      "INSERT INTO users (uuid, email, password_hash) VALUES (?, ?, ?)",
      [uuid, email, passwordHash],
    );

    await connection.execute(
      "INSERT INTO profiles (user_id, first_name, last_name) VALUES (?, ?, ?)",
      [userResult.insertId, firstName, lastName],
    );

    await connection.commit();

    const user = {
      id: userResult.insertId, uuid, email, role: "client",
      status: "active", first_name: firstName, last_name: lastName,
    };

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const [rows] = await db.execute(
      `SELECT u.id, u.uuid, u.email, u.password_hash, u.role, u.status,
              p.first_name, p.last_name
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = ? LIMIT 1`,
      [email],
    );

    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = rows[0];

    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: "This account is not active" });
    }

    await db.execute(
      "UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0 WHERE id = ?",
      [user.id],
    );

    res.json({
      success: true,
      message: "Login successful",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  const [rows] = await db.execute(
    `SELECT u.id, u.uuid, u.email, u.role, u.status,
            p.first_name, p.last_name, p.phone, p.city, p.state,
            p.country, p.avatar_path
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [req.user.id],
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({ success: true, user: {
    ...publicUser(rows[0]),
    phone: rows[0].phone ?? null,
    city: rows[0].city ?? null,
    state: rows[0].state ?? null,
    country: rows[0].country ?? null,
    avatarPath: rows[0].avatar_path ?? null,
  }});
}
