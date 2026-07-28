/**
 * Complete Test Suite for Hold, Progressive Stages, and Trip Statuses
 * Run using: `node test-hold-logic-complete.js`
 */

const assert = require('assert').strict;

// --- MOCKED STATE AND HELPER IMPLEMENTATIONS ---

// Mimics the active workspace settings/helpers
let entries = [];
let inspectionProgress = {};
let inspectionData = {};
let samplingStageData = {};

const getEntryById = (entryId) => entries.find(entry => entry.id === entryId);

const checkIfWbVariety = (entry) => {
  if (!entry) return false;
  const v = (entry.variety || '').toUpperCase();
  return v.includes('WB') || v.includes('WEIGHBRIDGE');
};

const getRulesMode = (entryId) => {
  return inspectionData[entryId]?.samplingRulesMode || 'old';
};

const isWorkflowStageKey = (key) => key !== 'holdHistory';

const getStageBaseKey = (key, stageObj) => {
  if (stageObj && stageObj.baseStage) return stageObj.baseStage;
  return key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
};

const isStageApprovedInStages = (stages, stageKey) => {
  if (!stages) return false;
  return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
    const baseKey = getStageBaseKey(key, stages[key]);
    return baseKey === stageKey && stages[key]?.approvalStatus === 'approved';
  });
};

const hasStageInStages = (stages, stageKey) => {
  if (!stages) return false;
  return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
    const baseKey = getStageBaseKey(key, stages[key]);
    return baseKey === stageKey;
  });
};

const getStageObjFromStages = (stages, stageKey) => {
  if (!stages) return {};
  const matchingKeys = Object.keys(stages).filter(key => isWorkflowStageKey(key) && getStageBaseKey(key, stages[key]) === stageKey);
  if (matchingKeys.length === 0) return {};
  matchingKeys.sort((a, b) => {
    const timeA = new Date(stages[a]?.reportedAt || stages[a]?.holdAt || stages[a]?.createdAt || 0).getTime();
    const timeB = new Date(stages[b]?.reportedAt || stages[b]?.holdAt || stages[b]?.createdAt || 0).getTime();
    return timeB - timeA;
  });
  return stages[matchingKeys[0]] || {};
};

const getStageHoldInfo = (entryId, stageKey) => {
  if (isStageApprovedForLot(entryId, stageKey)) {
    return { count: 0, latestStatus: 'approved' };
  }
  
  const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
  const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
  
  let count = 0;
  let latestStatus = null;
  let latestTime = 0;
  let hasActiveHold = false;
  
  // Local state check
  const localStages = samplingStageData[entryId] || {};
  Object.keys(localStages).filter(isWorkflowStageKey).forEach(key => {
    const baseKey = getStageBaseKey(key, localStages[key]);
    if (baseKey === stageKey) {
      count++;
      const stg = localStages[key];
      const time = new Date(stg.reportedAt || stg.holdAt || 0).getTime();
      if (stg.approvalStatus === 'hold') {
        hasActiveHold = true;
      }
      if (time >= latestTime) {
        latestTime = time;
        latestStatus = stg.approvalStatus;
      }
    }
  });
  
  // Previous inspections check
  const tripInsps = prevInsps.filter(insp => {
    const l = (insp.lorryNumber || '').trim().toUpperCase();
    if (stageKey === 'lot_avg') return l === 'LOT_AVG' || l === cleanLorry;
    if (stageKey === 'balanced_lot') return l === 'BALANCED_LOT' || l === cleanLorry;
    return l === cleanLorry;
  });
  
  tripInsps.forEach(insp => {
    const stages = insp.samplingStages || {};
    Object.keys(stages).filter(isWorkflowStageKey).forEach(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      if (baseKey === stageKey) {
        count++;
        const stg = stages[key];
        const time = new Date(stg.reportedAt || stg.holdAt || 0).getTime();
        if (stg.approvalStatus === 'hold') {
          hasActiveHold = true;
        }
        if (time >= latestTime) {
          latestTime = time;
          latestStatus = stg.approvalStatus;
        }
      }
    });
  });

  if (hasActiveHold && latestStatus !== 'approved') {
    latestStatus = 'hold';
  }
  
  return { count, latestStatus };
};

