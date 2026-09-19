const pool = require('../config/db');

// GET /api/recruiter/profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch user details and recruiter profile (left join)
    const [rows] = await pool.execute(
      `SELECT u.name, u.email, rp.company_name, rp.phone, rp.location, rp.company_description
       FROM users u
       LEFT JOIN recruiter_profiles rp ON u.id = rp.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter user not found.'
      });
    }

    const row = rows[0];

    return res.status(200).json({
      success: true,
      profile: {
        name: row.name,
        email: row.email,
        company_name: row.company_name || '',
        phone: row.phone || '',
        location: row.location || '',
        company_description: row.company_description || ''
      }
    });
  } catch (error) {
    console.error('Error fetching recruiter profile:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching recruiter profile.'
    });
  }
};

// PUT /api/recruiter/profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { company_name, phone, location, company_description } = req.body;

    const safeCompanyName = company_name !== undefined ? company_name : null;
    const safePhone = phone !== undefined ? phone : null;
    const safeLocation = location !== undefined ? location : null;
    const safeCompanyDesc = company_description !== undefined ? company_description : null;

    // Upsert profile for recruiter
    await pool.execute(
      `INSERT INTO recruiter_profiles (user_id, company_name, phone, location, company_description)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         company_name = VALUES(company_name),
         phone = VALUES(phone),
         location = VALUES(location),
         company_description = VALUES(company_description)`,
      [userId, safeCompanyName, safePhone, safeLocation, safeCompanyDesc]
    );

    // Fetch updated profile with user's name and email
    const [rows] = await pool.execute(
      `SELECT u.name, u.email, rp.company_name, rp.phone, rp.location, rp.company_description
       FROM users u
       JOIN recruiter_profiles rp ON u.id = rp.user_id
       WHERE u.id = ?`,
      [userId]
    );

    const updated = rows[0];

    return res.status(200).json({
      success: true,
      message: 'Recruiter profile updated successfully',
      profile: {
        name: updated.name,
        email: updated.email,
        company_name: updated.company_name || '',
        phone: updated.phone || '',
        location: updated.location || '',
        company_description: updated.company_description || ''
      }
    });
  } catch (error) {
    console.error('Error updating recruiter profile:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating recruiter profile.'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
