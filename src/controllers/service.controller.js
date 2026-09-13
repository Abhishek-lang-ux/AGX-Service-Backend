import { db } from "../config/database.js";

const DEFAULT_SERVICES = [
  ["GST Registration", "gst-registration", "Complete GST registration assistance.", "End-to-end assistance for GST registration and related documentation.", "GST", 999, 1],
  ["Income Tax Return", "income-tax-return", "Professional ITR preparation and filing.", "Preparation, review and filing assistance for eligible income tax returns.", "Income Tax", 799, 2],
  ["Accounting & Bookkeeping", "accounting-bookkeeping", "Monthly accounting and bookkeeping support.", "Organized bookkeeping and accounting support for businesses and professionals.", "Accounting", 1499, 3],
  ["Tax Consultation", "tax-consultation", "Personalized tax planning and consultation.", "Professional consultation for tax planning, compliance and general tax queries.", "Consultation", 499, 4],
  ["Business Registration", "business-registration", "Assistance with business registration.", "Guidance and documentation support for common business registration requirements.", "Business", 1999, 5],
  ["TDS & Compliance", "tds-compliance", "TDS return and compliance assistance.", "Support for TDS-related filing and routine compliance requirements.", "Compliance", 999, 6],
];

async function ensureDefaultServices(connection = db) {
  for (const service of DEFAULT_SERVICES) {
    await connection.execute(
      `INSERT INTO services
        (name, slug, short_description, description, category, base_price, is_active, display_order)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        short_description = VALUES(short_description),
        description = VALUES(description),
        category = VALUES(category),
        base_price = VALUES(base_price),
        is_active = 1,
        display_order = VALUES(display_order)`,
      service,
    );
  }
}

export { ensureDefaultServices };

export async function listServices(req, res, next) {
  try {
    await ensureDefaultServices();

    const [rows] = await db.execute(
      `SELECT id, name, slug, short_description, description, category,
              base_price, is_active, display_order
       FROM services
       WHERE is_active = 1
       ORDER BY display_order ASC, name ASC`,
    );

    res.json({
      success: true,
      services: rows.map((service) => ({
        id: service.id,
        name: service.name,
        slug: service.slug,
        shortDescription: service.short_description,
        description: service.description,
        category: service.category,
        basePrice: Number(service.base_price),
        isActive: Boolean(service.is_active),
        displayOrder: service.display_order,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getService(req, res, next) {
  try {
    await ensureDefaultServices();

    const [rows] = await db.execute(
      `SELECT id, name, slug, short_description, description, category,
              base_price, is_active, display_order
       FROM services
       WHERE slug = ? AND is_active = 1
       LIMIT 1`,
      [req.params.slug],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const service = rows[0];

    res.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        slug: service.slug,
        shortDescription: service.short_description,
        description: service.description,
        category: service.category,
        basePrice: Number(service.base_price),
        isActive: Boolean(service.is_active),
        displayOrder: service.display_order,
      },
    });
  } catch (error) {
    next(error);
  }
}
