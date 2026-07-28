import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { SampleEntryDetailModal } from './SampleEntryDetailModal';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock AuthContext
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', role: 'admin' }
  })
}));

// Mock toast
jest.mock('../utils/toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

describe('SampleEntryDetailModal - Bug Condition Exploration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * Property 1: Bug Condition - Display Closed Reason When Present
   * 
   * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
   * 
   * This test verifies that for all sample entries where lotAllotment.closedReason
   * is not null and not empty, the Sample Entry Detail Modal displays the 
   * "Lot Closed Reason" field with the correct value.
   * 
   * EXPECTED OUTCOME on unfixed code: TEST FAILS
   * - Modal displays lot information but omits closedReason field
   * - TypeScript may show compile errors if interface is missing the field
   * - The "Lot Closed Reason" label is not found in the rendered output
   */
  it('Property 1: should display Lot Closed Reason field when closedReason is present', async () => {
    // Scoped PBT Approach: Generate various closedReason values
    const closedReasonArbitrary = fc.oneof(
      fc.constant('Party only sent 2000 of 4000 bags'),
      fc.constant('Lot marked as completed by manager'),
      fc.constant('Manager decided to close early due to quality issues'),
      // Long reason with 100+ characters
      fc.constant('This is a very long closure reason that exceeds 100 characters to test text wrapping and overflow handling in the UI component to ensure it displays properly without breaking the layout or causing visual issues')
    );

    await fc.assert(
      fc.asyncProperty(closedReasonArbitrary, async (closedReason) => {
        // Create a sample entry with non-empty closedReason
        const sampleEntry = {
          id: '123',
          serialNo: 1,
          entryDate: '2024-01-15',
          createdAt: '2024-01-15T10:00:00Z',
          brokerName: 'Test Broker',
          variety: 'Basmati',
          partyName: 'Test Party',
          location: 'Test Location',
          bags: 100,
          workflowStatus: 'completed',
          lotAllotment: {
            id: 1,
            allottedBags: 50,
            closedAt: '2024-01-16T14:30:00Z',
            closedReason: closedReason, // This is the key field being tested
            allottedToSupervisorId: 1,
            supervisor: {
              id: 1,
              username: 'supervisor1',
              fullName: 'Test Supervisor',
              role: 'supervisor'
            },
            manager: {
              id: 2,
              username: 'manager1',
              fullName: 'Test Manager'
            }
          }
        };

        const { container, unmount } = render(
          <SampleEntryDetailModal
            detailEntry={sampleEntry as any}
            detailMode="full"
            onClose={jest.fn()}
          />
        );

        // Wait for modal to render
        await waitFor(() => {
          expect(container.querySelector('.modal') || container.firstChild).toBeInTheDocument();
        });

        // ASSERTION 1: The "Lot Closed Reason" label should be present in the modal
        // On unfixed code, this will FAIL because the field is not rendered
        const closedReasonLabel = screen.queryByText(/Lot Closed Reason/i);
        expect(closedReasonLabel).toBeInTheDocument();

        // ASSERTION 2: The actual closedReason text should be displayed
        // On unfixed code, this will FAIL because the value is not rendered
        const closedReasonValue = screen.queryByText(closedReason);
        expect(closedReasonValue).toBeInTheDocument();

        // ASSERTION 3: The field should be visually distinct (has background styling)
        // Check if the closedReason is displayed with distinctive styling
        const closedReasonElement = closedReasonValue?.closest('div');
        if (closedReasonElement) {
          const styles = window.getComputedStyle(closedReasonElement.parentElement || closedReasonElement);
          // On unfixed code, this will FAIL or not reach this point
          expect(styles.backgroundColor).toBeTruthy();
        }

        unmount();
      }),
      {
        numRuns: 10, // Run 10 test cases with different closedReason values
        verbose: true
      }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * Edge case: Empty string closedReason
   * 
   * This test verifies that when closedReason is an empty string,
   * the "Lot Closed Reason" field should NOT be displayed.
   */
  it('should NOT display Lot Closed Reason field when closedReason is empty string', () => {
    const sampleEntry = {
      id: '124',
      serialNo: 2,
      entryDate: '2024-01-15',
      createdAt: '2024-01-15T10:00:00Z',
      brokerName: 'Test Broker',
      variety: 'Basmati',
      partyName: 'Test Party',
      location: 'Test Location',
      bags: 100,
      workflowStatus: 'completed',
      lotAllotment: {
        id: 2,
        allottedBags: 50,
        closedAt: '2024-01-16T14:30:00Z',
        closedReason: '', // Empty string
        allottedToSupervisorId: 1,
        supervisor: {
          id: 1,
          username: 'supervisor1',
          fullName: 'Test Supervisor',
          role: 'supervisor'
        }
      }
    };

    const { unmount } = render(
      <SampleEntryDetailModal
        detailEntry={sampleEntry as any}
        detailMode="full"
        onClose={jest.fn()}
      />
    );

    // The "Lot Closed Reason" label should NOT be present
    const closedReasonLabel = screen.queryByText(/Lot Closed Reason/i);
    expect(closedReasonLabel).not.toBeInTheDocument();

    unmount();
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * Edge case: null closedReason
   * 
   * This test verifies that when closedReason is null,
   * the "Lot Closed Reason" field should NOT be displayed.
   */
  it('should NOT display Lot Closed Reason field when closedReason is null', () => {
    const sampleEntry = {
      id: '125',
      serialNo: 3,
      entryDate: '2024-01-15',
      createdAt: '2024-01-15T10:00:00Z',
      brokerName: 'Test Broker',
      variety: 'Basmati',
      partyName: 'Test Party',
      location: 'Test Location',
      bags: 100,
      workflowStatus: 'completed',
      lotAllotment: {
        id: 3,
        allottedBags: 50,
        closedAt: null,
        closedReason: null, // Null value
        allottedToSupervisorId: 1,
        supervisor: {
          id: 1,
          username: 'supervisor1',
          fullName: 'Test Supervisor',
          role: 'supervisor'
        }
      }
    };

    const { unmount } = render(
      <SampleEntryDetailModal
        detailEntry={sampleEntry as any}
        detailMode="full"
        onClose={jest.fn()}
      />
    );

    // The "Lot Closed Reason" label should NOT be present
    const closedReasonLabel = screen.queryByText(/Lot Closed Reason/i);
    expect(closedReasonLabel).not.toBeInTheDocument();

    unmount();
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * Edge case: undefined lotAllotment
   * 
   * This test verifies that when lotAllotment is undefined,
   * the modal still renders without crashing.
   */
  it('should render without crashing when lotAllotment is undefined', () => {
    const sampleEntry = {
      id: '126',
      serialNo: 4,
      entryDate: '2024-01-15',
      createdAt: '2024-01-15T10:00:00Z',
      brokerName: 'Test Broker',
      variety: 'Basmati',
      partyName: 'Test Party',
      location: 'Test Location',
      bags: 100,
      workflowStatus: 'pending',
      lotAllotment: undefined // No lot allotment
    };

    const { container, unmount } = render(
      <SampleEntryDetailModal
        detailEntry={sampleEntry as any}
        detailMode="full"
        onClose={jest.fn()}
      />
    );

    // Modal should render
    expect(container.firstChild).toBeInTheDocument();

    // The "Lot Closed Reason" label should NOT be present
    const closedReasonLabel = screen.queryByText(/Lot Closed Reason/i);
    expect(closedReasonLabel).not.toBeInTheDocument();

    unmount();
  });
});
