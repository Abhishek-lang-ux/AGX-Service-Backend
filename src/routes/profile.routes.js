import { Router } from "express";

import {
  getProfile,
  updateProfile,
} from "../controllers/profile.controller.js";

import { requireAuth } from "../middleware/auth.js";
import { uploadProfileImage } from "../middleware/upload.js";

const router = Router();

router.use(requireAuth);

router.get("/", getProfile);

router.put(
  "/",
  uploadProfileImage.single("profileImage"),
  updateProfile,
);

export default router;