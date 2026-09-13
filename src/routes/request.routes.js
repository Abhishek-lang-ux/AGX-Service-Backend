import { Router } from "express";
import {
  createRequest,
  getMyRequest,
  listMyRequests,
} from "../controllers/request.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", listMyRequests);
router.post("/", createRequest);
router.get("/:id", getMyRequest);

export default router;
