import mysql from "mysql2/promise.js";
import { env } from "./env.js";

export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

export async function checkDatabaseConnection() {
  const connection = await db.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
