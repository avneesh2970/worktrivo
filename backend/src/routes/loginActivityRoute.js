const express = require("express");
const {
  getLoginActivities,
  getMyLoginActivities,
  clearLoginActivities,
} = require("../controllers/LoginActivity");
const {
  authenticate,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();


router.get(
  "/me",
  authenticate,
  getMyLoginActivities
);

router.get(
  "/",
  authenticate,
  requireRole(["admin", "manager"]),
  getLoginActivities
);

/*
|--------------------------------------------------------------------------
| Admin Only - Clear Login Activity Logs
|--------------------------------------------------------------------------
| DELETE /api/login-activity
*/
router.delete(
  "/",
  authenticate,
  requireRole(["admin"]), // Standardized as array to match requireRole signature
  clearLoginActivities
);

module.exports = router;