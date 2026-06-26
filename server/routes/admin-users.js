const express = require('express');
const bcrypt = require('bcryptjs');
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const { auth, authorize } = require('../middleware/auth');
const {
  User,
  SampleEntry,
  QualityParameters,
  LotAllotment,
  PhysicalInspection,
  InventoryData,
  OpeningBalance,
  OtherHamaliEntry,
  Outturn,
  PaddyHamaliEntry,
  PurchaseRate,
  RiceHamaliEntry,
  RiceProduction,
  RiceStockLocation
} = require('../models');

const router = express.Router();

/**
 * Helper to check if a user has recorded any data in any of the system tables.
 */
const hasUserCreatedData = async (userId) => {
    // 1. SampleEntry
    const sampleEntryCount = await SampleEntry.count({
        where: {
            [Op.or]: [
                { createdByUserId: userId },
                { lotSelectionByUserId: userId }
            ]
        }
    });
    if (sampleEntryCount > 0) return true;

    // 2. QualityParameters
    const qualityParametersCount = await QualityParameters.count({
        where: { reportedByUserId: userId }
    });
    if (qualityParametersCount > 0) return true;

    // 3. LotAllotment
    const lotAllotmentCount = await LotAllotment.count({
        where: {
            [Op.or]: [
                { allottedByManagerId: userId },
                { allottedToSupervisorId: userId },
                { closedByUserId: userId }
            ]
        }
    });
    if (lotAllotmentCount > 0) return true;

    // 4. PhysicalInspection
    const physicalInspectionCount = await PhysicalInspection.count({
        where: { reportedByUserId: userId }
    });
    if (physicalInspectionCount > 0) return true;

    // 5. InventoryData
    const inventoryDataCount = await InventoryData.count({
        where: { recordedByUserId: userId }
    });
    if (inventoryDataCount > 0) return true;

    // 6. OpeningBalance
    const openingBalanceCount = await OpeningBalance.count({
        where: { createdBy: userId }
    });
    if (openingBalanceCount > 0) return true;

    // 7. OtherHamaliEntry
    const otherHamaliEntryCount = await OtherHamaliEntry.count({
        where: {
            [Op.or]: [
                { addedBy: userId },
                { approvedBy: userId }
            ]
        }
    });
    if (otherHamaliEntryCount > 0) return true;

    // 8. Outturn
    const outturnCount = await Outturn.count({
        where: {
            [Op.or]: [
                { createdBy: userId },
                { clearedBy: userId }
            ]
        }
    });
    if (outturnCount > 0) return true;

    // 9. PaddyHamaliEntry
    const paddyHamaliEntryCount = await PaddyHamaliEntry.count({
        where: {
            [Op.or]: [
                { addedBy: userId },
                { approvedBy: userId }
            ]
        }
    });
    if (paddyHamaliEntryCount > 0) return true;

    // 10. PurchaseRate
    const purchaseRateCount = await PurchaseRate.count({
        where: {
            [Op.or]: [
                { createdBy: userId },
                { updatedBy: userId },
                { adminApprovedBy: userId }
            ]
        }
    });
    if (purchaseRateCount > 0) return true;

    // 11. RiceHamaliEntry
    const riceHamaliEntryCount = await RiceHamaliEntry.count({
        where: { created_by: userId }
    });
    if (riceHamaliEntryCount > 0) return true;

    // 12. RiceProduction
    const riceProductionCount = await RiceProduction.count({
        where: {
            [Op.or]: [
                { createdBy: userId },
                { approvedBy: userId }
            ]
        }
    });
    if (riceProductionCount > 0) return true;

    // 13. RiceStockLocation
    const riceStockLocationCount = await RiceStockLocation.count({
        where: { createdBy: userId }
    });
    if (riceStockLocationCount > 0) return true;

    return false;
};

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
router.get('/users', auth, authorize('admin', 'manager', 'staff'), async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'isActive', 'staffType', 'subRole', 'fullName', 'customUserId', 'qualityName', 'createdAt', 'updatedAt'],
            order: [['role', 'ASC'], ['username', 'ASC']]
        });

        const usersWithDataFlag = await Promise.all(users.map(async (user) => {
            const hasData = await hasUserCreatedData(user.id);
            return {
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive,
                staffType: user.staffType || null,
                subRole: user.subRole || null,
                fullName: user.fullName || null,
                customUserId: user.customUserId || null,
                qualityName: user.qualityName || null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                hasCreatedData: hasData
            };
        }));

        res.json({
            success: true,
            users: usersWithDataFlag
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/admin/physical-supervisors
 * Get all physical supervisors (manager and admin can access)
 */
router.get('/physical-supervisors', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const supervisors = await User.findAll({
            where: {
                role: 'physical_supervisor',
                isActive: true
            },
            attributes: ['id', 'username'],
            order: [['username', 'ASC']]
        });

        res.json({
            success: true,
            users: supervisors.map(user => ({
                id: user.id,
                username: user.username,
                fullName: user.fullName || user.username
            }))
        });
    } catch (error) {
        console.error('Get physical supervisors error:', error);
        res.status(500).json({ error: 'Failed to fetch physical supervisors' });
    }
});

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
router.post('/users', auth, authorize('admin'), async (req, res) => {
    try {
        const { username, password, role, staffType, subRole, fullName, customUserId, qualityName } = req.body;
        const normalizeName = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
        const normalizedRole = String(role || '').trim().toLowerCase();
        const isSupervisorRole = normalizedRole === 'staff' || normalizedRole === 'paddy_supervisor';

        // Validation
        if (!username || !password || !normalizedRole) {
            return res.status(400).json({ error: 'Username, password, and role are required' });
        }

        if (!fullName || !String(fullName).trim()) {
            return res.status(400).json({ error: 'Full Name is required' });
        }

        const validRoles = ['staff', 'manager', 'admin', 'inventory_staff', 'financial_account', 'paddy_supervisor', 'ceo'];
        if (!validRoles.includes(normalizedRole)) {
            console.warn(`⚠️ Admin ${req.user.username} tried to create user with invalid role: ${role}`);
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Limit Admin and Manager roles to maximum of 2 users
        if (normalizedRole === 'admin' || normalizedRole === 'manager') {
            const roleCount = await User.count({ where: { role: normalizedRole } });
            if (roleCount >= 2) {
                return res.status(400).json({ error: `Cannot create more than 2 users with the ${normalizedRole === 'admin' ? 'Admin' : 'Manager'} role` });
            }
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        const normalizedUsername = String(username || '').trim().toLowerCase();
        const storedUsername = String(username || '').trim();
        if (!storedUsername) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Check if username already exists
        const existingUser = await User.findOne({
            where: sqlWhere(
                fn('LOWER', col('username')),
                normalizedUsername
            )
        });

        // Check if full name already exists using normalized comparison in JS.
        // This avoids brittle DB-specific regexp function behavior on create.
        let existingFullName = null;
        if (fullName && fullName.trim() !== '') {
            const normalizedFullName = normalizeName(fullName);
            const sameNameCandidates = await User.findAll({
                attributes: ['id', 'fullName'],
                where: {
                    fullName: { [Op.not]: null }
                }
            });
            existingFullName = sameNameCandidates.find(user => normalizeName(user.fullName) === normalizedFullName) || null;
        }

        const duplicateErrors = [];
        if (existingUser) duplicateErrors.push('User ID already exists');
        if (existingFullName) duplicateErrors.push('Full name already exists');
        if (duplicateErrors.length > 0) {
            return res.status(400).json({ error: duplicateErrors.join(' & ') });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await User.create({
            username: storedUsername,
            password: hashedPassword,
            role: normalizedRole,
            fullName: fullName || null,
            customUserId: customUserId || null,
            isActive: true,
            staffType: isSupervisorRole ? (staffType || 'mill') : null,
            subRole: (normalizedRole === 'financial_account' || normalizedRole === 'inventory_staff') ? (subRole || 'staff') : null,
            qualityName: isSupervisorRole ? (qualityName || null) : null
        });

        console.log(`✅ Admin ${req.user.username} created new user: ${newUser.username} (${normalizedRole})`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                fullName: newUser.fullName,
                customUserId: newUser.customUserId,
                role: newUser.role,
                isActive: newUser.isActive,
                staffType: newUser.staffType,
                subRole: newUser.subRole,
                qualityName: newUser.qualityName
            }
        });
    } catch (error) {
        console.error('❌ Create user error:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            errors: error.errors?.map(e => e.message)
        });
        res.status(500).json({ error: error.message || 'Failed to create user' });
    }
});

