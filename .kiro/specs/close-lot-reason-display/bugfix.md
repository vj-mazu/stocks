# Bugfix Requirements Document

## Introduction

In the Allotted Loading section, when a manager or admin closes a lot early and provides a reason, that reason is successfully persisted to the `closedReason` field in the `lot_allotments` database table. However, this close lot reason is not displayed anywhere in the UI, leaving users unable to see why a lot was closed after the fact. This bugfix ensures the close lot reason becomes visible in the Sample Entry Detail Modal.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a manager/admin closes a lot early via the Close Lot modal and enters a reason THEN the system saves the reason to `lotAllotment.closedReason` in the database but does not display it in any UI component

1.2 WHEN a user views a closed lot in the Sample Entry Detail Modal THEN the system does not show the `closedReason` value even though it exists in the database

1.3 WHEN the Sample Entry Detail Modal renders lot allotment information THEN the system omits the `closedReason` field from the TypeScript interface definition for `lotAllotment`

### Expected Behavior (Correct)

2.1 WHEN a manager/admin closes a lot early and enters a reason THEN the system SHALL display that reason in the Sample Entry Detail Modal in a new "Close Lot Reason" field

2.2 WHEN a user views a closed lot in the Sample Entry Detail Modal THEN the system SHALL show the close lot reason after the "Final Price Remarks" column (or in the appropriate section of the modal)

2.3 WHEN the Sample Entry Detail Modal fetches lot allotment data THEN the system SHALL include the `closedReason` field in the TypeScript interface and render it in the UI

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a manager/admin closes a lot and enters a reason THEN the system SHALL CONTINUE TO save the reason to the `lotAllotment.closedReason` field in the database

3.2 WHEN a lot has not been closed early THEN the system SHALL CONTINUE TO not display any close lot reason field (or display it as empty/null)

3.3 WHEN the Sample Entry Detail Modal displays other lot allotment information (allotted bags, supervisor, manager, etc.) THEN the system SHALL CONTINUE TO display those fields correctly without modification

3.4 WHEN the Close Lot modal accepts reason input THEN the system SHALL CONTINUE TO function as it currently does for accepting and saving the reason
