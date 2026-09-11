import { db } from "../config/database.js";

function clean(value) {
  return value === undefined ? null : String(value).trim() || null;
}

export async function getProfile(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT
         u.id, u.uuid, u.email, u.role, u.status,
         p.first_name, p.last_name, p.phone, p.date_of_birth,
         p.address_line1, p.address_line2, p.city, p.state,
         p.postal_code, p.country, p.avatar_path, p.bio
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    const p = rows[0];

    res.json({
      success: true,
      profile: {
        id: p.id,
        uuid: p.uuid,
        email: p.email,
        role: p.role,
        status: p.status,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.phone,
        dateOfBirth: p.date_of_birth,
        addressLine1: p.address_line1,
        addressLine2: p.address_line2,
        city: p.city,
        state: p.state,
        postalCode: p.postal_code,
        country: p.country,
        avatarPath: p.avatar_path,
        bio: p.bio,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const firstName = clean(req.body.firstName);
    const lastName = clean(req.body.lastName);
    const phone = clean(req.body.phone);
    const dateOfBirth = clean(req.body.dateOfBirth);
    const addressLine1 = clean(req.body.addressLine1);
    const addressLine2 = clean(req.body.addressLine2);
    const city = clean(req.body.city);
    const state = clean(req.body.state);
    const postalCode = clean(req.body.postalCode);
    const country = clean(req.body.country) || "India";
    const bio = clean(req.body.bio);

    if (!firstName) {
      return res.status(400).json({
        success: false,
        message: "First name is required",
      });
    }

    await db.execute(
      `INSERT INTO profiles
         (user_id, first_name, last_name, phone, date_of_birth,
          address_line1, address_line2, city, state, postal_code, country, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         first_name = VALUES(first_name),
         last_name = VALUES(last_name),
         phone = VALUES(phone),
         date_of_birth = VALUES(date_of_birth),
         address_line1 = VALUES(address_line1),
         address_line2 = VALUES(address_line2),
         city = VALUES(city),
         state = VALUES(state),
         postal_code = VALUES(postal_code),
         country = VALUES(country),
         bio = VALUES(bio)`,
      [
        req.user.id,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        bio,
      ],
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
}
