const PhysicalInspectionRepository = require('../repositories/PhysicalInspectionRepository');
const AuditService = require('./AuditService');
const WorkflowEngine = require('./WorkflowEngine');
const FileUploadService = require('./FileUploadService');

class PhysicalInspectionService {
  /**
   * Create physical inspection
   * @param {Object} inspectionData - Physical inspection data
   * @param {number} userId - User ID creating the inspection (physical supervisor)
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Created physical inspection
   */
  async createPhysicalInspection(inspectionData, userId, userRole) {
    const { sequelize } = require('../config/database');
    const LotAllotment = require('../models/LotAllotment');

    return await sequelize.transaction(async (t) => {
      if (!inspectionData.sampleEntryId) {
        throw new Error('Sample entry ID is required');
      }

      const SampleEntryRepository = require('../repositories/SampleEntryRepository');

      const entry = await SampleEntryRepository.findById(inspectionData.sampleEntryId, { includeFinancial: true });
      if (!entry) {
        throw new Error('Sample entry not found');
      }

      // Lock the lot allotment for this sample entry during transaction execution to prevent race condition
      const lotAllotmentModel = await LotAllotment.findOne({
        where: { sampleEntryId: inspectionData.sampleEntryId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!lotAllotmentModel) {
        throw new Error('Lot allotment not found for this entry. Please have manager allot a supervisor first.');
      }
      const lotAllotment = lotAllotmentModel.toJSON();

      const existingInspections = await PhysicalInspectionRepository.findBySampleEntryId(
        inspectionData.sampleEntryId,
        { transaction: t }
      );
      const totalAllottedBags = (lotAllotment.allottedBags && lotAllotment.allottedBags > 0) ? lotAllotment.allottedBags : (entry.bags || 0);

      if (!totalAllottedBags || totalAllottedBags <= 0) {
        throw new Error('Invalid bag count. Please contact manager to allot bags first.');
      }

      // If stage is not specified, run legacy flow
      if (!inspectionData.stage) {
        if (!inspectionData.inspectionDate || !inspectionData.lorryNumber ||
          !inspectionData.actualBags || inspectionData.cutting1 === undefined ||
          inspectionData.cutting2 === undefined || inspectionData.bend === undefined) {
          throw new Error('All required fields must be provided');
        }

        const totalInspected = existingInspections.reduce((sum, i) => sum + (i.bags || 0), 0);
        const remainingBags = totalAllottedBags - totalInspected;

        if (inspectionData.actualBags > remainingBags) {
          throw new Error(`Cannot inspect ${inspectionData.actualBags} bags. Only ${remainingBags} bags remaining.`);
        }

        const newInspectionData = {
          sampleEntryId: inspectionData.sampleEntryId,
          lotAllotmentId: lotAllotment.id,
          reportedByUserId: userId,
          inspectionDate: inspectionData.inspectionDate,
          lorryNumber: inspectionData.lorryNumber,
          bags: inspectionData.actualBags,
          cutting1: inspectionData.cutting1,
          cutting2: inspectionData.cutting2,
          bend: inspectionData.bend,
          bend2: inspectionData.bend2,
          remarks: inspectionData.remarks || null,
          isComplete: false
        };

        const newTotalInspected = totalInspected + inspectionData.actualBags;
        if (newTotalInspected >= totalAllottedBags) {
          newInspectionData.isComplete = true;
        }

        const inspection = await PhysicalInspectionRepository.create(newInspectionData, { transaction: t });
        await AuditService.logCreate(userId, 'physical_inspections', inspection.id, inspection);

        const currentStatus = entry.workflowStatus;
        if (currentStatus !== 'PHYSICAL_INSPECTION' && ['LOT_ALLOTMENT', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW'].includes(currentStatus)) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id, reason: 'New progressive lorry added (legacy flow)' }
          );
        } else if (existingInspections.length === 0) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id }
          );
        }
        return inspection;
      }

      // MULTI-STAGE FLOW
      const stage = inspectionData.stage.toLowerCase();
      const isReadyLorry = entry.entryType === 'DIRECT_LOADED_VEHICLE';
      const validStages = isReadyLorry
        ? ['bag_wise_report', 'full_avg', 'return_bags_report']
        : ['lot_avg', 'half_lorry', 'nit_avg', 'full_avg', 'balanced_lot'];
      if (!validStages.includes(stage)) {
        throw new Error('Invalid sampling stage specified');
      }

      let lorryNumberClean = (inspectionData.lorryNumber || '').trim().toUpperCase();
      if (!lorryNumberClean && (stage === 'lot_avg' || stage === 'balanced_lot')) {
        lorryNumberClean = stage === 'lot_avg' ? 'LOT_AVG' : 'BALANCED_LOT';
      }
      if (!lorryNumberClean) {
        throw new Error('Lorry number is required');
      }

      // Check if there is an existing record for this lorry
      let inspection = null;
      let existingLorryInspection = existingInspections.find(
        i => (i.lorryNumber || '').trim().toUpperCase() === lorryNumberClean
      );
      let pendingLotAvgInspectionToRename = null;
      const getInspectionSortTime = (insp) => {
        const stages = insp.samplingStages || {};
        let earliest = null;
        for (const key in stages) {
          const stageValue = stages[key];
          if (stageValue && stageValue.reportedAt) {
            const t = new Date(stageValue.reportedAt).getTime();
            if (!earliest || t < earliest) {
              earliest = t;
            }
          }
        }
        return earliest || (insp.createdAt ? new Date(insp.createdAt).getTime() : null) || (insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null) || (insp.id * 1000) || 9999999999999;
      };

      // If we don't find it under the new lorry number, check if there's a LOT_AVG record that we can rename/resume.
      if (!existingLorryInspection && lorryNumberClean !== 'LOT_AVG') {
        const lotAvgInspection = existingInspections.find(
          i => (i.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG'
        );
        if (lotAvgInspection) {
          const priorRealLorries = existingInspections.filter(i => {
            const lorry = (i.lorryNumber || '').trim().toUpperCase();
            return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
          });
          
          let canResume = false;
          if (priorRealLorries.length === 0) {
            canResume = true;
          } else {
            priorRealLorries.sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
            const lastLorrySortTime = getInspectionSortTime(priorRealLorries[priorRealLorries.length - 1]);
            const lotAvgSortTime = getInspectionSortTime(lotAvgInspection);
            if (lotAvgSortTime >= lastLorrySortTime) {
              canResume = true;
            }
          }

          if (canResume) {
            pendingLotAvgInspectionToRename = lotAvgInspection;
            existingLorryInspection = lotAvgInspection;
          }
        }
      }

      const isFirstRealTrip = () => {
        const priorRealLorries = existingInspections.filter(i => {
          const lorry = (i.lorryNumber || '').trim().toUpperCase();
          return lorry !== lorryNumberClean && lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
        });
        return priorRealLorries.length === 0;
      };

      const isLocationSample = entry.entryType === 'LOCATION_SAMPLE';
      const currentStages = existingLorryInspection?.samplingStages || {};
      const getStageBaseKey = (stageKey, stageObj = {}) => {
        if (stageObj?.baseStage) return stageObj.baseStage;
        return stageKey.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
      };
      const getHoldHistory = (stages, baseStage) => {
        const history = stages?.holdHistory?.[baseStage];
        return Array.isArray(history) ? history : [];
      };
      const getLatestStageForBase = (stages, baseStage) => {
        if (!stages) return null;
        // Collect ALL keys matching this baseStage (including reattempt keys)
        const allKeys = Object.keys(stages).filter(stageKey => {
          if (stageKey === 'holdHistory') return false;
          return getStageBaseKey(stageKey, stages[stageKey]) === baseStage;
        });
        if (allKeys.length === 0) return null;
        allKeys.sort((a, b) => {
          const timeA = new Date(stages[a]?.reportedAt || stages[a]?.holdAt || stages[a]?.createdAt || 0).getTime();
          const timeB = new Date(stages[b]?.reportedAt || stages[b]?.holdAt || stages[b]?.createdAt || 0).getTime();
          return timeB - timeA;
        });
        // Return the latest one that is NOT on hold (prefer pending/approved over hold)
        for (const key of allKeys) {
          if (stages[key]?.approvalStatus !== 'hold') return stages[key];
        }
        // If all are hold, return the latest
        return stages[allKeys[0]];
      };
      const hasStage = (stages, key) => {
        if (key === 'nit_avg') {
          return Object.keys(stages || {}).some(stageKey => stageKey === 'nit_avg' || stageKey.startsWith('nit_avg_'));
        }
        return !!getLatestStageForBase(stages, key);
      };
      const isStageApproved = (stages, key) => {
        if (key === 'nit_avg') {
          return Object.keys(stages || {}).some(stageKey => {
            return (stageKey === 'nit_avg' || stageKey.startsWith('nit_avg_')) && stages[stageKey]?.approvalStatus === 'approved';
          });
        }
        return Object.keys(stages || {}).some(stageKey => {
          if (stageKey === 'holdHistory') return false;
          const base = getStageBaseKey(stageKey, stages[stageKey]);
          return base === key && stages[stageKey]?.approvalStatus === 'approved';
        });
      };

      const variety = entry?.variety || '';
      const baseRateType = entry?.offering?.baseRateType || '';
      const finalBaseRateType = entry?.offering?.finalBaseRateType || '';
      const checkWb = (str) => {
        const cleaned = String(str || '').replace(/[\s_/]+/g, '').toLowerCase();
        return cleaned === 'pdwb' || cleaned === 'mdwb' || cleaned === 'pdloose' || cleaned === 'mdloose';
      };
      const isMillSample = ['CREATE_NEW', 'READY_LORRY', 'DIRECT_LOADED_VEHICLE', 'NEW_PADDY_SAMPLE'].includes(entry?.entryType);
      const isWbVariety = checkWb(variety) || checkWb(baseRateType) || checkWb(finalBaseRateType) || isLocationSample || isMillSample;
      // If it is the first trip, update the LotAllotment mode if specified
      if (isFirstRealTrip() && inspectionData.samplingRulesMode) {
        const cleanMode = String(inspectionData.samplingRulesMode).toLowerCase() === 'new' ? 'new' : 'old';
        if (lotAllotment.samplingRulesMode !== cleanMode) {
          await lotAllotmentModel.update({ samplingRulesMode: cleanMode }, { transaction: t });
          lotAllotment.samplingRulesMode = cleanMode;
        }
      }

      const activeRulesMode = isWbVariety ? 'old' : (lotAllotment.samplingRulesMode || 'old');
      const isNewMode = activeRulesMode === 'new';
      const isLoose = (baseRateType === 'PD_LOOSE' || baseRateType === 'MD_LOOSE' || finalBaseRateType === 'PD_LOOSE' || finalBaseRateType === 'MD_LOOSE');

      const isLotAvgRequired = () => {
        const priorRealLorries = existingInspections.filter(i => {
          const lorry = (i.lorryNumber || '').trim().toUpperCase();
          return lorry !== lorryNumberClean && lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
        });

        if (priorRealLorries.length === 0) {
          return true;
        }

        priorRealLorries.sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
        const lastLorry = priorRealLorries[priorRealLorries.length - 1];

        // Midnight check for New Crop
        if ((isNewMode || isLoose) && lastLorry && lastLorry.inspectionDate) {
          const currentInspectionDate = inspectionData.inspectionDate || new Date().toISOString().split('T')[0];
          // Compare dates formatted as YYYY-MM-DD
          const getFormattedDateOnly = (d) => {
            if (!d) return '';
            try {
              const dateObj = new Date(d);
              if (isNaN(dateObj.getTime())) return '';
              return dateObj.toISOString().split('T')[0];
            } catch (e) {
              return '';
            }
          };
          const currentDateStr = getFormattedDateOnly(currentInspectionDate);
          const lastLorryDateStr = getFormattedDateOnly(lastLorry.inspectionDate);
          if (currentDateStr && lastLorryDateStr && currentDateStr !== lastLorryDateStr) {
            return true;
          }
        }

        if (isNewMode || isLoose) {
          return false;
        }

        const currentInspectionDate = inspectionData.inspectionDate || new Date().toISOString().split('T')[0];
        const getFormattedDateOnly = (d) => {
          if (!d) return '';
          try {
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '';
            return dateObj.toISOString().split('T')[0];
          } catch (e) {
            return '';
          }
        };
        const currentDateStr = getFormattedDateOnly(currentInspectionDate);
        const lastLorryDateStr = getFormattedDateOnly(lastLorry.inspectionDate);

        if (currentDateStr && lastLorryDateStr && currentDateStr === lastLorryDateStr) {
          return false;
        }

        const stages = lastLorry?.samplingStages || {};
        const isPreviousBalanced = Object.keys(stages).some(key => {
          const baseKey = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
          if (baseKey === 'balanced_lot') {
            const stg = stages[key];
            return stg && (stg.approvalStatus === 'approved' || stg.approvalStatus === 'skipped' || !!stg.isSkipped);
          }
          return false;
        });

        return !isPreviousBalanced;
      };

      if (isNewMode && stage === 'nit_avg') {
        throw new Error('Nit Avg sampling stage is not permitted for New Crop.');
      }

      // Enforce blockers: If any previous lot_avg or balanced_lot is pending, reject new requests (applies to both modes)
      const hasPendingLotAvg = existingInspections.some(insp => {
        const stages = insp.samplingStages || {};
        return Object.keys(stages).some(key => {
          const base = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
          return base === 'lot_avg' && stages[key]?.approvalStatus === 'pending';
        });
      });
      const hasPendingBalancedLot = existingInspections.some(insp => {
        const stages = insp.samplingStages || {};
        return Object.keys(stages).some(key => {
          const base = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
          return base === 'balanced_lot' && stages[key]?.approvalStatus === 'pending';
        });
      });

      if (stage !== 'lot_avg' && hasPendingLotAvg) {
        throw new Error('Cannot add new stages/trips while Lot Avg is pending approval.');
      }
      if (stage !== 'balanced_lot' && hasPendingBalancedLot) {
        throw new Error('Cannot add new stages/trips while Balanced Lot is pending approval.');
      }

      // Check if there is an active hold on any stage (applies to both Old and New Crop)
      let activeHoldStage = null;
      Object.keys(currentStages).forEach(key => {
        if (key === 'holdHistory') return;
        const stg = currentStages[key];
        if (stg?.approvalStatus === 'hold') {
          const baseKey = getStageBaseKey(key, stg);
          if (!isStageApproved(currentStages, baseKey)) {
            activeHoldStage = baseKey;
          }
        }
      });

      if (activeHoldStage) {
        // If the date has changed (next day) and balanced_lot is on hold, allow lot_avg
        if (activeHoldStage === 'balanced_lot') {
          const stgKey = Object.keys(currentStages).find(key => getStageBaseKey(key, currentStages[key]) === 'balanced_lot' && currentStages[key]?.approvalStatus === 'hold');
          const stg = stgKey ? currentStages[stgKey] : null;
          const holdDate = stg?.holdAt ? new Date(stg.holdAt) : null;
          if (holdDate) {
            const today = new Date();
            const isNextDay = (today.getFullYear() > holdDate.getFullYear()) ||
                              (today.getFullYear() === holdDate.getFullYear() && today.getMonth() > holdDate.getMonth()) ||
                              (today.getFullYear() === holdDate.getFullYear() && today.getMonth() === holdDate.getMonth() && today.getDate() > holdDate.getDate());
            if (isNextDay && stage === 'lot_avg') {
              activeHoldStage = null;
            }
          }
        }

        if (activeHoldStage && stage !== activeHoldStage) {
          throw new Error(`Cannot add new stages/trips while ${activeHoldStage.replace('_', ' ').toUpperCase()} is on hold.`);
        }
      }

      if (stage !== 'lot_avg' && stage !== 'balanced_lot' && (lorryNumberClean === 'LOT_AVG' || lorryNumberClean === 'BALANCED_LOT')) {
        throw new Error('Please enter a valid lorry number');
      }

      if (stage === 'lot_avg' && lorryNumberClean === 'LOT_AVG' && !isLotAvgRequired()) {
        throw new Error('Lot Avg Sampling is allowed only before the first lorry load. Continue the next trip with Nit Avg or Half Lorry, or add Balanced Lot for the previous trip.');
      }

      if (isStageApproved(currentStages, 'full_avg') && ['lot_avg', 'nit_avg', 'half_lorry', 'full_avg'].includes(stage)) {
        throw new Error('This lorry trip is closed because Full Avg Lorry is already approved.');
      }

      if (stage === 'lot_avg' && isLocationSample && isFirstRealTrip() && !hasStage(currentStages, 'lot_avg') && (hasStage(currentStages, 'nit_avg') || hasStage(currentStages, 'half_lorry'))) {
        throw new Error('Lot Avg cannot be added after Nit Avg or Half Lorry has started for this location sample trip.');
      }

      if (stage !== 'lot_avg' && stage !== 'balanced_lot') {
        const requiresLotAvgFirst = isLotAvgRequired() && !(isLocationSample && isFirstRealTrip() && !isNewMode);
        if (requiresLotAvgFirst) {
          if (!isStageApproved(currentStages, 'lot_avg')) {
            throw new Error('This trip must start with approved Lot Avg Sampling first.');
          }
        }
      }

      if (stage === 'full_avg') {
        if (!isNewMode && !isLoose) {
          if (!isStageApproved(currentStages, 'half_lorry') && !isStageApproved(currentStages, 'nit_avg')) {
            throw new Error('Cannot add Full Avg Lorry until Half Lorry or Nit Avg is approved by Manager.');
          }
        }
      }

      const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';
      const requireValue = (value, label) => {
        if (!hasValue(value)) {
          throw new Error(`${label} is required`);
        }
      };
      const isTruthyFlag = value => value === true || value === 'true' || value === 'Y' || value === 'Yes';
      const isFalseyFlag = value => value === false || value === 'false' || value === 'N' || value === 'No';

      const isSkipped = isTruthyFlag(inspectionData.isSkipped);

      if (isReadyLorry) {
        if (!isSkipped) {
          if (stage === 'bag_wise_report') {
            requireValue(inspectionData.totalUnloadedBags, 'Total Unloaded Bags');
            if (Number(inspectionData.totalUnloadedBags) <= 0) {
              throw new Error('Total Unloaded Bags must be greater than 0');
            }
            if (!inspectionData.disputeRows || !Array.isArray(inspectionData.disputeRows) || inspectionData.disputeRows.length === 0) {
              throw new Error('Dispute Report rows are required');
            }
            const sumBags = inspectionData.disputeRows.reduce((sum, r) => sum + Number(r.bags || 0), 0);
            if (sumBags !== Number(inspectionData.totalUnloadedBags)) {
              throw new Error(`Total bags in dispute reports (${sumBags}) must equal Total Unloaded Bags (${inspectionData.totalUnloadedBags})`);
            }
          } else if (stage === 'return_bags_report') {
            requireValue(inspectionData.returnBags, 'Return Bags');
            requireValue(inspectionData.vehicleNo, 'Vehicle No');
            if (String(inspectionData.vehicleNo).length !== 10) {
              throw new Error('Vehicle No must be exactly 10 characters long');
            }
            requireValue(inspectionData.finalUnloadedBags, 'Final Unloaded Bags');
          }
        }
      } else {
        if (!isSkipped) {
          // Required fields for BOTH Old and New mode
          requireValue(inspectionData.moisture, 'Moisture');
          requireValue(inspectionData.smellHas, 'Smell Yes/No');

          if (!isTruthyFlag(inspectionData.smellHas) && !isFalseyFlag(inspectionData.smellHas)) {
            throw new Error('Smell Yes/No is invalid');
          }
          if (isTruthyFlag(inspectionData.smellHas)) {
            requireValue(inspectionData.smellType, 'Smell type');
          }
          if (isTruthyFlag(inspectionData.dryMoistureRaw) || (Number(inspectionData.dryMoisture) > 0 && !hasValue(inspectionData.dryMoistureRaw))) {
            requireValue(inspectionData.dryMoisture, 'Dry Moisture value');
          }

          const paddyColorEnabled = inspectionData.paddyColorEnabled ?? false;
          if (!isTruthyFlag(paddyColorEnabled) && !isFalseyFlag(paddyColorEnabled)) {
            throw new Error('Paddy Discolor Yes/No is invalid');
          }
          if (isTruthyFlag(paddyColorEnabled)) {
            requireValue(inspectionData.paddyColor, 'Paddy discolor type');
            if (!['Normal Color', 'Light Discolor', 'Medium Discolor', 'Dark Discolor'].includes(inspectionData.paddyColor)) {
              throw new Error('Paddy discolor type is invalid');
            }
          }

          const kadiga = inspectionData.kadiga || 'N';
          if (!isTruthyFlag(kadiga) && !isFalseyFlag(kadiga)) {
            throw new Error('Kadiga Yes/No is invalid');
          }

          // Fields required ONLY in Old mode
          if (!isNewMode) {
            requireValue(inspectionData.grainsCount, 'Grains');
            requireValue(inspectionData.cutting1, 'Cutting');
            requireValue(inspectionData.bend1, 'Bend');
            requireValue(inspectionData.mix, 'Mix');
            requireValue(inspectionData.kandu, 'Kandu');
            requireValue(inspectionData.oil, 'Oil');
            requireValue(inspectionData.sk, 'SK');
            requireValue(inspectionData.paddyWbEnabled, 'Paddy WB Yes/No');

            if (isTruthyFlag(inspectionData.smixEnabled)) {
              requireValue(inspectionData.mixS, 'S Mix value');
            }
            if (isTruthyFlag(inspectionData.lmixEnabled)) {
              requireValue(inspectionData.mixL, 'L Mix value');
            }
            if (!isTruthyFlag(inspectionData.paddyWbEnabled) && !isFalseyFlag(inspectionData.paddyWbEnabled)) {
              throw new Error('Paddy WB Yes/No is invalid');
            }
            if (isTruthyFlag(inspectionData.paddyWbEnabled)) {
              requireValue(inspectionData.paddyWb, 'Paddy WB value');
            }
          }
        }
      }

      if (pendingLotAvgInspectionToRename) {
        const PhysicalInspection = require('../models/PhysicalInspection');
        const dbInspection = await PhysicalInspection.findByPk(pendingLotAvgInspectionToRename.id, { transaction: t });
        if (dbInspection) {
          await dbInspection.update({ lorryNumber: lorryNumberClean }, { transaction: t });
          pendingLotAvgInspectionToRename.lorryNumber = lorryNumberClean;
        }
      }

      let stageData = {};
      if (isReadyLorry && (stage === 'bag_wise_report' || stage === 'return_bags_report')) {
        stageData = {
          inspectionDate: inspectionData.inspectionDate || new Date().toISOString().split('T')[0],
          reportedBy: inspectionData.reportedBy || 'System',
          reportedAt: new Date().toISOString(),
          isSkipped: isSkipped,
          approvalStatus: isSkipped ? 'approved' : 'pending',
          approvedBy: isSkipped ? (inspectionData.reportedBy || 'System') : null,
          approvedAt: isSkipped ? new Date().toISOString() : null
        };
        if (stage === 'bag_wise_report') {
          stageData.totalUnloadedBags = inspectionData.totalUnloadedBags;
          stageData.disputeRows = inspectionData.disputeRows;
        } else if (stage === 'return_bags_report') {
          stageData.returnBags = inspectionData.returnBags;
          stageData.vehicleNo = inspectionData.vehicleNo;
          stageData.finalUnloadedBags = inspectionData.finalUnloadedBags;
        }
      } else {
        stageData = {
          inspectionDate: inspectionData.inspectionDate || new Date().toISOString().split('T')[0],
          moisture: !isSkipped && inspectionData.moisture !== undefined ? Number(inspectionData.moisture) : null,
          moistureRaw: !isSkipped ? (inspectionData.moistureRaw || null) : null,
          dryMoisture: !isSkipped && inspectionData.dryMoisture !== undefined ? Number(inspectionData.dryMoisture) : null,
          dryMoistureRaw: !isSkipped ? (inspectionData.dryMoistureRaw || null) : null,
          grainsCount: !isSkipped && inspectionData.grainsCount !== undefined ? Number(inspectionData.grainsCount) : null,
          grainsCountRaw: !isSkipped ? (inspectionData.grainsCountRaw || null) : null,
          cutting1: !isSkipped && inspectionData.cutting1 !== undefined ? Number(inspectionData.cutting1) : null,
          cutting2: !isSkipped && inspectionData.cutting2 !== undefined ? Number(inspectionData.cutting2) : null,
          bend1: !isSkipped && inspectionData.bend1 !== undefined ? Number(inspectionData.bend1) : null,
          bend2: !isSkipped && inspectionData.bend2 !== undefined ? Number(inspectionData.bend2) : null,
          mix: !isSkipped ? (inspectionData.mix || null) : null,
          mixRaw: !isSkipped ? (inspectionData.mixRaw || null) : null,
          smixEnabled: !isSkipped && (inspectionData.smixEnabled === 'true' || inspectionData.smixEnabled === true),
          mixS: !isSkipped ? (inspectionData.mixS || null) : null,
          mixSRaw: !isSkipped ? (inspectionData.mixSRaw || null) : null,
          lmixEnabled: !isSkipped && (inspectionData.lmixEnabled === 'true' || inspectionData.lmixEnabled === true),
          mixL: !isSkipped ? (inspectionData.mixL || null) : null,
          mixLRaw: !isSkipped ? (inspectionData.mixLRaw || null) : null,
          sk: !isSkipped ? (inspectionData.sk || null) : null,
          skRaw: !isSkipped ? (inspectionData.skRaw || null) : null,
          kandu: !isSkipped ? (inspectionData.kandu || null) : null,
          kanduRaw: !isSkipped ? (inspectionData.kanduRaw || null) : null,
          oil: !isSkipped ? (inspectionData.oil || null) : null,
          oilRaw: !isSkipped ? (inspectionData.oilRaw || null) : null,
          smellHas: !isSkipped && (inspectionData.smellHas === 'true' || inspectionData.smellHas === true),
          smellType: !isSkipped ? (inspectionData.smellType || null) : null,
          paddyWbEnabled: !isSkipped && (inspectionData.paddyWbEnabled === 'true' || inspectionData.paddyWbEnabled === true),
          paddyWb: !isSkipped && inspectionData.paddyWb !== undefined ? Number(inspectionData.paddyWb) : null,
          paddyWbRaw: !isSkipped ? (inspectionData.paddyWbRaw || null) : null,
          paddyColorEnabled: !isSkipped && isTruthyFlag(inspectionData.paddyColorEnabled ?? false),
          paddyColor: !isSkipped && isTruthyFlag(inspectionData.paddyColorEnabled ?? false) ? (inspectionData.paddyColor || null) : null,
          kadiga: isSkipped ? null : (isTruthyFlag(inspectionData.kadiga || 'N') ? 'Y' : 'N'),
          nit: inspectionData.nit || null,
          isSkipped: isSkipped,
          reportedBy: inspectionData.reportedBy || 'System',
          reportedAt: new Date().toISOString(),
          imageUrl: null,
          approvalStatus: isSkipped ? 'approved' : 'pending',
          approvedBy: isSkipped ? (inspectionData.reportedBy || 'System') : null,
          approvedAt: isSkipped ? new Date().toISOString() : null
        };
      }

      if (!existingLorryInspection) {
        let bagsVal = null;
        let completeVal = false;
        if (stage === 'balanced_lot') {
          throw new Error('Full Avg Lorry must be submitted on the lorry trip before adding Balanced Lot.');
        } else if (stage === 'full_avg') {
          bagsVal = Number.parseInt(inspectionData.actualBags || '0');
          stageData.actualBags = bagsVal;
        } else if (isReadyLorry && stage === 'bag_wise_report') {
          bagsVal = Number.parseInt(inspectionData.totalUnloadedBags || '0');
          stageData.actualBags = bagsVal;
        }
        const newInspectionData = {
          sampleEntryId: inspectionData.sampleEntryId,
          lotAllotmentId: lotAllotment.id,
          reportedByUserId: userId,
          inspectionDate: inspectionData.inspectionDate || new Date().toISOString().split('T')[0],
          lorryNumber: lorryNumberClean,
          bags: bagsVal,
          cutting1: stageData.cutting1 || 0,
          cutting2: stageData.cutting2 || 0,
          bend: stageData.bend1 || 0,
          bend2: stageData.bend2 || 0,
          remarks: inspectionData.remarks || null,
          isComplete: completeVal,
          samplingStages: {
            [stage]: stageData
          }
        };

        inspection = await PhysicalInspectionRepository.create(newInspectionData, { transaction: t });
        await AuditService.logCreate(userId, 'physical_inspections', inspection.id, inspection);

        const currentStatus = entry.workflowStatus;
        if (currentStatus !== 'PHYSICAL_INSPECTION' && ['LOT_ALLOTMENT', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW'].includes(currentStatus)) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id, reason: 'New progressive lorry added' }
          );
        } else if (existingInspections.length === 0) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id }
          );
        }
      } else {
        // Load existing record
        const currentInspection = await PhysicalInspectionRepository.findById(existingLorryInspection.id, { transaction: t });
        const stages = currentInspection.samplingStages || {};
        
        const existingCurrentStage = stages[stage];
        const isRetryingHeldStage = existingCurrentStage?.approvalStatus === 'hold';
        if (existingCurrentStage && stage !== 'nit_avg' && !isRetryingHeldStage) {
          throw new Error(`Sampling stage '${inspectionData.stage}' has already been submitted and is locked.`);
        }

        const updates = {};

        if (isReadyLorry) {
          if (stage === 'full_avg') {
            let actualBags = Number.parseInt(inspectionData.actualBags || '0');
            if (!actualBags || actualBags <= 0) {
              throw new Error('Please enter valid actual bags for Full Avg Lorry');
            }
            stageData.actualBags = actualBags;
            updates.bags = actualBags;
            updates.cutting1 = stageData.cutting1 || 0;
            updates.cutting2 = stageData.cutting2 || 0;
            updates.bend = stageData.bend1 || 0;
            updates.bend2 = stageData.bend2 || 0;
          } else if (stage === 'return_bags_report') {
            updates.bags = Number.parseInt(inspectionData.finalUnloadedBags || '0');
            updates.isComplete = true; // Mark inspection trip as complete on return bags stage
          }
          updates.remarks = inspectionData.remarks || null;
        } else if (stage === 'full_avg' || stage === 'balanced_lot') {
          const otherTripsBags = existingInspections
            .filter(i => i.id !== currentInspection.id)
            .reduce((sum, i) => sum + (i.bags || 0), 0);

          const fullAvgStageObj = getLatestStageForBase(stages, 'full_avg');
          const currentTripFullAvgBags = Number.parseInt(fullAvgStageObj?.actualBags || currentInspection.bags || '0');

          if (stage === 'balanced_lot') {
            const isLoose = ['PD_LOOSE', 'MD_LOOSE'].includes(entry.entryType) || 
                            ['PD_LOOSE', 'MD_LOOSE'].includes(entry.offering?.baseRateType) ||
                            ['PD_LOOSE', 'MD_LOOSE'].includes(entry.offering?.finalBaseRateType);
            const isNewCrop = entry.samplingRulesMode === 'new' && !['WB', 'WHITE_BROKEN', 'WHITE BROKEN'].includes(String(entry.variety || '').toUpperCase());
            const progressInspected = otherTripsBags;
            const isMaxReached = isLoose && isNewCrop && totalAllottedBags > 0 && progressInspected >= totalAllottedBags;

            if (!isMaxReached) {
              if (!fullAvgStageObj) {
                throw new Error('Full Avg Lorry must be submitted on the lorry trip before adding Balanced Lot.');
              }
              if (fullAvgStageObj.approvalStatus === 'hold') {
                throw new Error('Cannot add Balanced Lot while Full Avg Lorry is on Hold.');
              }
            }
            if (fullAvgStageObj && fullAvgStageObj.reportedAt) {
              const fullAvgDate = new Date(fullAvgStageObj.reportedAt);
              const today = new Date();
              const fullAvgDay = new Date(fullAvgDate.getFullYear(), fullAvgDate.getMonth(), fullAvgDate.getDate());
              const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              if (todayDay > fullAvgDay) {
                throw new Error('Cannot add Balanced Lot. The midnight deadline has expired.');
              }
            }
            stageData.actualBags = 0;
            updates.bags = currentTripFullAvgBags;
          } else {
            let actualBags = Number.parseInt(inspectionData.actualBags || '0');
            if (!actualBags || actualBags <= 0) {
              throw new Error('Please enter valid actual bags for Full Avg Lorry');
            }
            stageData.actualBags = actualBags;
            updates.bags = actualBags;
          }

          updates.cutting1 = stageData.cutting1 || 0;
          updates.cutting2 = stageData.cutting2 || 0;
          updates.bend = stageData.bend1 || 0;
          updates.bend2 = stageData.bend2 || 0;
          updates.remarks = inspectionData.remarks || null;

          const isLoose = ['PD_LOOSE', 'MD_LOOSE'].includes(entry.entryType) || 
                          ['PD_LOOSE', 'MD_LOOSE'].includes(entry.offering?.baseRateType) ||
                          ['PD_LOOSE', 'MD_LOOSE'].includes(entry.offering?.finalBaseRateType);
          const newTotalInspected = otherTripsBags + (updates.bags || 0);
          if ((newTotalInspected >= totalAllottedBags || (stage === 'balanced_lot' && !isSkipped)) && !isLoose) {
            updates.isComplete = true;
          }
        }

        let targetStageKey = stage;
        if (stage === 'nit_avg') {
          if (stages.nit_avg) {
            let suffix = 2;
            while (stages[`nit_avg_${suffix}`]) {
              suffix++;
            }
            targetStageKey = `nit_avg_${suffix}`;
          }
        }

        if (isRetryingHeldStage) {
          const holdHistory = getHoldHistory(stages, stage);
          const attemptNo = holdHistory.length + 1;
          stageData.baseStage = stage;
          stageData.attemptNo = attemptNo;
          stageData.previousHoldCount = holdHistory.length;
          // Save as a separate key so all attempts are preserved
          targetStageKey = `${stage}_reattempt_${attemptNo}`;
        }
        stages[targetStageKey] = stageData;
        updates.samplingStages = JSON.parse(JSON.stringify(stages));

        inspection = await PhysicalInspectionRepository.update(currentInspection.id, updates, { transaction: t });
        await AuditService.logUpdate(userId, 'physical_inspections', currentInspection.id, currentInspection, inspection);

        const currentStatus = entry.workflowStatus;
        if (currentStatus !== 'PHYSICAL_INSPECTION' && ['LOT_ALLOTMENT', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW'].includes(currentStatus)) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id, reason: `Progressive stage ${stage} added` }
          );
        }
      }