const isStageApprovedForLot = (entryId, stageKey) => {
  if (samplingStageData[entryId]?.[stageKey]?.isLocked && samplingStageData[entryId]?.[stageKey]?.approvalStatus === 'approved') {
    return true;
  }
  const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
  const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
  
  if (cleanLorry) {
    const approvedWithCurrent = prevInsps.some(insp => {
      const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
      const stages = insp.samplingStages || {};
      return lorryMatch && isStageApprovedInStages(stages, stageKey);
    });
    if (approvedWithCurrent) return true;
  }

  const entry = getEntryById(entryId);
  if (getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry)) {
    if (stageKey === 'lot_avg') {
      const todayStr = new Date().toLocaleDateString('en-GB');
      return prevInsps.some(insp => {
        const lorry = (insp.lorryNumber || '').trim().toUpperCase();
        const isDummy = lorry === 'LOT_AVG' || !lorry;
        const isMatch = isDummy || lorry === cleanLorry;
        const isApproved = isStageApprovedInStages(insp.samplingStages, 'lot_avg');
        const inspDateStr = insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString('en-GB') : '';
        return isMatch && isApproved && (inspDateStr === todayStr);
      });
    }
  }

  if (stageKey === 'lot_avg' && cleanLorry !== 'LOT_AVG' && cleanLorry !== 'BALANCED_LOT') {
    const lotAvgInsps = prevInsps.filter(insp => (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
    if (lotAvgInsps.length > 0) {
      const priorRealLorries = prevInsps.filter(insp => {
        const l = (insp.lorryNumber || '').trim().toUpperCase();
        return l !== cleanLorry && l !== 'LOT_AVG' && l !== 'BALANCED_LOT';
      });
      if (priorRealLorries.length === 0) {
        return lotAvgInsps.some(insp => isStageApprovedInStages(insp.samplingStages, 'lot_avg'));
      } else {
        const sortedLorries = [...priorRealLorries].sort((a, b) => Number(a.id) - Number(b.id));
        const lastRealLorry = sortedLorries[sortedLorries.length - 1];
        return lotAvgInsps.some(insp => {
          return Number(insp.id) >= Number(lastRealLorry.id) && isStageApprovedInStages(insp.samplingStages, 'lot_avg');
        });
      }
    }
  }

  return false;
};

// Check if there are unresolved pending or hold stages in a trip
const hasUnresolvedPendingOrHold = (stages) => {
  return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
    const stg = stages[key];
    if (!stg) return false;
    if (stg.approvalStatus === 'pending') return true;
    if (stg.approvalStatus === 'hold') {
      const baseKey = getStageBaseKey(key, stg);
      return !isStageApprovedInStages(stages, baseKey);
    }
    return false;
  });
};

const isStagePendingForLot = (entryId, stageKey) => {
  const checkPending = (stages) => {
    return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      return baseKey === stageKey && stages[key]?.approvalStatus === 'pending';
    });
  };

  if (samplingStageData[entryId] && checkPending(samplingStageData[entryId])) {
    return true;
  }
  const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
  return prevInsps.some(insp => checkPending(insp.samplingStages || {}));
};

const isStageLockedForLot = (entryId, stageKey) => {
  const holdInfo = getStageHoldInfo(entryId, stageKey);
  if (holdInfo.latestStatus === 'hold' && holdInfo.count < 4) {
    return false; // not locked, can re-submit
  }
  if (samplingStageData[entryId]?.[stageKey]?.isLocked) return true;
  
  const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
  const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
  
  return prevInsps.some(insp => {
    const lorry = (insp.lorryNumber || '').trim().toUpperCase();
    const lMatch = lorry === cleanLorry || (stageKey === 'lot_avg' && lorry === 'LOT_AVG') || (stageKey === 'balanced_lot' && lorry === 'BALANCED_LOT');
    if (!lMatch) return false;
    
    // Base key resolved check
    return Object.keys(insp.samplingStages || {}).some(key => {
      return getStageBaseKey(key, insp.samplingStages[key]) === stageKey;
    });
  });
};

