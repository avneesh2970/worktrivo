const LoginActivity = require("../models/LoginActivity");
const User = require("../models/User");

// ======================================================
// Get All Login Activities (Admin / Manager)
// ======================================================
const getLoginActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      action = "",
    } = req.query;

    const query = {};

    // Filter by action if provided
    if (action) {
      query.action = action;
    }

    // Handle search over referenced User fields (name, email)
    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = matchingUsers.map((user) => user._id);

      // Search matches referenced users OR root-level cached fields (if present)
      query.$or = [
        { user: { $in: userIds } },
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const numericPage = Math.max(1, parseInt(page, 10) || 1);
    const numericLimit = Math.max(1, parseInt(limit, 10) || 20);

    const total = await LoginActivity.countDocuments(query);

    const activities = await LoginActivity.find(query)
      .populate("user", "name email role profilePhoto")
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit);

    return res.json({
      success: true,
      total,
      page: numericPage,
      pages: Math.ceil(total / numericLimit) || 1,
      data: activities,
    });
  } catch (err) {
    console.error("Get Login Activities Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch login activities.",
    });
  }
};

// ======================================================
// Get Logged-in User Login History
// ======================================================
const getMyLoginActivities = async (req, res) => {
  try {
    const activities = await LoginActivity.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: activities,
    });
  } catch (err) {
    console.error("Get My Login Activities Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch login history.",
    });
  }
};

// ======================================================
// Delete All Login Activities (Admin Only)
// ======================================================
const clearLoginActivities = async (req, res) => {
  try {
    await LoginActivity.deleteMany({});

    return res.json({
      success: true,
      message: "Login activity cleared successfully.",
    });
  } catch (err) {
    console.error("Clear Login Activities Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to clear login activities.",
    });
  }
};

module.exports = {
  getMyLoginActivities,
  clearLoginActivities,
  getLoginActivities,
};