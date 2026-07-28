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
});
