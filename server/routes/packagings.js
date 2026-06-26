const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Packaging = require('../models/Packaging');

const router = express.Router();

// Get all packagings (All authenticated users)
router.get('/', auth, async (req, res) => {
  try {
    const packagings = await Packaging.findAll({
      where: { isActive: true },
      attributes: ['id', 'brandName', 'code', 'allottedKg'], // Only essential fields
      order: [['brandName', 'ASC']],
      raw: true // Faster
    });

    const SampleEntry = require('../models/SampleEntry');
    const RiceProduction = require('../models/RiceProduction');

    const packagingsWithInUse = await Promise.all(packagings.map(async (p) => {
      // Check sample entries by packaging code/kg string (SampleEntry has packaging field usually string)
      const sCount = await SampleEntry.count({
        where: { packaging: p.allottedKg.toString() }
      });
      // Check rice productions by packagingId
      const rCount = await RiceProduction.count({
        where: { packagingId: p.id }
      });
      p.inUse = (sCount > 0 || rCount > 0);
      return p;
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ packagings: packagingsWithInUse });
  } catch (error) {
    console.error('Get packagings error:', error);
    res.status(500).json({ error: 'Failed to fetch packagings' });
  }
});

// Create packaging (Manager/Admin only)
router.post('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { brandName, code, allottedKg } = req.body;

    if (!brandName || !code || !allottedKg) {
      return res.status(400).json({ error: 'Brand name, code, and allotted kg are required' });
    }

    // Check for duplicate (brandName + allottedKg)
    const existing = await Packaging.findOne({
      where: {
        brandName: brandName.trim(),
        allottedKg: parseFloat(allottedKg),
        isActive: true
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Packaging with this brand name and weight already exists' });
    }

    const packaging = await Packaging.create({
      brandName: brandName.trim(),
      code,
      allottedKg: parseFloat(allottedKg)
    });

    res.status(201).json({
      message: 'Packaging created successfully',
      packaging
    });
  } catch (error) {
    console.error('Create packaging error:', error);
    res.status(500).json({ error: 'Failed to create packaging' });
  }
});

// Update packaging (Manager/Admin only)
router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    const { brandName, code, allottedKg } = req.body;
    const oldAllottedKg = packaging.allottedKg;

    // Check for duplicate (brandName + allottedKg) excluding current packaging
    if (brandName && allottedKg) {
      const existing = await Packaging.findOne({
        where: {
          brandName: brandName.trim(),
          allottedKg: parseFloat(allottedKg),
          isActive: true,
          id: { [require('sequelize').Op.ne]: req.params.id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Packaging with this brand name and weight already exists' });
      }
    }

    await packaging.update({
      brandName: brandName ? brandName.trim() : undefined,
      code,
      allottedKg: allottedKg ? parseFloat(allottedKg) : undefined
    });

    // If allottedKg changed, recalculate all rice production records using this packaging
    if (allottedKg && parseFloat(allottedKg) !== parseFloat(oldAllottedKg)) {
      const RiceProduction = require('../models/RiceProduction');
      const { sequelize } = require('../config/database');

      // Update all rice production records with this packaging
      // quantityQuintals = (bags × allottedKg) / 100
      await sequelize.query(`
        UPDATE rice_productions
        SET "quantityQuintals" = (bags * :allottedKg) / 100.0,
            "updatedAt" = NOW()
        WHERE "packagingId" = :packagingId
      `, {
        replacements: {
          allottedKg: parseFloat(allottedKg),
          packagingId: req.params.id
        }
      });

      console.log(`✅ Recalculated quantities for all rice productions using packaging ID ${req.params.id}`);
    }

    res.json({
      message: 'Packaging updated successfully and related records recalculated',
      packaging
    });
  } catch (error) {
    console.error('Update packaging error:', error);
    res.status(500).json({ error: 'Failed to update packaging' });
  }
});

// Delete packaging (Manager/Admin only)
router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({ error: 'Packaging not found' });
    }

    // Check if referenced in SampleEntries or RiceProductions
    const SampleEntry = require('../models/SampleEntry');
    const RiceProduction = require('../models/RiceProduction');

    const sCount = await SampleEntry.count({
      where: { packaging: packaging.allottedKg.toString() }
    });
    const rCount = await RiceProduction.count({
      where: { packagingId: req.params.id }
    });

    if (sCount > 0 || rCount > 0) {
      return res.status(400).json({ error: 'Cannot delete brand because it is in use by sample entries or production records' });
    }

    // Hard delete
    await packaging.destroy();

    res.json({ message: 'Packaging deleted successfully' });
  } catch (error) {
    console.error('Delete packaging error:', error);
    res.status(500).json({ error: 'Failed to delete packaging' });
  }
});

module.exports = router;