const isLotAvgRequiredForLorry = (entryId, cleanLorry) => {
  if (cleanLorry === 'LOT_AVG') return true;
  return getRulesMode(entryId) === 'new';
};

const isStageDisabledForEntry = (entryId, stageKey) => {
  const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
  const entry = getEntryById(entryId);
  const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);

  if (isNewCrop) {
    if (stageKey === 'nit_avg') return true;

    // Get combined stages for current trip
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const trip = prevInsps.find(insp => (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry);
    const stagesObj = {
      ...(trip?.samplingStages || {}),
      ...(samplingStageData[entryId] || {})
    };

    // Detect active hold
    let activeHoldStage = null;
    Object.keys(stagesObj).filter(isWorkflowStageKey).forEach(key => {
      const stg = stagesObj[key];
      if (stg?.approvalStatus === 'hold') {
        const baseKey = getStageBaseKey(key, stg);
        if (!isStageApprovedInStages(stagesObj, baseKey)) {
          activeHoldStage = baseKey;
        }
      }
    });

    if (activeHoldStage) {
      if (stageKey === activeHoldStage) {
        const holdInfo = getStageHoldInfo(entryId, stageKey);
        return holdInfo.count >= 4;
      }
      return true; // blocks other stages
    }

    if (stageKey !== 'lot_avg' && isStagePendingForLot(entryId, 'lot_avg')) {
      return true;
    }
    if (stageKey !== 'balanced_lot' && isStagePendingForLot(entryId, 'balanced_lot')) {
      return true;
    }

    if (stageKey === 'lot_avg') {
      if (isStageLockedForLot(entryId, 'half_lorry') || isStageLockedForLot(entryId, 'full_avg')) {
        return true;
      }
      return isStageLockedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry);
    }
    if (stageKey === 'half_lorry') {
      if (isLotAvgRequiredForLorry(entryId, cleanLorry) && !isStageApprovedForLot(entryId, 'lot_avg')) {
        return true;
      }
      return isStageLockedForLot(entryId, 'half_lorry');
    }
    if (stageKey === 'full_avg') {
      if (isLotAvgRequiredForLorry(entryId, cleanLorry) && !isStageApprovedForLot(entryId, 'lot_avg')) {
        return true;
      }
      const hasHalfLorry = Object.keys(stagesObj).some(key => getStageBaseKey(key, stagesObj[key]) === 'half_lorry');
      if (!hasHalfLorry) {
        return true;
      }
      return isStageLockedForLot(entryId, 'full_avg');
    }
  }
  return false;
};

// --- TEST SUITE RUNNER ---

