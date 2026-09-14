import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads", "profile-images");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const safeName = `profile-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${ext}`;

    cb(null, safeName);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG and WEBP images are allowed."));
  }
};

export const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const paymentScreenshotDir = path.join(
  process.cwd(),
  "uploads",
  "payment-screenshots",
);

if (!fs.existsSync(paymentScreenshotDir)) {
  fs.mkdirSync(paymentScreenshotDir, { recursive: true });
}

const paymentScreenshotStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, paymentScreenshotDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const safeName = `payment-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${ext}`;

    cb(null, safeName);
  },
});

const paymentScreenshotFilter = (_req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG and WEBP payment screenshots are allowed."));
  }
};

export const uploadPaymentScreenshot = multer({
  storage: paymentScreenshotStorage,
  fileFilter: paymentScreenshotFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("paymentScreenshot");