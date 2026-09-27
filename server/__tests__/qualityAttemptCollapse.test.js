jest.mock('../repositories/QualityParametersRepository', () => ({
  findBySampleEntryId: jest.fn(),
  update: jest.fn()
}));

jest.mock('../services/ValidationService', () => ({
  validateQualityParameters: jest.fn(() => ({ valid: true, errors: [] }))
}));

jest.mock('../services/AuditService', () => ({
  logUpdate: jest.fn(),
  logCreate: jest.fn()
}));

jest.mock('../repositories/SampleEntryRepository', () => ({
  findById: jest.fn(),
  update: jest.fn()
}));

jest.mock('../services/WorkflowEngine', () => ({
  transitionTo: jest.fn()
}));

jest.mock('../utils/historyUtil', () => ({
  attachLoadingLotsHistories: jest.fn(async (rows) => rows)
}));

const QualityParametersRepository = require('../repositories/QualityParametersRepository');
const SampleEntryRepository = require('../repositories/SampleEntryRepository');
const QualityParametersService = require('../services/QualityParametersService');

const twoAttemptEntry = () => ({
  id: 'entry-1',
  workflowStatus: 'COOKING_REPORT',
  lotSelectionDecision: 'PASS_WITH_COOKING',
  qualityAttemptDetails: [
    {
      attemptNo: 1,
      reportedBy: 'Staff User',
      moisture: 14.2,
      moistureRaw: '14.2',
      wbR: 0,
      wbRRaw: '',
      wbBk: 0,
      wbBkRaw: ''
    },
    {
      attemptNo: 2,
      reportedBy: 'Staff User',
      moisture: 14.2,
      moistureRaw: '14.2',
      wbR: 65,
      wbRRaw: '65',
      wbBk: 10,
      wbBkRaw: '10'
    }
  ]
});

describe('QualityParametersService.updateQualityParameters attempt snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QualityParametersRepository.findBySampleEntryId.mockResolvedValue({ id: 9, sampleEntryId: 'entry-1' });
    QualityParametersRepository.update.mockImplementation((id, data) => ({ id, ...data }));
  });

  test('collapses a stale phantom 2nd sample into attempt 1 on a non-resample save', async () => {
    SampleEntryRepository.findById.mockResolvedValue(twoAttemptEntry());

    await QualityParametersService.updateQualityParameters(
      9,
      { sampleEntryId: 'entry-1', moisture: 14.2, wbR: 65, wbRRaw: '65', wbBk: 10, wbBkRaw: '10' },
      1,
      undefined,
      { createNewAttempt: false, collapseAttempts: true }
    );

    const [, payload] = SampleEntryRepository.update.mock.calls[0];
    expect(payload.qualityAttemptDetails).toHaveLength(1);
    expect(payload.qualityAttemptDetails[0]).toMatchObject({ attemptNo: 1, wbRRaw: '65', wbBkRaw: '10' });
    expect(payload.qualityReportAttempts).toBe(1);
  });

  test('keeps two attempts (updating attempt 2) when a resample flow is present', async () => {
    SampleEntryRepository.findById.mockResolvedValue(twoAttemptEntry());

    await QualityParametersService.updateQualityParameters(
      9,
      { sampleEntryId: 'entry-1', moisture: 15.1, wbR: 70, wbRRaw: '70', wbBk: 12, wbBkRaw: '12' },
      1,
      undefined,
      { createNewAttempt: false, collapseAttempts: false }
    );

    const [, payload] = SampleEntryRepository.update.mock.calls[0];
    expect(payload.qualityAttemptDetails).toHaveLength(2);
    expect(payload.qualityAttemptDetails[1]).toMatchObject({ attemptNo: 2, wbRRaw: '70', wbBkRaw: '12' });
    expect(payload.qualityReportAttempts).toBe(2);
  });

  test('creates attempt 2 when a resample is actually initiated', async () => {
    SampleEntryRepository.findById.mockResolvedValue({
      id: 'entry-1',
      qualityAttemptDetails: [{ attemptNo: 1, moisture: 14.2, moistureRaw: '14.2' }]
    });

    await QualityParametersService.updateQualityParameters(
      9,
      { sampleEntryId: 'entry-1', moisture: 16, wbR: 70 },
      1,
      undefined,
      { createNewAttempt: true }
    );

    const [, payload] = SampleEntryRepository.update.mock.calls[0];
    expect(payload.qualityAttemptDetails).toHaveLength(2);
    expect(payload.qualityAttemptDetails[0]).toMatchObject({ attemptNo: 1 });
    expect(payload.qualityAttemptDetails[1]).toMatchObject({ attemptNo: 2 });
    expect(payload.qualityReportAttempts).toBe(2);
  });
});
