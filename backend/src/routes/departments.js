const express = require('express');
const Department = require('../models/Department');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/departments - list all departments (any authenticated user —
// needed for dropdowns like the announcement/department picker, profile
// department field, etc.)
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/departments - create a department (admin only)
router.post('/', requireRole(['admin']), async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Department name is required.' });
  }

  try {
    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ error: 'A department with this name already exists.' });
    }

    const department = new Department({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: req.user._id,
    });
    await department.save();

    res.status(201).json(department);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/departments/:id - update a department (admin only)
router.put('/:id', requireRole(['admin']), async (req, res) => {
  const { name, description } = req.body;

  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ error: 'Department not found.' });

    if (name && name.trim()) department.name = name.trim();
    if (description !== undefined) department.description = description.trim();

    await department.save();
    res.json(department);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/departments/:id - remove a department (admin only)
// Note: department on the User model is a free-text field (not a
// reference), so deleting a Department record here does not touch any
// existing users who already have that department name set — it only
// removes it from future dropdown lists.
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) return res.status(404).json({ error: 'Department not found.' });

    res.json({ message: 'Department deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;