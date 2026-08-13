/**
 * SampleEntryOffering Model
 * 
 * Stores detailed offer price and final price data per sample entry.
 * Used in Lots Passed tab for Admin and Manager pricing workflow.
 * 
 * Offering Price Flow:
 *   Admin sets: offerRate, sute (per_kg/per_ton), baseRateType (PD_LOOSE/PD_WB/MD_WB/MD_LOOSE),
 *               baseRateUnit (per_bag/per_quintal), offerBaseRateValue,
 *               hamaliEnabled, brokerageEnabled
 *   When hamali=yes: hamaliPerKg, hamaliPerQuintal, moistureValue, brokerage, lf, egb
 *   When MD_LOOSE: customDivisor shown
 *   When PD_WB or MD_WB: egb hidden
 * 
 * Final Price Flow:
 *   Auto-fetches sute and base rate from offering
 *   Admin sets: hamaliEnabled (yes/no), brokerageEnabled (yes/no)
 *   Manager fills: hamali, brokerage, lf values
 *   LF: manager only
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SampleEntryOffering = sequelize.define('SampleEntryOffering', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sampleEntryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'sample_entry_id',
        references: {
            model: 'sample_entries',
            key: 'id'
        }
    },
    // === OFFERING PRICE FIELDS ===
    offerRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'offer_rate'
    },
    sute: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    suteUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_kg',
        field: 'sute_unit'
    },
    baseRateType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'base_rate_type'
    },
    suteEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
        field: 'sute_enabled'
    },
    baseRateUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'base_rate_unit'
    },
    offerBaseRateValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'offer_base_rate_value'
    },
    // === HAMALI FIELDS ===
    hamali: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    hamaliUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'hamali_unit'
    },
    hamaliBy: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'admin',
        field: 'hamali_by'
    },
    hamaliEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'hamali_enabled'
    },
    hamaliPerKg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'hamali_per_kg'
    },
    hamaliPerQuintal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'hamali_per_quintal'
    },
    moistureValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'moisture_value'
    },
    moistureEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
        field: 'moisture_enabled'
    },
    // === BROKERAGE FIELDS ===
    brokerage: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    brokerageUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'brokerage_unit'
    },
    brokerageBy: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'admin',
        field: 'brokerage_by'
    },
    brokerageEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'brokerage_enabled'
    },
    // === LF FIELDS ===
    lf: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    lfUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'lf_unit'
    },
    lfEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'lf_enabled'
    },
    lfBy: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'manager',
        field: 'lf_by'
    },
    // === EGB FIELDS ===
    egbType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'mill',
        field: 'egb_type'
    },
    egbValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'egb_value'
    },
    // === CUSTOM DIVISOR (MD/Loose only) ===
    customDivisor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'custom_divisor'
    },
    offerVersions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        field: 'offer_versions'
    },
    disputeVersions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        field: 'dispute_versions'
    },
    activeOfferKey: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'active_offer_key'
    },
    cdEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'cd_enabled'
    },
    cdValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'cd_value'
    },
    cdUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'lumps',
        field: 'cd_unit'
    },
    bankLoanEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'bank_loan_enabled'
    },
    bankLoanValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'bank_loan_value'
    },
    bankLoanUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'lumps',
        field: 'bank_loan_unit'
    },
    paymentConditionValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 15,
        field: 'payment_condition_value'
    },
    paymentConditionUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'days',
        field: 'payment_condition_unit'
    },
    // Informational fields only — saved but NEVER used in any calculation
    marketPrice: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'market_price'
    },
    checkPost: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'check_post'
    },
    marketPriceValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        field: 'market_price_value'
    },
    checkPostValue: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        field: 'check_post_value'
    },
    marketPriceUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'lumps',
        field: 'market_price_unit'
    },
    // === FINAL PRICE FIELDS ===
    finalBaseRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_base_rate'
    },
    finalSute: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_sute'
    },
    finalSuteUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'final_sute_unit'
    },
    finalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_price'
    },
    finalRemarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'final_remarks'
    },
    finalReportedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'final_reported_by'
    },
    finalReportedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'final_reported_at'
    },
    isFinalized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_finalized'
    },
    disputeBaseRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'dispute_base_rate'
    },
    disputeBaseRateType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'dispute_base_rate_type'
    },
    revisedHamali: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'revised_hamali'
    },
    revisedLf: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'revised_lf'
    },
    revisedRateOption: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'final',
        field: 'revised_rate_option'
    },
    pendingManagerValueApprovalStatus: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'pending_manager_value_approval_status'
    },
    pendingManagerValueApprovalData: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'pending_manager_value_approval_data'
    },
    pendingManagerValueApprovalQueue: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'pending_manager_value_approval_queue'
    },
    pendingManagerValueApprovalRequestedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'pending_manager_value_approval_requested_by'
    },
    pendingManagerValueApprovalRequestedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'pending_manager_value_approval_requested_at'
    },
    pendingRateLinkingStatus: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'pending_rate_linking_status'
    },
    pendingRateLinkingData: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'pending_rate_linking_data'
    },
    pendingManagerValueApprovalApprovedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'pending_manager_value_approval_approved_by'
    },
    pendingManagerValueApprovalApprovedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'pending_manager_value_approval_approved_at'
    },
    // === FINAL RATE 2 FIELDS ===
    finalBaseRate2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_base_rate_2'
    },
    finalSute2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_sute_2'
    },
    finalSuteUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'final_sute_unit_2'
    },
    finalPrice2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_price_2'
    },
    hamali2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'hamali_2'
    },
    hamaliUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'hamali_unit_2'
    },
    brokerage2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'brokerage_2'
    },
    brokerageUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'brokerage_unit_2'
    },
    lf2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'lf_2'
    },
    lfUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'lf_unit_2'
    },
    egbValue2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'egb_value_2'
    },
    egbType2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'egb_type_2'
    },
    cdValue2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'cd_value_2'
    },
    cdUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'cd_unit_2'
    },
    bankLoanValue2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'bank_loan_value_2'
    },
    bankLoanUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'bank_loan_unit_2'
    },
    paymentConditionValue2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'payment_condition_value_2'
    },
    paymentConditionUnit2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'payment_condition_unit_2'
    },
    finalRemarks2: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'final_remarks_2'
    },
    isFinalized2: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_finalized_2'
    },
    finalReportedBy2: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'final_reported_by_2'
    },
    finalReportedAt2: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'final_reported_at_2'
    },
    finalBaseRateType2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'final_base_rate_type_2'
    },
    // === FINAL RATE 2 APPROVAL FIELDS (mirrors FR1 manager-value approval, isolated with _2) ===
    pendingManagerValueApprovalStatus2: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'pending_manager_value_approval_status_2'
    },
    pendingManagerValueApprovalData2: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'pending_manager_value_approval_data_2'
    },
    pendingManagerValueApprovalQueue2: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'pending_manager_value_approval_queue_2'
    },
    pendingManagerValueApprovalRequestedBy2: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'pending_manager_value_approval_requested_by_2'
    },
    pendingManagerValueApprovalRequestedAt2: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'pending_manager_value_approval_requested_at_2'
    },
    pendingManagerValueApprovalApprovedBy2: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'pending_manager_value_approval_approved_by_2'
    },
    pendingManagerValueApprovalApprovedAt2: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'pending_manager_value_approval_approved_at_2'
    },
    // === TRACKING ===
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
        references: {
            model: 'users',
            key: 'id'
        }
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'updated_by',
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'sample_entry_offerings',
    underscored: true,
    indexes: [
        { fields: ['sample_entry_id'] },
        { fields: ['is_finalized'] },
        {
            name: 'sample_entry_offerings_dispute_versions_gin',
            using: 'gin',
            fields: ['dispute_versions']
        },
        {
            name: 'sample_entry_offerings_pending_mgr_queue_gin',
            using: 'gin',
            fields: ['pending_manager_value_approval_queue']
        },
        {
            name: 'sample_entry_offerings_pending_mgr_data_gin',
            using: 'gin',
            fields: ['pending_manager_value_approval_data']
        }
    ]
});

// Associations
SampleEntryOffering.associate = (models) => {
    SampleEntryOffering.belongsTo(models.SampleEntry, {
        foreignKey: 'sampleEntryId',
        as: 'sampleEntry'
    });
};

module.exports = SampleEntryOffering;
