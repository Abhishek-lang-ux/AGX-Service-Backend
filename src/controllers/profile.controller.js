import { db } from "../config/database.js";
import fs from "fs";
import path from "path";

function clean(value) {
  return value === undefined ? null : String(value).trim() || null;
}

function getAvatarUrl(req, avatarPath) {
  if (!avatarPath) return null;

  // Normalize legacy HTTP URLs stored in the database.
  // The frontend is served over HTTPS, so profile images must never remain HTTP.
  if (avatarPath.startsWith("http://")) {
    return `https://${avatarPath.slice("http://".length)}`;
  }

  // Already a complete HTTPS URL
  if (avatarPath.startsWith("https://")) {
    return avatarPath;
  }

  const cleanPath = avatarPath.startsWith("/")
    ? avatarPath
    : `/${avatarPath}`;

  return `${req.protocol}://${req.get("host")}${cleanPath}`;
}

export async function getProfile(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT
         u.id,
         u.uuid,
         u.email,
         u.role,
         u.status,
         p.first_name,
         p.last_name,
         p.phone,
         p.date_of_birth,
         p.address_line1,
         p.address_line2,
         p.city,
         p.state,
         p.postal_code,
         p.country,
         p.avatar_path,
         p.bio
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
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

        avatarPath: p.avatar_path
          ? getAvatarUrl(req, p.avatar_path)
          : null,

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

    /*
     * If a new profile image was uploaded,
     * save its relative path in database.
     */
    let avatarPath = null;

    if (req.file) {
      avatarPath = `/uploads/profile-images/${req.file.filename}`;
    }

    /*
     * Get existing avatar before updating.
     * We need this so that the old image can be deleted
     * after a new image is uploaded.
     */
    const [existingRows] = await db.execute(
      `SELECT avatar_path
       FROM profiles
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.id],
    );

    const oldAvatarPath =
      existingRows.length > 0
        ? existingRows[0].avatar_path
        : null;

    /*
     * Keep old image if user did not select a new one.
     */
    if (!avatarPath) {
      avatarPath = oldAvatarPath;
    }

    await db.execute(
      `INSERT INTO profiles
         (
           user_id,
           first_name,
           last_name,
           phone,
           date_of_birth,
           address_line1,
           address_line2,
           city,
           state,
           postal_code,
           country,
           avatar_path,
           bio
         )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

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
         avatar_path = VALUES(avatar_path),
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
        avatarPath,
        bio,
      ],
    );

    /*
     * Delete old local image after DB update.
     *
     * Only delete files inside our profile-images folder.
     */
    if (
      req.file &&
      oldAvatarPath &&
      oldAvatarPath.startsWith("/uploads/profile-images/")
    ) {
      const oldFilename = path.basename(oldAvatarPath);

      const oldFilePath = path.join(
        process.cwd(),
        "uploads",
        "profile-images",
        oldFilename,
      );

      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        avatarPath: getAvatarUrl(req, avatarPath),
      },
    });
  } catch (error) {
    /*
     * If DB update fails after a new file was uploaded,
     * remove the newly uploaded file.
     */
    if (req.file) {
      const uploadedFilePath = path.join(
        process.cwd(),
        "uploads",
        "profile-images",
        req.file.filename,
      );

      if (fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch {
          // Ignore cleanup error
        }
      }
    }

    next(error);
  }
}