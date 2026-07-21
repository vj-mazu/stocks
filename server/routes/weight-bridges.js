const express = require('express');
const router = express.Router();
const { WeightBridge, User, Arrival, SampleEntry } = require('../models');
const { auth } = require('../middleware/auth');


// GET /api/weight-bridges - List all weight bridges
router.get('/', auth, async (req, res) => {
    try {
        const bridges = await WeightBridge.findAll({
            where: { isActive: true },
            order: [['name', 'ASC']],
            include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }],
        });

        // Add isUsed flag for each bridge
        const bridgesWithUsedFlag = await Promise.all(bridges.map(async (bridge) => {
            const countInArrivals = await Arrival.count({ where: { millWbId: bridge.id } });
            const countInSampleEntries = await SampleEntry.count({ where: { millWbId: bridge.id } });
            return {
                ...bridge.toJSON(),
                isUsed: (countInArrivals + countInSampleEntries) > 0
            };
        }));

        res.json({ bridges: bridgesWithUsedFlag });
    } catch (error) {
        console.error('Error fetching weight bridges:', error);
        res.status(500).json({ error: 'Failed to fetch weight bridges' });
    }
});

// POST /api/weight-bridges - Create a new weight bridge
router.post('/', auth, async (req, res) => {
    try {
        const { name, location, grossWeight, tareWeight, netWeight } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Weight bridge name is required' });
        }
        const bridge = await WeightBridge.create({
            name: name.trim().toUpperCase(),
            location: location ? location.trim() : null,
            grossWeight: grossWeight || null,
            tareWeight: tareWeight || null,
            netWeight: netWeight || null,
            createdBy: req.user.id,
        });
        res.status(201).json({ bridge });
    } catch (error) {
        console.error('Error creating weight bridge:', error);
        res.status(500).json({ error: 'Failed to create weight bridge' });
    }
});

// PUT /api/weight-bridges/:id - Update a weight bridge
router.put('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, grossWeight, tareWeight, netWeight, isActive } = req.body;
        const bridge = await WeightBridge.findByPk(id);
        if (!bridge) {
            return res.status(404).json({ error: 'Weight bridge not found' });
        }
        if (name !== undefined) bridge.name = name.trim().toUpperCase();
        if (location !== undefined) bridge.location = location ? location.trim() : null;
        if (grossWeight !== undefined) bridge.grossWeight = grossWeight;
        if (tareWeight !== undefined) bridge.tareWeight = tareWeight;
        if (netWeight !== undefined) bridge.netWeight = netWeight;
        if (isActive !== undefined) bridge.isActive = isActive;
        await bridge.save();
        res.json({ bridge });
    } catch (error) {
        console.error('Error updating weight bridge:', error);
        res.status(500).json({ error: 'Failed to update weight bridge' });
    }
});

// DELETE /api/weight-bridges/:id - Hard delete a weight bridge if not used
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const bridge = await WeightBridge.findByPk(id);
        if (!bridge) {
            return res.status(404).json({ error: 'Weight bridge not found' });
        }

        // Check if used
        const countInArrivals = await Arrival.count({ where: { millWbId: id } });
        const countInSampleEntries = await SampleEntry.count({ where: { millWbId: id } });
        if ((countInArrivals + countInSampleEntries) > 0) {
            return res.status(400).json({ error: 'Cannot delete weight bridge as it is already associated with arrivals or in-transit entries' });
        }

        await bridge.destroy();
        res.json({ message: 'Weight bridge deleted successfully' });
    } catch (error) {
        console.error('Error deleting weight bridge:', error);
        res.status(500).json({ error: 'Failed to delete weight bridge' });
    }
});

module.exports = router;
