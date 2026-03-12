const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

router.get('/supabase', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Supabase query failed',
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Supabase connected successfully',
      data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
});

module.exports = router;