import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

jest.mock('../config/api', () => ({
  API_URL: '/api',
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SampleEntryDetailModal smell history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: { users: [] } } as any);
  });

  test('keeps latest smell in header but does not backfill it into older attempts', () => {
    render(
      <SampleEntryDetailModal
        detailEntry={{
          id: '1',
          entryDate: '2026-04-07',
          createdAt: '2026-04-07T12:00:00Z',
          brokerName: 'Veeresh',
          variety: 'Sum25 Rnr',
          partyName: 'Xyz',
          location: 'Abc',
          bags: 500,
          packaging: '75 Kg',
          entryType: 'LOCATION_SAMPLE',
          sampleCollectedBy: 'Broker Office Sample',
          workflowStatus: 'QUALITY_CHECK',
          smellHas: true,
          smellType: 'LIGHT',
          qualityParameters: {
            moisture: 11.25,
            cutting1: 1,
            cutting2: 11.2,
            bend: 0,
            bend1: 1,
            bend2: 11.2,
            mixS: 0,
            mixL: 0,
            mix: 11.25,
            kandu: 11.25,
            oil: 11.25,
            sk: 11.25,
            grainsCount: 115,
            wbR: 11.25,
            wbBk: 11.25,
            wbT: 22.5,
            paddyWb: 11.25,
            smellHas: true,
            smellType: 'LIGHT',
            reportedBy: 'Manjunath Patil',
          },
          qualityAttemptDetails: [
            {
              attemptNo: 1,
              moisture: 11,
              moistureRaw: '11',
              cutting1: 1,
              cutting1Raw: '1',
              cutting2: 11,
              cutting2Raw: '11',
              bend1: 1,
              bend1Raw: '1',
              bend2: 11,
              bend2Raw: '11',
              grainsCount: 11,
              grainsCountRaw: '11',
              mix: 11,
              mixRaw: '11',
              kandu: 11,
              kanduRaw: '11',
              oil: 11,
              oilRaw: '11',
              sk: 11,
              skRaw: '11',
              smellHas: false,
              smellType: '',
              reportedBy: 'Manjunath Patil',
              updatedAt: '2026-04-07T12:32:00Z',
            },
            {
              attemptNo: 2,
              moisture: 11.25,
              moistureRaw: '11.25',
              cutting1: 1,
              cutting1Raw: '1',
              cutting2: 11.2,
              cutting2Raw: '11.2',
              bend1: 1,
              bend1Raw: '1',
              bend2: 11.2,
              bend2Raw: '11.2',
              grainsCount: 115,
              grainsCountRaw: '115',
              mix: 11.25,
              mixRaw: '11.25',
              kandu: 11.25,
              kanduRaw: '11.25',
              oil: 11.25,
              oilRaw: '11.25',
              sk: 11.25,
              skRaw: '11.25',
              smellHas: true,
              smellType: 'LIGHT',
              reportedBy: 'Manjunath Patil',
              updatedAt: '2026-04-07T12:47:00Z',
            },
          ],
        } as any}
        detailMode="quick"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('LIGHT Smell')).toBeInTheDocument();

    const firstRow = screen.getByText('1st Sample').closest('tr');
    const secondRow = screen.getByText('2nd Sample').closest('tr');

    expect(firstRow).not.toBeNull();
    expect(secondRow).not.toBeNull();

    expect(within(firstRow as HTMLTableRowElement).queryByText('LIGHT')).not.toBeInTheDocument();
    expect(within(firstRow as HTMLTableRowElement).getAllByText('-').length).toBeGreaterThan(0);
    expect(within(secondRow as HTMLTableRowElement).getByText('LIGHT')).toBeInTheDocument();
  });
});