const runSuite = () => {
  console.log("=========================================");
  console.log("RUNNING EXTENSIVE HOLD LOGIC TEST SUITE...");
  console.log("=========================================");

  // Reset state
  entries = [{ id: 'entry-1', entryType: 'DIRECT_LOADED_VEHICLE', variety: 'PADDY' }];
  inspectionData = { 'entry-1': { lorryNumber: 'HR-12-A-1234', samplingRulesMode: 'new' } };

  // SCENARIO 1: Lot Avg on hold -> half_lorry and full_avg must be disabled
  {
    samplingStageData = {};
    inspectionProgress = {
      'entry-1': {
        previousInspections: [
          {
            id: 101,
            lorryNumber: 'LOT_AVG',
            inspectionDate: new Date().toISOString(),
            samplingStages: {
              lot_avg: { approvalStatus: 'hold', holdAt: new Date().toISOString() }
            }
          }
        ]
      }
    };

    assert.equal(isStageApprovedForLot('entry-1', 'lot_avg'), false, "lot_avg should not be approved");
    assert.equal(isStageDisabledForEntry('entry-1', 'half_lorry'), true, "half_lorry should be disabled when lot_avg on hold");
    assert.equal(isStageDisabledForEntry('entry-1', 'full_avg'), true, "full_avg should be disabled when lot_avg on hold");
    assert.equal(isStageDisabledForEntry('entry-1', 'lot_avg'), false, "lot_avg itself should be enabled for retry");
    console.log("✅ Test 1: Lot Avg on hold blocks other stages.");
  }

  // SCENARIO 2: Lot Avg reattempt is approved -> half_lorry should enable
  {
    inspectionProgress = {
      'entry-1': {
        previousInspections: [
          {
            id: 101,
            lorryNumber: 'LOT_AVG',
            inspectionDate: new Date().toISOString(),
            samplingStages: {
              lot_avg: { approvalStatus: 'hold', holdAt: new Date().toISOString() },
              lot_avg_reattempt_2: { approvalStatus: 'approved', reportedAt: new Date().toISOString() }
            }
          }
        ]
      }
    };

    assert.equal(isStageApprovedForLot('entry-1', 'lot_avg'), true, "lot_avg should now be approved");
    assert.equal(isStageDisabledForEntry('entry-1', 'half_lorry'), false, "half_lorry should be enabled after lot_avg approval");
    console.log("✅ Test 2: Approved Lot Avg reattempt enables downstream stages.");
  }

  // SCENARIO 3: LOT_AVG trip completion status with approved reattempt
  {
    const stages = {
      lot_avg: { approvalStatus: 'hold', holdAt: new Date().toISOString() },
      lot_avg_reattempt_2: { approvalStatus: 'approved', reportedAt: new Date().toISOString() }
    };
    
    const lotAvgTripIncomplete = hasUnresolvedPendingOrHold(stages);
    assert.equal(lotAvgTripIncomplete, false, "LOT_AVG trip should show Completed, not Awaiting Approval");
    console.log("✅ Test 3: LOT_AVG trip marked completed after approved reattempt.");
  }

  // SCENARIO 4: pending reattempts correctly block downstream stages
  {
    inspectionProgress = {
      'entry-1': {
        previousInspections: [
          {
            id: 101,
            lorryNumber: 'LOT_AVG',
            inspectionDate: new Date().toISOString(),
            samplingStages: {
              lot_avg: { approvalStatus: 'hold', holdAt: new Date().toISOString() },
              lot_avg_reattempt_2: { approvalStatus: 'pending', reportedAt: new Date().toISOString() }
            }
          }
        ]
      }
    };

    assert.equal(isStagePendingForLot('entry-1', 'lot_avg'), true, "lot_avg should count as pending when reattempt is pending");
    assert.equal(isStageDisabledForEntry('entry-1', 'half_lorry'), true, "half_lorry should be blocked when lot_avg is pending");
    console.log("✅ Test 4: Pending reattempts block downstream stages.");
  }

  // SCENARIO 5: lock detection works for reattempts
  {
    inspectionProgress = {
      'entry-1': {
        previousInspections: [
          {
            id: 101,
            lorryNumber: 'LOT_AVG',
            inspectionDate: new Date().toISOString(),
            samplingStages: {
              lot_avg: { approvalStatus: 'hold', holdAt: new Date().toISOString() },
              lot_avg_reattempt_2: { approvalStatus: 'approved', reportedAt: new Date().toISOString() }
            }
          }
        ]
      }
    };

    assert.equal(isStageLockedForLot('entry-1', 'lot_avg'), true, "lot_avg should be locked after approved reattempt");
    console.log("✅ Test 5: Reattempt approval correctly locks the stage.");
  }

  console.log("🎉 ALL TESTS IN SUITE PASSED SUCCESSFULLY!");
};

runSuite();
