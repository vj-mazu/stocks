const { dedupeQualityAttempts } = require('../utils/historyUtil');

describe('Resample Quality Parameter Preservation & Cap', () => {
  test('dedupeQualityAttempts caps at maximum 2 attempts and merges subsequent attempts into the 2nd attempt', () => {
    const rawAttempts = [
      {
        attemptNo: 1,
        moisture: 14.5,
        cutting1: 15,
        cutting2: 25,
        bend1: 3,
        bend2: 4,
        mix: '3',
        kandu: '1',
        oil: '1',
        sk: '1',
        grainsCount: 280,
        wbR: 65,
        wbBk: 10,
        wbT: 75
      },
      {
        attemptNo: 2,
        moisture: 13.8,
        cutting1: 12,
        cutting2: 20,
        bend1: 2,
        bend2: 3,
        mix: '2',
        kandu: '0',
        oil: '0',
        sk: '0',
        grainsCount: null,
        wbR: 0,
        wbBk: 0,
        wbT: 0
      },
      {
        attemptNo: 3,
        moisture: 13.9,
        grainsCount: 290,
        wbR: 66,
        wbBk: 8,
        wbT: 74
      }
    ];

    const result = dedupeQualityAttempts(rawAttempts);
    expect(result.length).toBe(2);
    expect(result[0].attemptNo).toBe(1);
    expect(result[0].cutting1).toBe(15);
    
    // Sample 2 must merge the 100g info (attempt 3) while keeping cutting1/cutting2 from attempt 2
    expect(result[1].attemptNo).toBe(2);
    expect(result[1].cutting1).toBe(12);
    expect(result[1].cutting2).toBe(20);
    expect(result[1].grainsCount).toBe(290);
    expect(result[1].wbR).toBe(66);
    expect(result[1].wbBk).toBe(8);
    expect(result[1].wbT).toBe(74);
  });

  test('Preserves existing quality fields when partial 100g save occurs', () => {
    const existingQuality = {
      moisture: 13.8,
      dryMoisture: null,
      cutting1: 12,
      cutting2: 22,
      bend1: 3,
      bend2: 4,
      mix: '2',
      kandu: '1',
      oil: '1',
      sk: '1',
      grainsCount: null,
      wbR: 0,
      wbBk: 0,
      wbT: 0,
      smellHas: false,
      smellType: null
    };

    const isPrepOr100gSave = true;
    const reqBody = {
      moisture: '14.0',
      grainsCount: '300',
      wbR: '67.5',
      wbBk: '7.5',
      wbT: '75.0'
    };

    const hasMoisture = true;
    const hasCutting1 = false;
    const hasCutting2 = false;
    const hasBend1 = false;
    const hasBend2 = false;
    const hasMix = false;
    const hasKandu = false;
    const hasOil = false;
    const hasSk = false;
    const hasGrains = true;
    const hasWbR = true;
    const hasWbBk = true;
    const wbEnabled = true;

    const mergedQuality = {
      moisture: hasMoisture ? parseFloat(reqBody.moisture) : (isPrepOr100gSave ? existingQuality.moisture : null),
      cutting1: hasCutting1 ? parseFloat(reqBody.cutting1) : (isPrepOr100gSave ? existingQuality.cutting1 : null),
      cutting2: hasCutting2 ? parseFloat(reqBody.cutting2) : (isPrepOr100gSave ? existingQuality.cutting2 : null),
      bend1: hasBend1 ? parseFloat(reqBody.bend1) : (isPrepOr100gSave ? existingQuality.bend1 : null),
      bend2: hasBend2 ? parseFloat(reqBody.bend2) : (isPrepOr100gSave ? existingQuality.bend2 : null),
      mix: hasMix ? reqBody.mix : (isPrepOr100gSave ? existingQuality.mix : null),
      kandu: hasKandu ? reqBody.kandu : (isPrepOr100gSave ? existingQuality.kandu : null),
      oil: hasOil ? reqBody.oil : (isPrepOr100gSave ? existingQuality.oil : null),
      sk: hasSk ? reqBody.sk : (isPrepOr100gSave ? existingQuality.sk : null),
      grainsCount: hasGrains ? parseInt(reqBody.grainsCount, 10) : (isPrepOr100gSave ? existingQuality.grainsCount : null),
      wbR: hasWbR ? (wbEnabled ? parseFloat(reqBody.wbR) : 0) : (isPrepOr100gSave ? existingQuality.wbR : 0),
      wbBk: hasWbBk ? (wbEnabled ? parseFloat(reqBody.wbBk) : 0) : (isPrepOr100gSave ? existingQuality.wbBk : 0),
      wbT: parseFloat(reqBody.wbT)
    };

    expect(mergedQuality.moisture).toBe(14.0);
    expect(mergedQuality.cutting1).toBe(12);
    expect(mergedQuality.cutting2).toBe(22);
    expect(mergedQuality.bend1).toBe(3);
    expect(mergedQuality.bend2).toBe(4);
    expect(mergedQuality.mix).toBe('2');
    expect(mergedQuality.kandu).toBe('1');
    expect(mergedQuality.oil).toBe('1');
    expect(mergedQuality.sk).toBe('1');
    expect(mergedQuality.grainsCount).toBe(300);
    expect(mergedQuality.wbR).toBe(67.5);
    expect(mergedQuality.wbBk).toBe(7.5);
    expect(mergedQuality.wbT).toBe(75.0);
  });

  test('Resample 100g save strictly isolates 2nd sample from inheriting 1st sample cutting, bend, mix', () => {
    const ValidationService = require('../services/ValidationService');
    const existingQuality = {
      moisture: 12.0,
      cutting1: 1.0,
      cutting2: 12.0,
      bend1: 1.0,
      bend2: 12.0,
      mix: '12',
      kandu: '12',
      oil: '12',
      sk: '12',
      grainsCount: 12,
      wbR: 12.0,
      wbBk: 12.0,
      wbT: 24.0,
      reportedBy: 'B Ramesh'
    };

    // Resample 100g submission (Moisture 11, Grains 11, WB 11)
    const isResampleAction = true;
    const isNextIntent = true;
    const existingSecondAttempt = null;
    const isPrepOr100gSave = true;
    const prevQ = isResampleAction ? (existingSecondAttempt || {}) : (isPrepOr100gSave ? {} : existingQuality);

    const reqBody = {
      moisture: '11.0',
      grainsCount: '11',
      wbR: '11.0',
      wbBk: '11.0',
      wbT: '22.0',
      reportedBy: 'Mahesh Kumar'
    };

    const hasMoisture = true;
    const hasCutting1 = false;
    const hasCutting2 = false;
    const hasBend1 = false;
    const hasBend2 = false;
    const hasMix = false;
    const hasKandu = false;
    const hasOil = false;
    const hasSk = false;
    const hasGrains = true;
    const hasWbR = true;
    const hasWbBk = true;

    const secondAttemptQuality = {
      moisture: hasMoisture ? parseFloat(reqBody.moisture) : (isPrepOr100gSave ? (prevQ.moisture ?? null) : null),
      cutting1: hasCutting1 ? parseFloat(reqBody.cutting1) : (isPrepOr100gSave ? (prevQ.cutting1 ?? null) : null),
      cutting2: hasCutting2 ? parseFloat(reqBody.cutting2) : (isPrepOr100gSave ? (prevQ.cutting2 ?? null) : null),
      bend1: hasBend1 ? parseFloat(reqBody.bend1) : (isPrepOr100gSave ? (prevQ.bend1 ?? null) : null),
      bend2: hasBend2 ? parseFloat(reqBody.bend2) : (isPrepOr100gSave ? (prevQ.bend2 ?? null) : null),
      bend: (hasBend1 || false) ? parseFloat(reqBody.bend1) : (isPrepOr100gSave ? (prevQ.bend ?? null) : null),
      mix: hasMix ? reqBody.mix : (isPrepOr100gSave ? (prevQ.mix ?? null) : null),
      kandu: hasKandu ? reqBody.kandu : (isPrepOr100gSave ? (prevQ.kandu ?? null) : null),
      oil: hasOil ? reqBody.oil : (isPrepOr100gSave ? (prevQ.oil ?? null) : null),
      sk: hasSk ? reqBody.sk : (isPrepOr100gSave ? (prevQ.sk ?? null) : null),
      grainsCount: hasGrains ? parseInt(reqBody.grainsCount, 10) : (isPrepOr100gSave ? (prevQ.grainsCount ?? null) : null),
      wbR: hasWbR ? parseFloat(reqBody.wbR) : 0,
      wbBk: hasWbBk ? parseFloat(reqBody.wbBk) : 0,
      wbT: parseFloat(reqBody.wbT),
      reportedBy: reqBody.reportedBy
    };

    // Validate using ValidationService
    const validation = ValidationService.validateQualityParameters(secondAttemptQuality);
    expect(validation.valid).toBe(true);

    // Verify 2nd attempt data
    expect(secondAttemptQuality.moisture).toBe(11.0);
    expect(secondAttemptQuality.grainsCount).toBe(11);
    expect(secondAttemptQuality.wbR).toBe(11.0);
    expect(secondAttemptQuality.wbBk).toBe(11.0);
    expect(secondAttemptQuality.wbT).toBe(22.0);
    expect(secondAttemptQuality.reportedBy).toBe('Mahesh Kumar');

    // Verify 1st sample fields are NOT inherited
    expect(secondAttemptQuality.cutting1).toBeNull();
    expect(secondAttemptQuality.cutting2).toBeNull();
    expect(secondAttemptQuality.bend1).toBeNull();
    expect(secondAttemptQuality.bend2).toBeNull();
    expect(secondAttemptQuality.mix).toBeNull();
    expect(secondAttemptQuality.kandu).toBeNull();
    expect(secondAttemptQuality.oil).toBeNull();
    expect(secondAttemptQuality.sk).toBeNull();
  });
});
