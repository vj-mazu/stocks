import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn()
  }
}));

const mockedAxios = require('axios').default as {
  get: jest.Mock;
  put: jest.Mock;
};

describe('SampleEntryDetailModal history quality table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: [] });
  });

  it('shows dry moisture above moisture in quality history rows when present', async () => {
    render(
      <SampleEntryDetailModal
        detailMode="history"
        onClose={() => {}}
        detailEntry={{
          id: '1',
          entryDate: '2026-04-04',
          createdAt: '2026-04-04T10:00:00.000Z',
          brokerName: 'Veeresh',
          variety: 'Sum25 Rnr',
          partyName: 'Sharanu',
          location: 'Kytl',
          bags: 500,
          packaging: '75',
          entryType: 'LOCATION_SAMPLE',
          sampleCollectedBy: 'Broker Office Sample',
          workflowStatus: 'QUALITY_CHECK',
          qualityAttemptDetails: [
            {
              attemptNo: 1,
              reportedBy: 'Manjunath Patil',
              createdAt: '2026-04-04T11:42:00.000Z',
              updatedAt: '2026-04-04T11:42:00.000Z',
              moistureRaw: '13',
              moisture: 13,
              grainsCountRaw: '133',
              grainsCount: 133
            },
            {
              attemptNo: 2,
              reportedBy: 'Manjunath Patil',
              createdAt: '2026-04-04T11:56:00.000Z',
              updatedAt: '2026-04-04T11:56:00.000Z',
              moistureRaw: '13',
              moisture: 13,
              dryMoistureRaw: '17',
              dryMoisture: 17,
              grainsCountRaw: '13',
              grainsCount: 13
            }
          ]
        } as any}
      />
    );

    expect(await screen.findByText('2nd Sample')).toBeInTheDocument();
    expect(screen.getAllByText('13%').length).toBeGreaterThan(0);
    expect(screen.getByText('17%')).toBeInTheDocument();
  });
});
