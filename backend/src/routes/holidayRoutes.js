const express = require('express');
const router = express.Router();
const Holiday = require('../models/Holiday');
const { authenticate, requireRole } = require('../middleware/auth');
const { getIo } = require('../utils/socket');

router.use(authenticate);

// GET /api/holidays - List holidays (supports ?year=YYYY)
router.get('/', async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const holidays = await Holiday.find({ year }).sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    console.error('Error fetching holidays:', err);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// POST /api/holidays - Add a company holiday (Admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, date, description, type } = req.body;
    if (!name || !date) {
      return res.status(400).json({ error: 'Holiday name and date are required.' });
    }

    const holidayDate = new Date(date);
    if (isNaN(holidayDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }

    const newHoliday = await Holiday.create({
      name: name.trim(),
      date: holidayDate,
      description: description ? description.trim() : '',
      type: type || 'Festival',
      year: holidayDate.getFullYear(),
      createdBy: req.user._id
    });

    const io = getIo();
    if (io) {
      io.emit('holidayUpdated', newHoliday);
    }

    res.status(201).json(newHoliday);
  } catch (err) {
    console.error('Error creating holiday:', err);
    res.status(500).json({ error: 'Failed to create holiday' });
  }
});

// DELETE /api/holidays/:id - Delete a holiday (Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found.' });
    }

    const io = getIo();
    if (io) {
      io.emit('holidayUpdated', { deleted: true, _id: req.params.id });
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    console.error('Error deleting holiday:', err);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

module.exports = router;
