import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import requestRoutes from "./routes/request.routes.js";
import documentRoutes from "./routes/document.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "https://agx-service.vercel.app",
        process.env.CLIENT_URL,
      ].filter(Boolean);

      // Allow requests without Origin
      // (Postman, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
  }),
);

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    /*
     * Profile images are served from the backend
     * and displayed on the Vercel frontend.
     */
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

/* =========================================================
   STATIC FILES
========================================================= */

/*
 * Makes:
 *
 * uploads/profile-images/example.jpg
 *
 * available at:
 *
 * /uploads/profile-images/example.jpg
 *
 * Example:
 * https://agx-service-backend.onrender.com/uploads/profile-images/example.jpg
 */

app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads"),
  ),
);

/* =========================================================
   API ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "AGX Service Portal API",
    version: "1.0.0",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api/health", healthRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/profile", profileRoutes);

app.use("/api/services", serviceRoutes);

app.use("/api/requests", requestRoutes);

app.use("/api/documents", documentRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/dashboard", dashboardRoutes);

/* =========================================================
   ERROR HANDLING
========================================================= */

app.use(notFoundHandler);

app.use(errorHandler);

export default app;