import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../config/database.js";
import { createNotification } from "./notification.controller.js";

const uploadRoot = path.resolve(process.cwd(), "uploads");

function mapDocument(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    documentType: row.document_type,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function verifyRequestOwnership(requestId, userId) {
  const [rows] = await db.execute(
    "SELECT id FROM requests WHERE id = ? AND user_id = ? LIMIT 1",
    [requestId, userId],
  );
  return rows.length > 0;
}

export async function listDocuments(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);

    if (!(await verifyRequestOwnership(requestId, req.user.id))) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    const [rows] = await db.execute(
      `SELECT id, request_id, original_name, mime_type, file_size,
              document_type, status, rejection_reason, created_at, updated_at
       FROM request_documents
       WHERE request_id = ?
       ORDER BY created_at DESC`,
      [requestId],
    );

    res.json({
      success: true,
      documents: rows.map(mapDocument),
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadDocuments(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);

    if (!(await verifyRequestOwnership(requestId, req.user.id))) {
      if (req.files?.length) {
        await Promise.all(req.files.map((file) => fs.rm(file.path, { force: true })));
      }

      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    if (!req.files?.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one document",
      });
    }

    const documentType = String(req.body.documentType || "").trim() || null;

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const inserted = [];

      for (const file of req.files) {
        const relativePath = path.relative(process.cwd(), file.path);

        const [result] = await connection.execute(
          `INSERT INTO request_documents
             (request_id, uploaded_by, original_name, stored_name,
              storage_path, mime_type, file_size, document_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            requestId,
            req.user.id,
            file.originalname,
            file.filename,
            relativePath,
            file.mimetype,
            file.size,
            documentType,
          ],
        );

        inserted.push(result.insertId);
      }

      await createNotification({
        userId: req.user.id,
        type: "service",
        title: "Documents uploaded",
        message: `${inserted.length} document(s) were uploaded to your service request.`,
        link: "/documents",
        connection,
      });

      await connection.commit();

      const [rows] = await connection.query(
        `SELECT id, request_id, original_name, mime_type, file_size,
                document_type, status, rejection_reason, created_at, updated_at
         FROM request_documents
         WHERE id IN (${inserted.map(() => "?").join(",")})
         ORDER BY created_at DESC`,
        inserted,
      );

      res.status(201).json({
        success: true,
        message: `${inserted.length} document(s) uploaded successfully`,
        documents: rows.map(mapDocument),
      });
    } catch (error) {
      await connection.rollback();
      await Promise.all(req.files.map((file) => fs.rm(file.path, { force: true })));
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}

export async function downloadDocument(req, res, next) {
  try {
    const documentId = Number(req.params.id);

    const [rows] = await db.execute(
      `SELECT d.original_name, d.storage_path, d.mime_type
       FROM request_documents d
       INNER JOIN requests r ON r.id = d.request_id
       WHERE d.id = ? AND r.user_id = ?
       LIMIT 1`,
      [documentId, req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = rows[0];
    const absolutePath = path.resolve(process.cwd(), document.storage_path);

    if (!absolutePath.startsWith(uploadRoot)) {
      return res.status(403).json({
        success: false,
        message: "Document access denied",
      });
    }

    res.type(document.mime_type);
    res.download(absolutePath, document.original_name);
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const documentId = Number(req.params.id);

    const [rows] = await db.execute(
      `SELECT d.id, d.storage_path
       FROM request_documents d
       INNER JOIN requests r ON r.id = d.request_id
       WHERE d.id = ? AND r.user_id = ?
       LIMIT 1`,
      [documentId, req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    await db.execute("DELETE FROM request_documents WHERE id = ?", [documentId]);

    const absolutePath = path.resolve(process.cwd(), rows[0].storage_path);

    if (absolutePath.startsWith(uploadRoot)) {
      await fs.rm(absolutePath, { force: true });
    }

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
