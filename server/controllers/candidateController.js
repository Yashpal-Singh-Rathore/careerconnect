const pool = require('../config/db');

// GET /api/candidate/profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch user details and candidate profile (left join)
    const [rows] = await pool.execute(
      `SELECT u.name, u.email, cp.phone, cp.location, cp.skills, cp.education, cp.experience, cp.bio
       FROM users u
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate user not found.'
      });
    }

    const row = rows[0];

    return res.status(200).json({
      success: true,
      profile: {
        name: row.name,
        email: row.email,
        phone: row.phone || '',
        location: row.location || '',
        skills: row.skills || '',
        education: row.education || '',
        experience: row.experience || '',
        bio: row.bio || ''
      }
    });
  } catch (error) {
    console.error('Error fetching candidate profile:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching candidate profile.'
    });
  }
};

// PUT /api/candidate/profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { phone, location, skills, education, experience, bio } = req.body;

    const safePhone = phone !== undefined ? phone : null;
    const safeLocation = location !== undefined ? location : null;
    const safeSkills = skills !== undefined ? skills : null;
    const safeEducation = education !== undefined ? education : null;
    const safeExperience = experience !== undefined ? experience : null;
    const safeBio = bio !== undefined ? bio : null;

    // Upsert profile for candidate
    await pool.execute(
      `INSERT INTO candidate_profiles (user_id, phone, location, skills, education, experience, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone = VALUES(phone),
         location = VALUES(location),
         skills = VALUES(skills),
         education = VALUES(education),
         experience = VALUES(experience),
         bio = VALUES(bio)`,
      [userId, safePhone, safeLocation, safeSkills, safeEducation, safeExperience, safeBio]
    );

    // Fetch updated profile with user's name and email
    const [rows] = await pool.execute(
      `SELECT u.name, u.email, cp.phone, cp.location, cp.skills, cp.education, cp.experience, cp.bio
       FROM users u
       JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE u.id = ?`,
      [userId]
    );

    const updated = rows[0];

    return res.status(200).json({
      success: true,
      message: 'Candidate profile updated successfully',
      profile: {
        name: updated.name,
        email: updated.email,
        phone: updated.phone || '',
        location: updated.location || '',
        skills: updated.skills || '',
        education: updated.education || '',
        experience: updated.experience || '',
        bio: updated.bio || ''
      }
    });
  } catch (error) {
    console.error('Error updating candidate profile:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating candidate profile.'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
