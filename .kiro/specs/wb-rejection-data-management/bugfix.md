# Bugfix Requirements Document

## Introduction

This document addresses critical data management issues in the Weight Bridge (WB) approval workflow within the arrivals system. The current implementation has three major problems: rejected WB data pollutes the database, users cannot see rejection reasons, and duplicate WB entries can be created across different tabs. These issues compromise data integrity, user experience, and workflow efficiency.

## Bug Analysis

### 1. Current Behavior (Defect)

1.1 WHEN a WB submission is created with wbStatus='pending' THEN the system immediately saves all weight data to the lorry_transit_details table

1.2 WHEN an approver rejects a WB submission THEN the system updates wbStatus to 'rejected' and saves wbRejectReason but leaves all weight data in the lorry_transit_details table

1.3 WHEN rejected WB data remains in the lorry_transit_details table THEN the database contains invalid/rejected data that pollutes the main operational table

1.4 WHEN a user opens the Sample Entry Detail Modal for a lorry with rejected WB THEN the system does not display the wbRejectReason field

1.5 WHEN a user cannot see the rejection reason THEN they do not understand why their WB submission was rejected or what needs to be corrected

1.6 WHEN a user adds WB data in the In-Transit tab THEN the system saves millWbId or wbNo to the lorry record

1.7 WHEN the same user navigates to the Band Malal Book tab for the same lorry THEN the system still displays the "Add WB" button

1.8 WHEN the user clicks "Add WB" in Band Malal Book after already adding WB in In-Transit THEN the system allows duplicate WB submission for the same lorry

### 2. Expected Behavior (Correct)

2.1 WHEN a WB submission is created with wbStatus='pending' THEN the system SHALL save the weight data to a separate pending_wb_submissions table, not to lorry_transit_details

2.2 WHEN an approver rejects a WB submission THEN the system SHALL either delete the pending record or move it to a rejected_wb_submissions audit table with the wbRejectReason

2.3 WHEN the lorry_transit_details table stores WB data THEN it SHALL contain only approved WB data (wbStatus='approved')

2.4 WHEN a user opens the Sample Entry Detail Modal for a lorry with rejected WB THEN the system SHALL display the wbRejectReason prominently (as a new column in the WB table or as a red alert below the rejected WB row)

2.5 WHEN a rejection reason is displayed THEN users SHALL be able to understand why their submission was rejected and what corrections are needed

2.6 WHEN a user has already added WB data in the In-Transit tab (millWbId or wbNo exists) THEN the system SHALL hide the "Add WB" button in the Band Malal Book tab

2.7 WHEN WB data is rejected (wbStatus='rejected') THEN the system SHALL show the "Add WB" button to allow re-submission with corrections

2.8 WHEN the "Add WB" button logic checks for existing WB THEN it SHALL verify both millWbId and wbNo fields to determine if WB already exists

### 3. Unchanged Behavior (Regression Prevention)

3.1 WHEN a WB submission is approved THEN the system SHALL CONTINUE TO save the weight data to lorry_transit_details with wbStatus='approved'

3.2 WHEN an approver views pending WB submissions in the In-Transit approval queue THEN the system SHALL CONTINUE TO display all pending submissions for review

3.3 WHEN a user adds WB data through the normal workflow THEN the system SHALL CONTINUE TO validate all required fields (weight, wbNo, etc.)

3.4 WHEN the Sample Entry Detail Modal displays approved WB data THEN the system SHALL CONTINUE TO show all weight fields in the WB table

3.5 WHEN a user with appropriate permissions accesses WB functionality THEN the system SHALL CONTINUE TO enforce role-based access controls

3.6 WHEN WB data is displayed in any view THEN the system SHALL CONTINUE TO format weights, dates, and other fields according to existing conventions

3.7 WHEN multiple users work with different lorry records THEN the system SHALL CONTINUE TO maintain data isolation and prevent cross-contamination

3.8 WHEN the system performs any WB operations THEN it SHALL CONTINUE TO maintain referential integrity with related tables (lorries, mills, users)
