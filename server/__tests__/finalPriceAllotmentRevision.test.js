const SampleEntryService = require('../services/SampleEntryService');
const SampleEntryOffering = require('../models/SampleEntryOffering');
const LotAllotment = require('../models/LotAllotment');
const User = require('../models/User');

jest.mock('../repositories/SampleEntryRepository', () => ({
  findById: jest.fn(async () => ({
    id: 'test-entry-id',
    workflowStatus: 'FINAL_REPORT',
    lotSelectionDecision: 'PASS'
  })),
  update: jest.fn()
}));

describe('Final Price Allotment Revision Logic', () => {
  let mockOffering;

  beforeEach(() => {
    mockOffering = {
      sampleEntryId: 'test-entry-id',
      offerVersions: [{ key: 'offer1', offerBaseRateValue: 2400 }],
      activeOfferKey: 'offer1',
      hamali: 10,
      lf: 40,
      disputeVersions: [],
      update: jest.fn().mockResolvedValue(true)
    };
    
    jest.spyOn(SampleEntryOffering, 'findOne').mockResolvedValue(mockOffering);
    jest.spyOn(SampleEntryOffering, 'create').mockResolvedValue(mockOffering);
    jest.spyOn(User, 'findByPk').mockResolvedValue({ id: 1, username: 'admin', fullName: 'Admin User' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does NOT add a revised HM/LF version if the lot is NOT allotted for loading', async () => {
    jest.spyOn(LotAllotment, 'findOne').mockResolvedValue(null);

    const payload = {
      finalBaseRate: 2400,
      hamali: 9, 
      lf: 35, 
      isFinalized: true
    };

    await SampleEntryService.setFinalPrice('test-entry-id', payload, 1, 'admin');

    expect(mockOffering.update).toHaveBeenCalled();
    const updatedFields = mockOffering.update.mock.calls[0][0];
    expect(updatedFields.disputeVersions).toBeUndefined();
  });

  test('DOES add a revised HM/LF version if the lot IS allotted for loading', async () => {
    jest.spyOn(LotAllotment, 'findOne').mockResolvedValue({ id: 'allot-1' });

    const payload = {
      finalBaseRate: 2400,
      revisedHamali: 9,
      revisedLf: 35,
      isFinalized: true
    };

    await SampleEntryService.setFinalPrice('test-entry-id', payload, 1, 'admin');

    expect(mockOffering.update).toHaveBeenCalled();
    const updatedFields = mockOffering.update.mock.calls[0][0];

    expect(updatedFields.disputeVersions).toBeDefined();
    expect(updatedFields.disputeVersions.length).toBe(1);
    expect(updatedFields.disputeVersions[0].type).toBe('revision');
    expect(updatedFields.disputeVersions[0].revisedHamali).toBe(9);
    expect(updatedFields.disputeVersions[0].revisedLf).toBe(35);
  });

  test('adds ONLY a dispute version when approving a manager dispute request', async () => {
    jest.spyOn(LotAllotment, 'findOne').mockResolvedValue({ id: 'allot-1' });

    const payload = {
      disputeBaseRate: 2500,
      disputeBaseRateType: 'PD_WB',
      disputeReason: 'Market difference',
      requestId: 'req-dispute-1',
      __requestType: 'dispute',
      // revised values might still be present in payload from default form values
      revisedHamali: 10,
      revisedLf: 40
    };

    await SampleEntryService.setFinalPrice('test-entry-id', payload, 1, 'admin');

    expect(mockOffering.update).toHaveBeenCalled();
    const updatedFields = mockOffering.update.mock.calls[0][0];

    expect(updatedFields.disputeVersions).toBeDefined();
    expect(updatedFields.disputeVersions.length).toBe(1);
    expect(updatedFields.disputeVersions[0].type).toBe('dispute');
    expect(updatedFields.disputeVersions[0].disputeBaseRate).toBe(2500);
    expect(updatedFields.disputeVersions[0].revisedHamali).toBeNull();
    expect(updatedFields.disputeVersions[0].revisedLf).toBeNull();
  });

  test('adds ONLY a revision version when approving a manager revision request', async () => {
    jest.spyOn(LotAllotment, 'findOne').mockResolvedValue({ id: 'allot-1' });

    const payload = {
      revisedHamali: 12,
      revisedLf: 45,
      requestId: 'req-revision-1',
      __requestType: 'revision'
    };

    await SampleEntryService.setFinalPrice('test-entry-id', payload, 1, 'admin');

    expect(mockOffering.update).toHaveBeenCalled();
    const updatedFields = mockOffering.update.mock.calls[0][0];

    expect(updatedFields.disputeVersions).toBeDefined();
    expect(updatedFields.disputeVersions.length).toBe(1);
    expect(updatedFields.disputeVersions[0].type).toBe('revision');
    expect(updatedFields.disputeVersions[0].revisedHamali).toBe(12);
    expect(updatedFields.disputeVersions[0].revisedLf).toBe(45);
    expect(updatedFields.disputeVersions[0].disputeBaseRate).toBeNull();
  });
});
