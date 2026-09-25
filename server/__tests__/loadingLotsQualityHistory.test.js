jest.mock('../models/SampleEntryAuditLog', () => ({
  findAll: jest.fn()
}));

const SampleEntryAuditLog = require('../models/SampleEntryAuditLog');
const { attachLoadingLotsHistories } = require('../utils/historyUtil');

describe('attachLoadingLotsHistories', () => {
  beforeEach(() => {
    SampleEntryAuditLog.findAll.mockReset();
    SampleEntryAuditLog.findAll.mockResolvedValue([]);
  });

  it('merges a more complete live quality row into the latest persisted attempt', async () => {
    const rows = [{
      id: 101,
      createdAt: '2026-04-08T10:00:00.000Z',
      sampleCollectedBy: 'Broker Office Sample',
      lotSelectionAt: '2026-04-08T10:00:00.000Z',
      qualityParameters: {
        id: 501,
        reportedBy: 'Nitish Kumar',
        moisture: '12',
        moistureRaw: '12',
        grainsCount: '10',
        grainsCountRaw: '10',
        cutting1: '1',
        cutting1Raw: '1',
        cutting2: '10',
        cutting2Raw: '10',
        bend1: '1',
        bend1Raw: '1',
        bend2: '10',
        bend2Raw: '10',
        mix: '10',
        mixRaw: '10',
        updatedAt: '2026-04-08T10:06:00.000Z',
        createdAt: '2026-04-08T10:05:00.000Z'
      },
      qualityAttemptDetails: [
        {
          attemptNo: 1,
          reportedBy: 'Manjunath Patil',
          moisture: '10',
          moistureRaw: '10',
          grainsCount: '10',
          grainsCountRaw: '10',
          cutting1: '1',
          cutting1Raw: '1',
          cutting2: '11',
          cutting2Raw: '11',
          bend1: '1',
          bend1Raw: '1',
          bend2: '11',
          bend2Raw: '11',
          mix: '11',
          mixRaw: '11',
          createdAt: '2026-04-08T10:01:00.000Z'
        },
        {
          attemptNo: 2,
          reportedBy: '',
          moisture: '12',
          moistureRaw: '12',
          grainsCount: '10',
          grainsCountRaw: '10',
          createdAt: '2026-04-08T10:05:00.000Z'
        }
      ],
      sampleCollectedHistory: ['Broker Office Sample', 'Manjunath Patil']
    }];

    const [entry] = await attachLoadingLotsHistories(rows);

    expect(entry.qualityAttemptDetails).toHaveLength(2);
    expect(entry.qualityAttemptDetails[1]).toMatchObject({
      attemptNo: 2,
      reportedBy: 'Nitish Kumar',
      mixRaw: '10',
      cutting1Raw: '1',
      bend1Raw: '1'
    });
  });

  it('updates attempt 1 in place and does NOT create attempt 2 when editing WB-R / WB-BK on 1st sample', async () => {
    const rows = [{
      id: 202,
      createdAt: '2026-04-08T10:00:00.000Z',
      lotSelectionDecision: 'PASS_WITH_COOKING',
      sampleCollectedBy: 'Broker Office Sample',
      lotSelectionAt: '2026-04-08T10:05:00.000Z',
      qualityParameters: {
        id: 502,
        reportedBy: 'Staff User',
        moisture: '14.2',
        moistureRaw: '14.2',
        grainsCount: '280',
        grainsCountRaw: '280',
        cutting1: '15',
        cutting1Raw: '15',
        cutting2: '25',
        cutting2Raw: '25',
        bend1: '3',
        bend1Raw: '3',
        bend2: '4',
        bend2Raw: '4',
        mix: '3',
        mixRaw: '3',
        wbR: '65',
        wbRRaw: '65',
        wbBk: '10',
        wbBkRaw: '10',
        wbT: '75',
        wbTRaw: '75',
        updatedAt: '2026-04-08T10:15:00.000Z',
        createdAt: '2026-04-08T10:00:00.000Z'
      },
      qualityAttemptDetails: [
        {
          attemptNo: 1,
          reportedBy: 'Staff User',
          moisture: '14.2',
          moistureRaw: '14.2',
          grainsCount: '280',
          grainsCountRaw: '280',
          cutting1: '15',
          cutting1Raw: '15',
          cutting2: '25',
          cutting2Raw: '25',
          bend1: '3',
          bend1Raw: '3',
          bend2: '4',
          bend2Raw: '4',
          mix: '3',
          mixRaw: '3',
          wbR: 0,
          wbRRaw: '',
          wbBk: 0,
          wbBkRaw: '',
          wbT: 0,
          wbTRaw: '',
          createdAt: '2026-04-08T10:00:00.000Z'
        }
      ]
    }];

    const [entry] = await attachLoadingLotsHistories(rows);

    expect(entry.qualityAttemptDetails).toHaveLength(1);
    expect(entry.qualityAttemptDetails[0]).toMatchObject({
      attemptNo: 1,
      wbRRaw: '65',
      wbBkRaw: '10',
      wbTRaw: '75',
      cutting1Raw: '15',
      bend1Raw: '3'
    });
  });
});
