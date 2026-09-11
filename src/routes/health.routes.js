import { Router } from "express";
import { checkDatabaseConnection } from "../config/database.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    await checkDatabaseConnection();

    res.json({
      success: true,
      message: "AGX Service Portal API is running",
      database: "connected",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
