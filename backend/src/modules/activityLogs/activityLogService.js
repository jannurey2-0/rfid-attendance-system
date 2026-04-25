const { supabaseAdmin } = require('../../config/supabase');
const AppError = require('../../utils/AppError');

async function getActivityLogs(filters = {}) {
  let query = supabaseAdmin
    .from('activity_logs')
    .select(`
      id,
      actor_profile_id,
      action_type,
      entity_type,
      entity_id,
      details,
      created_at,
      profiles (
        id,
        first_name,
        last_name
      )
    `);

  // Filter by action_type
  if (filters.action_type) {
    query = query.eq('action_type', filters.action_type);
  }

  // Filter by entity_type
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  // Filter by date range
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    // Add one day to include the entire end date
    const endDate = new Date(filters.date_to);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt('created_at', endDate.toISOString());
  }

  // Filter by user search (first name or last name)
  if (filters.user_search) {
    const searchTerm = `%${filters.user_search}%`;
    query = query.ilike('profiles.first_name', searchTerm).or(`profiles.last_name.ilike.${searchTerm}`);
  }

  // Order by created_at descending
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      'Failed to fetch activity logs',
      500,
      'FETCH_ACTIVITY_LOGS_FAILED',
      error.message
    );
  }

  return data;
}

module.exports = {
  getActivityLogs
};