      return inspection;
    });
  }

  /**
   * Get physical inspection by lot allotment ID
   * @param {number} lotAllotmentId - Lot allotment ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Physical inspection or null
   */
  async getPhysicalInspectionByLotAllotment(lotAllotmentId, options = {}) {
    return await PhysicalInspectionRepository.findByLotAllotmentId(lotAllotmentId, options);
  }

  /**
   * Update physical inspection
   * @param {number} id - Physical inspection ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated physical inspection or null
   */
  async updatePhysicalInspection(id, updates, userId) {
    try {
      const current = await PhysicalInspectionRepository.findById(id);
      if (!current) {
        throw new Error('Physical inspection not found');
      }

      const updated = await PhysicalInspectionRepository.update(id, updates);

      await AuditService.logUpdate(userId, 'physical_inspections', id, current, updated);

      return updated;

    } catch (error) {
      console.error('Error updating physical inspection:', error);
      throw error;
    }
  }

  async updatePhysicalInspectionStage(sampleEntryId, inspectionId, stageName, stageData, userId, userRole) {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const AuditService = require('./AuditService');

    const inspection = await PhysicalInspection.findByPk(inspectionId);
    if (!inspection) {
      throw new Error('Physical inspection record not found');
    }

    if (inspection.sampleEntryId !== sampleEntryId) {
      throw new Error('Inspection does not belong to this sample entry');
    }

    const stages = inspection.samplingStages || {};
    const cleanStage = stageName.toLowerCase();

    if (!stages[cleanStage]) {
      throw new Error(`Sampling stage '${stageName}' not found in this inspection`);
    }
    const baseStage = stages[cleanStage]?.baseStage || cleanStage.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');

    const User = require('../models/User');
    const editorUser = await User.findByPk(userId);
    const editorName = editorUser ? (editorUser.fullName || editorUser.username) : 'System';

    const originalStageObj = stages[cleanStage];
    if (!originalStageObj.beforeEdit) {
      const { approvalStatus, isEdited, editedAt, editedByUserId, beforeEdit, ...restOriginal } = originalStageObj;
      originalStageObj.beforeEdit = JSON.parse(JSON.stringify(restOriginal));
    }

    stages[cleanStage] = {
      ...originalStageObj,
      ...stageData,
      approvalStatus: 'pending',
      isEdited: true,
      editedAt: new Date().toISOString(),
      editedBy: editorName,
      isLocked: true
    };

    if (cleanStage === 'full_avg' && stageData.bags !== undefined) {
      inspection.bags = stageData.bags;
    }

    const updates = {
      samplingStages: JSON.parse(JSON.stringify(stages)),
      bags: inspection.bags
    };

    inspection.changed('samplingStages', true);
    const updated = await inspection.update(updates);
    await AuditService.logUpdate(userId, 'physical_inspections', inspection.id, inspection, updated);

    return updated;
  }


  /**
   * Upload inspection images
   * @param {number} inspectionId - Physical inspection ID
   * @param {Object} files - Uploaded files
   * @param {Object} files.halfLorryImage - Half lorry image file
   * @param {Object} files.fullLorryImage - Full lorry image file
   * @param {number} userId - User ID
   * @param {string} [stage] - Sampling stage
   * @returns {Promise<Object>} Updated inspection with image URLs
   */
  async uploadInspectionImages(inspectionId, files, userId, stage) {
    try {
      const updates = {};
      let imageUrl = null;

      const fileToUpload = files.stageImage 
        ? (files.stageImage[0] || files.stageImage) 
        : (files.halfLorryImage ? files.halfLorryImage[0] || files.halfLorryImage : null) || (files.fullLorryImage ? files.fullLorryImage[0] || files.fullLorryImage : null);

      if (fileToUpload) {
        const uploadResult = await FileUploadService.uploadFile(fileToUpload, { compress: true });
        imageUrl = uploadResult.fileUrl;
      }

      const current = await PhysicalInspectionRepository.findById(inspectionId);
      if (!current) {
        throw new Error('Physical inspection not found');
      }

      if (stage && imageUrl) {
        const cleanStage = stage.toLowerCase();
        const stages = current.samplingStages || {};
        if (stages[cleanStage]) {
          stages[cleanStage].imageUrl = imageUrl;
          updates.samplingStages = stages;
        }
      }

      if (files.halfLorryImage || (stage && stage.toLowerCase() === 'half_lorry' && imageUrl)) {
        updates.halfLorryImageUrl = imageUrl || (files.halfLorryImage ? (await FileUploadService.uploadFile(files.halfLorryImage, { compress: true })).fileUrl : null);
      }

      if (files.fullLorryImage || (stage && stage.toLowerCase() === 'full_avg' && imageUrl)) {
        updates.fullLorryImageUrl = imageUrl || (files.fullLorryImage ? (await FileUploadService.uploadFile(files.fullLorryImage, { compress: true })).fileUrl : null);
      }

      return await this.updatePhysicalInspection(inspectionId, updates, userId);
    } catch (error) {
      console.error('Error uploading inspection images:', error);
      throw error;
    }
  }

  /**
   * Get inspection progress for a sample entry
   * @param {string} sampleEntryId - Sample entry ID (UUID)
   * @returns {Promise<Object>} Inspection progress data
   */
  async getInspectionProgress(sampleEntryId) {
    try {
      const SampleEntryRepository = require('../repositories/SampleEntryRepository');
      const LotAllotmentRepository = require('../repositories/LotAllotmentRepository');

      // Get the sample entry to know total bags
      const entry = await SampleEntryRepository.findById(sampleEntryId, { includeFinancial: true });
      if (!entry) {
        throw new Error('Sample entry not found');
      }

      // Get lot allotment to check allottedBags
      const lotAllotment = await LotAllotmentRepository.findBySampleEntryId(sampleEntryId);

      // Use allottedBags if available and greater than 0, otherwise use total bags from entry
      const totalBags = (lotAllotment?.allottedBags && lotAllotment.allottedBags > 0) ? lotAllotment.allottedBags : (entry.bags || 0);

      // Get all inspections for this entry
      const inspections = await PhysicalInspectionRepository.findBySampleEntryId(sampleEntryId);

      // Calculate total inspected bags dynamically looking at approved full_avg actualBags
      const inspectedBags = inspections.reduce((sum, inspection) => {
        const stages = inspection.samplingStages || {};
        const fullAvgStageKey = Object.keys(stages).find(key => {
          const base = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
          return (base === 'full_avg' || base === 'full_avg_lorry') && stages[key]?.approvalStatus === 'approved';
        });
        const fullAvgStage = fullAvgStageKey ? stages[fullAvgStageKey] : (stages.full_avg || {});
        const actualBags = Number(fullAvgStage.actualBags || fullAvgStage.bags || inspection.bags || 0);
        return sum + actualBags;
      }, 0);
      const remainingBags = totalBags - inspectedBags;
      const rawProgressPercentage = totalBags > 0 ? (inspectedBags / totalBags) * 100 : 0;
      const progressPercentage = Math.min(100, rawProgressPercentage);

      let previousInspections = inspections.map(inspection => ({
        id: inspection.id,
        inspectionDate: inspection.inspectionDate,
        lorryNumber: inspection.lorryNumber,
        bags: inspection.bags,
        cutting1: inspection.cutting1,
        cutting2: inspection.cutting2,
        bend: inspection.bend,
        bend2: inspection.bend2,
        reportedBy: inspection.reportedBy,
        samplingStages: inspection.samplingStages || {},
        lotAllotment: inspection.lotAllotment,
        createdAt: inspection.createdAt
      }));

      const getInspectionSortTime = (insp) => {
        const stages = insp.samplingStages || {};
        let earliest = null;
        for (const key in stages) {
          const stage = stages[key];
          if (stage && stage.reportedAt) {
            const t = new Date(stage.reportedAt).getTime();
            if (!earliest || t < earliest) {
              earliest = t;
            }
          }
        }
        return earliest || (insp.createdAt ? new Date(insp.createdAt).getTime() : null) || (insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null) || (insp.id * 1000) || 9999999999999;
      };

      // Merge only the original first-trip LOT_AVG placeholder. Later LOT_AVG rows must stay separate.
      if (previousInspections.length > 1) {
        const lotAvgIdx = previousInspections.findIndex(i => (i.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
        if (lotAvgIdx !== -1) {
          const realLorries = previousInspections
            .filter(i => {
              const lorry = (i.lorryNumber || '').trim().toUpperCase();
              return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
            })
            .sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
          const realLorryInsp = realLorries[0];
          if (realLorryInsp) {
            const lotAvgInsp = previousInspections[lotAvgIdx];
            const lotAvgHappenedBeforeFirstLoad = getInspectionSortTime(lotAvgInsp) <= getInspectionSortTime(realLorryInsp);
            const lotAvgKeys = Object.keys(lotAvgInsp.samplingStages || {}).filter(key => {
              const base = lotAvgInsp.samplingStages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
              return base === 'lot_avg';
            });
            if (lotAvgHappenedBeforeFirstLoad && lotAvgInsp.samplingStages && lotAvgKeys.length > 0) {
              if (!realLorryInsp.samplingStages) realLorryInsp.samplingStages = {};
              lotAvgKeys.forEach(key => {
                if (!realLorryInsp.samplingStages[key]) {
                  realLorryInsp.samplingStages[key] = lotAvgInsp.samplingStages[key];
                }
              });
              // Exclude the separate first-trip LOT_AVG placeholder
              previousInspections = previousInspections.filter((_, idx) => idx !== lotAvgIdx);
            }
          }
        }
      }

      // Sort progressive trips chronologically — match DB order: inspectionDate ASC, then createdAt, then id
      previousInspections.sort((a, b) => {
        const dateA = a.inspectionDate ? new Date(a.inspectionDate).getTime() : 0;
        const dateB = b.inspectionDate ? new Date(b.inspectionDate).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdA !== createdB) return createdA - createdB;
        return (a.id || 0) - (b.id || 0);
      });

      const variety = entry?.variety || '';
      const baseRateType = entry?.offering?.baseRateType || '';
      const finalBaseRateType = entry?.offering?.finalBaseRateType || '';
      const checkWb = (str) => {
        const cleaned = String(str || '').replace(/[\s_/]+/g, '').toLowerCase();
        return cleaned === 'pdwb' || cleaned === 'mdwb' || cleaned === 'pdloose' || cleaned === 'mdloose';
      };
      const isLocationSample = entry?.entryType === 'LOCATION_SAMPLE';
      const isMillSample = ['CREATE_NEW', 'READY_LORRY', 'DIRECT_LOADED_VEHICLE', 'NEW_PADDY_SAMPLE'].includes(entry?.entryType);
      const isWbVariety = checkWb(variety) || checkWb(baseRateType) || checkWb(finalBaseRateType) || isLocationSample || isMillSample;

      const activeRulesMode = isWbVariety ? 'old' : (lotAllotment?.samplingRulesMode || 'old');

      return {
        totalBags,
        inspectedBags,
        remainingBags,
        progressPercentage,
        previousInspections,
        samplingRulesMode: activeRulesMode
      };

    } catch (error) {
      console.error('Error getting inspection progress:', error);
      throw error;
    }
  }

  async approvePhysicalInspectionStage(sampleEntryId, inspectionId, stageName, userId, userRole) {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const SampleEntry = require('../models/SampleEntry');
    const WorkflowEngine = require('./WorkflowEngine');
    const AuditService = require('./AuditService');
    const LotAllotment = require('../models/LotAllotment');

    const inspection = await PhysicalInspection.findByPk(inspectionId);
    if (!inspection) {
      throw new Error('Physical inspection record not found');
    }

    if (inspection.sampleEntryId !== sampleEntryId) {
      throw new Error('Inspection does not belong to this sample entry');
    }

    const stages = inspection.samplingStages || {};
    const cleanStage = stageName.toLowerCase();
    const baseStage = stages[cleanStage]?.baseStage || cleanStage.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');

    if (!stages[cleanStage]) {
      throw new Error(`Sampling stage '${stageName}' not found in this inspection`);
    }

    // Set approval status to approved and record approver name
    const User = require('../models/User');
    const approverUser = await User.findByPk(userId);
    const approverName = approverUser ? (approverUser.fullName || approverUser.username) : 'System';
    stages[cleanStage].approvalStatus = 'approved';
    if (!stages[cleanStage].firstApprovedBy) {
      stages[cleanStage].firstApprovedBy = stages[cleanStage].approvedBy || approverName;
    }
    stages[cleanStage].approvedBy = approverName;
    
    // Mark all OTHER attempts of the same baseStage as superseded
    // This allows manager to pick ANY attempt (1st, 2nd, 3rd, 4th) to approve
    Object.keys(stages).forEach(key => {
      if (key === cleanStage || key === 'holdHistory') return;
      const thisBase = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
      if (thisBase === baseStage && stages[key]?.approvalStatus !== 'approved') {
        stages[key].approvalStatus = 'superseded';
      }
    });
    
    const updates = {
      samplingStages: JSON.parse(JSON.stringify(stages))
    };

    const entry = await SampleEntry.findByPk(sampleEntryId);
    if (!entry) {
      throw new Error('Sample entry not found');
    }

    // If approving full_avg, balanced_lot, or return_bags_report (for Ready Lorry), copy values to main columns of physical inspection
    const isReadyLorry = entry.entryType === 'DIRECT_LOADED_VEHICLE';
    if (baseStage === 'full_avg' || baseStage === 'balanced_lot' || (isReadyLorry && baseStage === 'return_bags_report')) {
      const stageData = stages[cleanStage] || {};
      if (baseStage === 'balanced_lot') {
        const fullAvgStageKey = Object.keys(stages).find(key => {
          const base = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
          return (base === 'full_avg' || base === 'full_avg_lorry') && stages[key]?.approvalStatus === 'approved';
        });
        const fullAvgStage = fullAvgStageKey ? stages[fullAvgStageKey] : (stages.full_avg || {});
        const fullAvgBags = Number(fullAvgStage.actualBags || fullAvgStage.bags || 0);
        updates.bags = fullAvgBags;
      } else if (isReadyLorry && baseStage === 'return_bags_report') {
        updates.bags = stageData.finalUnloadedBags !== undefined ? Number(stageData.finalUnloadedBags) : inspection.bags;
      } else {
        updates.bags = stageData.actualBags !== undefined ? Number(stageData.actualBags) : (stageData.bags !== undefined ? Number(stageData.bags) : inspection.bags);
      }

      if (isReadyLorry && baseStage === 'return_bags_report') {
        const fullAvgStage = stages.full_avg || {};
        updates.cutting1 = fullAvgStage.cutting1 || 0;
        updates.cutting2 = fullAvgStage.cutting2 || 0;
        updates.bend = fullAvgStage.bend1 || 0;
        updates.bend2 = fullAvgStage.bend2 || 0;
      } else {
        updates.cutting1 = stageData.cutting1 || 0;
        updates.cutting2 = stageData.cutting2 || 0;
        updates.bend = stageData.bend1 || 0;
        updates.bend2 = stageData.bend2 || 0;
      }
      
      // Calculate total inspected bags
      const existingInspections = await PhysicalInspection.findAll({
        where: { sampleEntryId }
      });
      const totalInspected = existingInspections
        .filter(i => i.id !== inspection.id)
        .reduce((sum, i) => sum + (i.bags || 0), 0) + (updates.bags || inspection.bags || 0);

      const lotAllotment = await LotAllotment.findOne({
        where: { sampleEntryId }
      });
      const totalAllottedBags = lotAllotment?.allottedBags || entry.bags || 0;
      const isLoose = ['PD_LOOSE', 'MD_LOOSE'].includes(entry.entryType) || 
                       ['PD_LOOSE', 'MD_LOOSE'].includes(entry.offering?.baseRateType) ||
                       ['PD_LOOSE', 'MD_LOOSE'].includes(entry.offering?.finalBaseRateType);

      if (totalInspected >= totalAllottedBags || (isReadyLorry && cleanStage === 'return_bags_report')) {
        if (!isLoose) {
          updates.isComplete = true;
          
          // Transition workflow to INVENTORY_ENTRY only if not already in that status
          if (entry.workflowStatus !== 'INVENTORY_ENTRY') {
            await WorkflowEngine.transitionTo(
              sampleEntryId,
              'INVENTORY_ENTRY',
              userId,
              userRole,
              { reason: 'Physical inspection completed and approved' }
            );
          }
        }
      }
    }

    inspection.changed('samplingStages', true);
    const updated = await inspection.update(updates);
    await AuditService.logUpdate(userId, 'physical_inspections', inspection.id, inspection, updated);

    return updated;
  }

  async rejectPhysicalInspectionStage(sampleEntryId, inspectionId, stageName, userId, userRole) {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const AuditService = require('./AuditService');

    const inspection = await PhysicalInspection.findByPk(inspectionId);
    if (!inspection) {
      throw new Error('Physical inspection record not found');
    }

    if (inspection.sampleEntryId !== sampleEntryId) {
      throw new Error('Inspection does not belong to this sample entry');
    }

    const stages = inspection.samplingStages || {};
    const cleanStage = stageName.toLowerCase();

    if (!stages[cleanStage]) {
      throw new Error(`Sampling stage '${stageName}' not found in this inspection`);
    }
    const baseStage = stages[cleanStage]?.baseStage || cleanStage.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');

    const User = require('../models/User');
    const approverUser = await User.findByPk(userId);
    const approverName = approverUser ? (approverUser.fullName || approverUser.username) : 'System';

    if (stages[cleanStage].beforeEdit) {
      const beforeVal = stages[cleanStage].beforeEdit;
      stages[cleanStage] = {
        ...beforeVal,
        approvalStatus: beforeVal.approvalStatus || 'approved',
        isEdited: false,
        beforeEdit: null
      };
      if (baseStage === 'full_avg' && beforeVal.bags !== undefined) {
        inspection.bags = beforeVal.bags;
      }
    } else {
      stages[cleanStage].approvalStatus = 'rejected';
      stages[cleanStage].rejectedBy = approverName;
      stages[cleanStage].isLocked = true;
    }

    const updates = {
      samplingStages: JSON.parse(JSON.stringify(stages)),
      bags: inspection.bags
    };

    inspection.changed('samplingStages', true);
    const updated = await inspection.update(updates);
    await AuditService.logUpdate(userId, 'physical_inspections', inspection.id, inspection, updated);

    return updated;
  }

  async revertSkipPhysicalInspectionStage(sampleEntryId, inspectionId, stageName, userId, userRole) {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const AuditService = require('./AuditService');

    const cleanRole = String(userRole || '').toLowerCase();
    if (!['admin', 'owner', 'manager'].includes(cleanRole)) {
      throw new Error('Only Admin, Manager, or CEO can revert skipped stages.');
    }

    const inspection = await PhysicalInspection.findByPk(inspectionId);
    if (!inspection) {
      throw new Error('Physical inspection record not found');
    }

    if (inspection.sampleEntryId !== sampleEntryId) {
      throw new Error('Inspection does not belong to this sample entry');
    }

    const stages = inspection.samplingStages || {};
    const cleanStage = stageName.toLowerCase();

    if (!stages[cleanStage]) {
      throw new Error(`Sampling stage '${stageName}' not found in this inspection`);
    }

    if (!stages[cleanStage].isSkipped) {
      throw new Error(`Sampling stage '${stageName}' is not marked as skipped`);
    }

    // Completely remove this skipped stage from samplingStages
    delete stages[cleanStage];

    const updates = {
      samplingStages: JSON.parse(JSON.stringify(stages))
    };

    inspection.changed('samplingStages', true);
    const updated = await inspection.update(updates);
    await AuditService.logUpdate(userId, 'physical_inspections', inspection.id, inspection, updated);

    return updated;
  }

  async updatePhysicalInspectionStage(sampleEntryId, inspectionId, stageKey, stageData, userId, userRole) {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const SampleEntry = require('../models/SampleEntry');
    const AuditService = require('./AuditService');

    const inspection = await PhysicalInspection.findByPk(inspectionId);
    if (!inspection) {
      throw new Error('Physical inspection record not found');
    }

    if (inspection.sampleEntryId !== sampleEntryId) {
      throw new Error('Inspection does not belong to this sample entry');
    }

    const stages = inspection.samplingStages || {};
    const cleanStage = stageKey.toLowerCase();

    if (!stages[cleanStage]) {
      throw new Error(`Sampling stage '${stageKey}' not found in this inspection`);
    }

    const originalStageObj = stages[cleanStage];
    if (!originalStageObj.beforeEdit) {
      const { approvalStatus, isEdited, editedAt, editedByUserId, beforeEdit, ...restOriginal } = originalStageObj;
      originalStageObj.beforeEdit = JSON.parse(JSON.stringify(restOriginal));
    }

    const updatedFields = {};
    for (const key in stageData) {
      if (stageData[key] !== undefined) {
        updatedFields[key] = stageData[key];
      }
    }

    stages[cleanStage] = {
      ...originalStageObj,
      ...updatedFields,
      approvalStatus: 'pending',
      isEdited: true,
      editedAt: new Date().toISOString(),
      editedByUserId: userId
    };

    const updates = {
      samplingStages: JSON.parse(JSON.stringify(stages))
    };

    inspection.changed('samplingStages', true);
    const updated = await inspection.update(updates);
    await AuditService.logUpdate(userId, 'physical_inspections', inspection.id, inspection, updated);

    return updated;
  }

  async holdPhysicalInspectionStage(sampleEntryId, inspectionId, stageName, holdDuration, userId, userRole) {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const SampleEntry = require('../models/SampleEntry');
    const AuditService = require('./AuditService');

    const inspection = await PhysicalInspection.findByPk(inspectionId);
    if (!inspection) {
      throw new Error('Physical inspection record not found');
    }

    if (inspection.sampleEntryId !== sampleEntryId) {
      throw new Error('Inspection does not belong to this sample entry');
    }

    const stages = inspection.samplingStages || {};
    const cleanStage = stageName.toLowerCase();

    if (!stages[cleanStage]) {
      throw new Error(`Sampling stage '${stageName}' not found in this inspection`);
    }
    if (stages[cleanStage].approvalStatus === 'approved') {
      throw new Error(`Sampling stage '${stageName}' is already approved and cannot be put on hold`);
    }

    const User = require('../models/User');
    const approverUser = await User.findByPk(userId);
    const approverName = approverUser ? (approverUser.fullName || approverUser.username) : 'System';

    const baseStage = stages[cleanStage]?.baseStage || cleanStage.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
    const holdHistory = {
      ...(stages.holdHistory || {})
    };
    const stageHistory = Array.isArray(holdHistory[baseStage]) ? [...holdHistory[baseStage]] : [];
    const attemptNo = stages[cleanStage].attemptNo || (stageHistory.length + 1);
    const heldSnapshot = {
      ...JSON.parse(JSON.stringify(stages[cleanStage])),
      baseStage,
      attemptNo,
      approvalStatus: 'hold',
      holdDuration: holdDuration,
      holdAt: new Date().toISOString(),
      holdBy: approverName,
      isLocked: true
    };
    stageHistory.push(heldSnapshot);
    holdHistory[baseStage] = stageHistory;
    
    stages[cleanStage] = {
      ...stages[cleanStage],
      baseStage,
      attemptNo,
      approvalStatus: 'hold',
      holdDuration,
      holdAt: heldSnapshot.holdAt,
      holdBy: approverName,
      isLocked: true
    };
    stages.holdHistory = holdHistory;

    const updates = {
      samplingStages: JSON.parse(JSON.stringify(stages))
    };

    inspection.changed('samplingStages', true);
    const updated = await inspection.update(updates);
    await AuditService.logUpdate(userId, 'physical_inspections', inspection.id, inspection, updated);

    return updated;
  }
}

module.exports = new PhysicalInspectionService();
