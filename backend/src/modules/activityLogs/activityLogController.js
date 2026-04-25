const { getActivityLogs } = require('./activityLogService');
const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function listActivityLogs(req, res, next) {
  try {
    const filters = {
      action_type: req.query.action_type || null,
      entity_type: req.query.entity_type || null,
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      user_search: req.query.user_search || null
    };

    const logs = await getActivityLogs(filters);
    return sendSuccess(res, 'Activity logs fetched successfully', logs);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listActivityLogs
};
