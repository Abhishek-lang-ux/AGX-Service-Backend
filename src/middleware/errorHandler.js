export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each document must be 10 MB or smaller"
        : err.message || "Invalid document upload";

    return res.status(400).json({
      success: false,
      message,
    });
  }

  const status = Number(err.statusCode || err.status || 500);

  res.status(status).json({
    success: false,
    message:
      status >= 500 ? "Internal server error" : err.message || "Request failed",
  });
}
