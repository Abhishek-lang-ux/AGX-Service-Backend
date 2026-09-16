import { db } from "../config/database.js";

const DEFAULT_SERVICES = [
  [
    "GST Registration",
    "gst-registration",
    "Complete GST registration assistance.",
    "End-to-end assistance for GST registration and related documentation.",
    "GST",
    1999,
    1,
  ],
  [
    "Income Tax Return",
    "income-tax-return",
    "Professional ITR preparation and filing.",
    "Preparation, review and filing assistance for eligible income tax returns.",
    "Income Tax",
    599,
    2,
  ],
  [
    "Accounting & Bookkeeping",
    "accounting-bookkeeping",
    "Monthly accounting, bookkeeping and GST Filing support.",
    "Organized bookkeeping and accounting support for businesses and professionals.",
    "Accounting",
    499,
    3,
  ],[
  "Project Report",
  "project-report",
  "Professional project report preparation assistance.",
  "Complete project report preparation assistance for business, loan, startup, MSME and other applicable requirements.",
  "Business",
  1999,
  4,
],
[
  "Balance Sheet",
  "balance-sheet",
  "Professional balance sheet preparation assistance.",
  "Preparation of balance sheet, financial statements and related accounting reports for businesses and applicable financial requirements.",
  "Accounting",
  1999,
  5,
],
[
  "Aadhaar + PAN Link",
  "aadhaar-pan-link",
  "Assistance with linking Aadhaar with PAN.",
  "Complete assistance with Aadhaar and PAN linking, verification and applicable online process.",
  "Documents",
  1099,
  6,
],
  [
    "Website Development",
    "website-development",
    "Professional website development for businesses and professionals.",
    "Modern, responsive and mobile-friendly website development for businesses, startups, professionals and personal brands.",
    "Digital",
    6999,
    7,
  ],
  [
    "PF Withdrawal Assistance",
    "pf-withdrawal",
    "Assistance with PF withdrawal and applicable EPFO processes.",
    "Guidance and assistance with PF withdrawal claims, required documentation and applicable EPFO-related processes.",
    "Documents",
    199,
    8,
  ],
  [
  "PVC Aadhaar Card",
  "pvc-aadhaar-card",
  "Assistance with PVC Aadhaar card application.",
  "Complete assistance with PVC Aadhaar card ordering, application and applicable Aadhaar-related process.",
  "Documents",
  99,
  9,
],
  [
    "PAN Card Services",
    "pan-card-services",
    "PAN application, correction and reprint assistance.",
    "Assistance with new PAN applications, corrections, reprints and applicable PAN-related processes.",
    "Documents",
    160,
    10,
  ],
  [
  "E-Bill Website Development",
  "ebill-website-development",
  "Professional e-bill and billing website development.",
  "Complete e-bill website development with billing features, customer management, invoice generation and a professional responsive interface.",
  "Digital",
  9999,
  140,
],
];

async function ensureDefaultServices(connection = db) {
  // Use a transaction when possible so a fresh/empty production database
  // cannot remain partially seeded. This function is intentionally idempotent.
  const ownsConnection = connection === db;
  const conn = ownsConnection ? await db.getConnection() : connection;

  try {
    if (ownsConnection) await conn.beginTransaction();

    for (const service of DEFAULT_SERVICES) {
      await conn.execute(
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

    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM services WHERE is_active = 1`,
    );
    const total = Number(rows[0]?.total || 0);

    if (ownsConnection) await conn.commit();

    return total;
  } catch (error) {
    if (ownsConnection) await conn.rollback();
    throw error;
  } finally {
    if (ownsConnection) conn.release();
  }
}

export { DEFAULT_SERVICES, ensureDefaultServices };

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
