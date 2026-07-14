/**
 * Test script for Progressive Holds and New Crop Workflow
 * Run this file using node: `node test-progressive-holds.js`
 */

const assert = require('assert').strict;

// Mock utility: extract base key of a stage
const getStageBaseKey = (key, stageObj) => {
  if (stageObj && stageObj.baseStage) return stageObj.baseStage;
  if (key.includes('_hold_')) {
    return key.split('_hold_')[0];
  }
  return key;
};

// Mock utility: check if a stage is approved in the stages dict
const isStageApprovedInStages = (stages, stageKey) => {
  if (!stages) return false;
  return Object.keys(stages).some(key => {
    const baseKey = getStageBaseKey(key, stages[key]);
    return baseKey === stageKey && stages[key]?.approvalStatus === 'approved';
  });
};

// Mock utility: check if a stage is present in the stages dict
const hasStageInStages = (stages, stageKey) => {
  if (!stages) return false;
  return Object.keys(stages).some(key => {
    const baseKey = getStageBaseKey(key, stages[key]);
    return baseKey === stageKey;
  });
};

// Mock utility: determine if full average lorry is eligible for balanced lot
const isFullAvgEligibleForBalanced = (stages) => {
  return isStageApprovedInStages(stages, 'full_avg');
};

// Mock utility: check if a trip is incomplete (New Crop rules)
const isNewCropTripIncomplete = (stages) => {
  const hasApprovedFullAvg = isStageApprovedInStages(stages, 'full_avg');
  return !hasApprovedFullAvg;
};

// RUN TESTS
const runTests = () => {
  console.log("--------------------------------------------------");
  console.log("RUNNING PROGRESSIVE HOLD & WORKFLOW LOGIC TESTS...");
  console.log("--------------------------------------------------");

  // Test Case 1: Lorry has no full_avg submitted yet
  {
    const stages = {
      half_lorry: { approvalStatus: 'approved', reportedAt: '2026-07-01T12:00:00.000Z' }
    };
    assert.equal(isStageApprovedInStages(stages, 'full_avg'), false);
    assert.equal(isFullAvgEligibleForBalanced(stages), false, "Balanced Lot should be disabled if Full Avg is not submitted");
    assert.equal(isNewCropTripIncomplete(stages), true, "Trip should be incomplete");
    console.log("✅ Test Case 1 Passed: No Full Avg Lorry submitted");
  }

  // Test Case 2: Full Avg Lorry submitted and is PENDING approval
  {
    const stages = {
      half_lorry: { approvalStatus: 'approved', reportedAt: '2026-07-01T12:00:00.000Z' },
      full_avg: { approvalStatus: 'pending', reportedAt: '2026-07-01T12:05:00.000Z' }
    };
    assert.equal(isStageApprovedInStages(stages, 'full_avg'), false);
    assert.equal(isFullAvgEligibleForBalanced(stages), false, "Balanced Lot should be DISABLED (blocked) when Full Avg is pending");
    assert.equal(isNewCropTripIncomplete(stages), true, "Trip is incomplete until approved");
    console.log("✅ Test Case 2 Passed: Full Avg Lorry pending approval");
  }

  // Test Case 3: Full Avg Lorry goes on HOLD
  {
    const stages = {
      half_lorry: { approvalStatus: 'approved', reportedAt: '2026-07-01T12:00:00.000Z' },
      full_avg_hold_1719812400000: { approvalStatus: 'hold', holdAt: '2026-07-01T12:10:00.000Z' }
    };
    assert.equal(isStageApprovedInStages(stages, 'full_avg'), false);
    assert.equal(isFullAvgEligibleForBalanced(stages), false, "Balanced Lot should be DISABLED (blocked) when Full Avg is on Hold");
    assert.equal(isNewCropTripIncomplete(stages), true, "Trip is incomplete (Hold needs to be resolved)");
    console.log("✅ Test Case 3 Passed: Full Avg Lorry on Hold");
  }

  // Test Case 4: Lorry is resumed, and Attempt 2 of Full Avg is submitted (Pending)
  {
    const stages = {
      half_lorry: { approvalStatus: 'approved', reportedAt: '2026-07-01T12:00:00.000Z' },
      full_avg_hold_1719812400000: { approvalStatus: 'hold', holdAt: '2026-07-01T12:10:00.000Z' },
      full_avg: { approvalStatus: 'pending', reportedAt: '2026-07-01T12:15:00.000Z' }
    };
    assert.equal(isStageApprovedInStages(stages, 'full_avg'), false);
    assert.equal(isFullAvgEligibleForBalanced(stages), false, "Balanced Lot should be DISABLED when Attempt 2 is pending");
    assert.equal(isNewCropTripIncomplete(stages), true, "Trip is incomplete (Attempt 2 is pending)");
    console.log("✅ Test Case 4 Passed: Full Avg Attempt 2 pending");
  }

  // Test Case 5: Attempt 2 of Full Avg is APPROVED by Manager
  {
    const stages = {
      half_lorry: { approvalStatus: 'approved', reportedAt: '2026-07-01T12:00:00.000Z' },
      full_avg_hold_1719812400000: { approvalStatus: 'hold', holdAt: '2026-07-01T12:10:00.000Z' },
      full_avg: { approvalStatus: 'approved', reportedAt: '2026-07-01T12:15:00.000Z' }
    };
    assert.equal(isStageApprovedInStages(stages, 'full_avg'), true, "Full Avg should be recognized as approved");
    assert.equal(isFullAvgEligibleForBalanced(stages), true, "Balanced Lot should be eligible when approved");
    assert.equal(isNewCropTripIncomplete(stages), false, "Trip is now COMPLETE");
    console.log("✅ Test Case 5 Passed: Full Avg approved after hold");
  }

  console.log("\n--------------------------------------------------");
  console.log("🎉 ALL TEST CASES PASSED SUCCESSFULLY!");
  console.log("--------------------------------------------------");
};

runTests();
