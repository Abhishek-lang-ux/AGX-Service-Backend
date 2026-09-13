import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocuments,
} from "../controllers/document.controller.js";
import { documentUpload } from "../config/uploads.js";

const router = Router();

router.use(requireAuth);

router.get("/request/:requestId", listDocuments);

router.post(
  "/request/:requestId",
  documentUpload.array("documents", 5),
  uploadDocuments,
);

router.get("/:id/download", downloadDocument);
router.delete("/:id", deleteDocument);

export default router;