/**
 * PUT /api/admin/users/:id/credentials
 * Update username and/or password for a user (admin only)
 * Does NOT require last password - admin privilege
 */
router.put('/users/:id/credentials', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, fullName, customUserId, staffType, subRole, qualityName } = req.body;
        const normalizeName = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();

        const isSelf = String(req.user.userId) === String(id);
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ error: 'Access denied. You can only update your own password.' });
        }

        // Find user
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare update object
        const updates = {};

        // Non-admin can only update their own password
        if (!isAdmin) {
            if (password && password.trim() !== '') {
                if (password.length < 4) {
                    return res.status(400).json({ error: 'Password must be at least 4 characters' });
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                updates.password = hashedPassword;
            } else {
                return res.status(400).json({ error: 'New password is required' });
            }
        } else {
            // Admin can update all fields
            // Update username if provided
            if (username !== undefined && username !== null) {
                const normalizedUsername = String(username).trim().toLowerCase();
                const storedUsername = String(username).trim();
                if (!storedUsername) {
                    return res.status(400).json({ error: 'Username is required' });
                }
                if (storedUsername !== String(user.username || '')) {
                    // Check if username already exists (for different user)
                    const existingUser = await User.findOne({
                        where: {
                            [Op.and]: [
                                sqlWhere(
                                    fn('LOWER', col('username')),
                                    normalizedUsername
                                ),
                                { id: { [Op.ne]: id } }
                            ]
                        }
                    });

                    if (existingUser) {
                        return res.status(400).json({ error: 'User ID already exists' });
                    }

                    updates.username = storedUsername;
                }
            }

            // Update password if provided
            if (password && password.trim() !== '') {
                if (password.length < 4) {
                    return res.status(400).json({ error: 'Password must be at least 4 characters' });
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                updates.password = hashedPassword;
            }

            // Update other fields
            if (fullName !== undefined) {
                if (!String(fullName).trim()) {
                    return res.status(400).json({ error: 'Full Name is required' });
                }
                if (fullName && fullName.trim() !== '' && fullName !== user.fullName) {
                    const normalizedFullName = normalizeName(fullName);
                    const existingFullName = await User.findOne({
                        where: {
                            [Op.and]: [
                                sqlWhere(
                                    fn('LOWER', fn('REGEXP_REPLACE', fn('COALESCE', col('full_name'), ''), '\\s+', ' ', 'g')),
                                    normalizedFullName
                                ),
                                { id: { [Op.ne]: id } }
                            ]
                        }
                    });
                    if (existingFullName) {
                        return res.status(400).json({ error: 'Full name already exists' });
                    }
                }
                updates.fullName = fullName;
            }
            if (customUserId !== undefined) updates.customUserId = customUserId;
            if (staffType !== undefined) updates.staffType = staffType;
            if (subRole !== undefined) updates.subRole = subRole;
            if (qualityName !== undefined) updates.qualityName = qualityName;
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
            await user.update(updates);
        }

        console.log(`✅ ${isAdmin ? 'Admin' : 'User'} ${req.user.username} updated credentials for user: ${user.username} (ID: ${id})`);

        res.json({
            success: true,
            message: 'User credentials updated successfully',
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                customUserId: user.customUserId,
                role: user.role,
                isActive: user.isActive,
                staffType: user.staffType,
                subRole: user.subRole
            }
        });
    } catch (error) {
        console.error('Update credentials error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * PUT /api/admin/users/:id/status
 * Activate or deactivate a user (admin only)
 */
router.put('/users/:id/status', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        // Prevent admin from deactivating themselves
        if (parseInt(id) === req.user.userId && isActive === false) {
            return res.status(400).json({ error: 'You cannot deactivate your own account' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.update({ isActive: !!isActive });

        console.log(`✅ Admin ${req.user.username} ${isActive ? 'activated' : 'deactivated'} user: ${user.username} (ID: ${id})`);

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

/**
 * PUT /api/admin/users/:id/role
 * Change user role (admin only)
 */
router.put('/users/:id/role', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role, staffType, subRole } = req.body;
        const normalizedRole = String(role || '').trim().toLowerCase();
        const isSupervisorRole = normalizedRole === 'staff' || normalizedRole === 'paddy_supervisor';

        // Prevent admin from changing their own role
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({ error: 'You cannot change your own role' });
        }

        const validRoles = ['staff', 'manager', 'admin', 'quality_supervisor', 'physical_supervisor', 'inventory_staff', 'financial_account', 'paddy_supervisor', 'ceo'];
        if (!validRoles.includes(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: staff, paddy_supervisor, manager, admin, quality_supervisor, physical_supervisor, inventory_staff, financial_account, ceo' });
        }

        // Limit Admin and Manager roles to maximum of 2 users
        if (normalizedRole === 'admin' || normalizedRole === 'manager') {
            const roleCount = await User.count({
                where: {
                    role: normalizedRole,
                    id: { [Op.ne]: id }
                }
            });
            if (roleCount >= 2) {
                return res.status(400).json({ error: `Cannot update role. There are already 2 users with the ${normalizedRole === 'admin' ? 'Admin' : 'Manager'} role` });
            }
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updateData = { role: normalizedRole };
        // Update staffType if provided (mill or location) for supervisor roles
        if (isSupervisorRole && staffType) {
            updateData.staffType = staffType;
        } else if (!isSupervisorRole) {
            // Clear staff-specific fields when changing away from staff
            updateData.staffType = null;
            updateData.qualityName = null;
        }

        // Update subRole if role is financial_account or inventory_staff
        if (normalizedRole === 'financial_account' || normalizedRole === 'inventory_staff') {
            updateData.subRole = subRole || 'staff';
        } else {
            updateData.subRole = null;
        }

        await user.update(updateData);

        console.log(`✅ Admin ${req.user.username} changed role for user: ${user.username} to ${normalizedRole}${staffType ? ` (staffType: ${staffType})` : ''}${subRole ? ` (subRole: ${subRole})` : ''}`);

        res.json({
            success: true,
            message: 'User role updated successfully',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                staffType: user.staffType,
                subRole: user.subRole,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user permanently (admin only)
 */
router.delete('/users/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const deletedUsername = user.username;

        // Check if the user has created any data
        const hasData = await hasUserCreatedData(id);
        if (hasData) {
            return res.status(400).json({ error: 'Cannot delete user who has recorded data in the system' });
        }

        // Physically delete user if no data is associated
        await user.destroy();

        console.log(`✅ Admin ${req.user.username} permanently deleted user: ${deletedUsername} (ID: ${id})`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
