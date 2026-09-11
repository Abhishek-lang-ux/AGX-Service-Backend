import { db } from "../config/database.js";

export async function listServices(req, res, next) {
  try {
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
