const CookingReportRepository = require('../repositories/CookingReportRepository');
const SampleEntryRepository = require('../repositories/SampleEntryRepository');
const AuditService = require('./AuditService');
const WorkflowEngine = require('./WorkflowEngine');

class CookingReportService {
  /**
   * Create cooking report
   * @param {Object} reportData - Cooking report data
   * @param {number} userId - User ID creating the report
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Created cooking report
   */
  async createCookingReport(reportData, userId, userRole) {
    try {
      // Validate required fields
      if (!reportData.sampleEntryId) {
        throw new Error('Sample entry ID is required');
      }

      // Validate status
      const validStatuses = ['PASS', 'FAIL', 'RECHECK', 'MEDIUM'];
      if (reportData.status && !validStatuses.includes(reportData.status)) {
        throw new Error('Invalid cooking report status');
      }

      reportData.reviewedByUserId = userId;

      // Check if report already exists (Upsert logic)
      const existing = await CookingReportRepository.findBySampleEntryId(reportData.sampleEntryId);

      let report;
      let historyDate = new Date();
      if (reportData.manualDate) {
        const manual = new Date(reportData.manualDate);
        historyDate.setFullYear(manual.getFullYear(), manual.getMonth(), manual.getDate());
      }
      const historyEntry = {
        date: historyDate.toISOString(),
        status: reportData.status || null,
        cookingDoneBy: reportData.cookingDoneBy || null,
        approvedBy: reportData.cookingApprovedBy || null,
        remarks: reportData.remarks || null,
      };

      const hasSameHistoryPayload = (left, right) => (
        String(left?.status || '') === String(right?.status || '')
        && String(left?.cookingDoneBy || '') === String(right?.cookingDoneBy || '')
        && String(left?.approvedBy || '') === String(right?.approvedBy || '')
        && String(left?.remarks || '') === String(right?.remarks || '')
      );

      const hasPendingCookingDone = (item) => !!item?.cookingDoneBy && !item?.status;

      if (existing) {
        console.log(`[COOKING] Updating existing cooking report for sample entry: ${reportData.sampleEntryId}`);
        const updates = { ...reportData };
        if (!updates.status) {
          updates.status = null;
        }

        const currentHistory = Array.isArray(existing.history) ? existing.history : [];
        const lastHistory = currentHistory[currentHistory.length - 1] || null;

        if (reportData.status) {
          let pendingIndex = -1;
          for (let idx = currentHistory.length - 1; idx >= 0; idx -= 1) {
            if (hasPendingCookingDone(currentHistory[idx])) {
              pendingIndex = idx;
              break;
            }
            if (currentHistory[idx]?.status) {
              break;
            }
          }

          if (pendingIndex >= 0) {
            const mergedHistory = [...currentHistory];
            const basePending = mergedHistory[pendingIndex] || {};
            const mergedStatusRow = {
              ...basePending,
              date: historyEntry.date,
              status: historyEntry.status,
              approvedBy: historyEntry.approvedBy,
              remarks: historyEntry.remarks
            };

            if (hasSameHistoryPayload(basePending, mergedStatusRow)) {
              updates.history = currentHistory;
            } else {
              mergedHistory[pendingIndex] = mergedStatusRow;
              updates.history = mergedHistory;
            }
          } else if (lastHistory && hasSameHistoryPayload(lastHistory, historyEntry)) {
            updates.history = currentHistory;
          } else {
            updates.history = [...currentHistory, historyEntry];
          }
        } else if (lastHistory && hasSameHistoryPayload(lastHistory, historyEntry)) {
          updates.history = currentHistory;
        } else {
          updates.history = [...currentHistory, historyEntry];
        }

        report = await CookingReportRepository.update(existing.id, updates);
        await AuditService.logUpdate(userId, 'cooking_reports', report.id, existing, report);
      } else {
        console.log(`[COOKING] Creating new cooking report for sample entry: ${reportData.sampleEntryId}`);
        if (!reportData.status) {
          reportData.status = null;
        }
        reportData.history = [historyEntry];
        report = await CookingReportRepository.create(reportData);
        await AuditService.logCreate(userId, 'cooking_reports', report.id, report);
      }

      // Transition workflow based on status
      const currentStatus = reportData.status || null;
      if (currentStatus) {
        const sampleEntry = await SampleEntryRepository.findById(reportData.sampleEntryId);
        const currentDecision = String(sampleEntry?.lotSelectionDecision || '').toUpperCase();
        const originDecision = String(sampleEntry?.resampleOriginDecision || '').toUpperCase();
        const isResampleFlow =
          currentDecision === 'FAIL'
          || originDecision === 'PASS_WITH_COOKING'
          || Boolean(sampleEntry?.resampleTriggerRequired)
          || Boolean(sampleEntry?.resampleTriggeredAt)
          || Boolean(sampleEntry?.resampleDecisionAt)
          || Boolean(sampleEntry?.resampleAfterFinal)
          || Boolean(sampleEntry?.resampleStartAt)
          || Number(sampleEntry?.qualityReportAttempts || 0) > 1;
        let nextStatus = null;

        if (currentStatus === 'PASS' || currentStatus === 'MEDIUM') {
          if (isResampleFlow) {
            const isTriggeredResampleAwaitingDecision =
              Boolean(sampleEntry?.resampleTriggeredAt)
              && !sampleEntry?.resampleDecisionAt;

            if (isTriggeredResampleAwaitingDecision) {
              nextStatus = null;
            } else
            // Re-sample should not go back to pending sample selection.
            if (sampleEntry?.workflowStatus === 'LOT_ALLOTMENT') {
              nextStatus = null;
            } else if (sampleEntry?.workflowStatus === 'STAFF_ENTRY') {
              // Quality may not be saved yet, keep this entry in quality stage.
              nextStatus = 'QUALITY_CHECK';
            } else {
              // Re-sample quality+cooking approved: move directly to final stage.
              nextStatus = 'FINAL_REPORT';
            }
          } else {
            // Normal flow.
            nextStatus = 'FINAL_REPORT';
          }
        } else if (currentStatus === 'FAIL') {
          nextStatus = 'FAILED';
        } else {
          // RECHECK - stay in COOKING_REPORT
          return report;
        }

        const currentWorkflowStatus = String(sampleEntry?.workflowStatus || '').toUpperCase();

        if (nextStatus && nextStatus !== currentWorkflowStatus) {
          await WorkflowEngine.transitionTo(
            reportData.sampleEntryId,
            nextStatus,
            userId,
            userRole,
            { cookingReportId: report.id, cookingStatus: currentStatus, resample: isResampleFlow }
          );
        }

        // Auto-skip Final Pass Lots for resample entries that already have offering/final price
        // Scenario 2: Final + Resample — price already decided, skip directly to Loading Lots
        if (
          nextStatus === 'LOT_SELECTION'
          || nextStatus === 'FINAL_REPORT'
          || (isResampleFlow && currentWorkflowStatus === 'FINAL_REPORT' && ['PASS', 'MEDIUM'].includes(String(currentStatus || '').toUpperCase()))
        ) {
          try {
            const SampleEntryOffering = require('../models/SampleEntryOffering');
            const offering = await SampleEntryOffering.findOne({
              where: { sampleEntryId: reportData.sampleEntryId },
              attributes: ['id', 'finalPrice', 'isFinalized', 'offerBaseRateValue'],
              raw: true
            });
            // If offering exists with a finalized price, this is Scenario 2 — auto-skip to LOT_ALLOTMENT
            if (offering && (offering.finalPrice || offering.isFinalized)) {
              console.log(`[COOKING] Auto-skipping Final Pass Lots for resample entry ${reportData.sampleEntryId} — offering already exists`);
              await WorkflowEngine.transitionTo(
                reportData.sampleEntryId,
                'LOT_ALLOTMENT',
                userId,
                userRole,
                { autoSkipFinalPassLots: true, resample: true }
              );
            }
          } catch (skipErr) {
            console.log(`[COOKING] Auto-skip note: ${skipErr.message}`);
          }
        }
      }

      return report;

    } catch (error) {
      console.error('Error creating cooking report:', error);
      throw error;
    }
  }

  /**
   * Get cooking report by sample entry ID
   * @param {number} sampleEntryId - Sample entry ID
   * @returns {Promise<Object|null>} Cooking report or null
   */
  async getCookingReportBySampleEntry(sampleEntryId) {
    return await CookingReportRepository.findBySampleEntryId(sampleEntryId);
  }

  /**
   * Update cooking report
   * @param {number} id - Cooking report ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated cooking report or null
   */
  async updateCookingReport(id, updates, userId) {
    try {
      const current = await CookingReportRepository.findBySampleEntryId(updates.sampleEntryId);
      if (!current) {
        throw new Error('Cooking report not found');
      }

      const updated = await CookingReportRepository.update(id, updates);

      await AuditService.logUpdate(userId, 'cooking_reports', id, current, updated);

      return updated;

    } catch (error) {
      console.error('Error updating cooking report:', error);
      throw error;
    }
  }

  /**
   * Get cooking reports by status
   * @param {string} status - Cooking report status
   * @returns {Promise<Array>} Array of cooking reports
   */
  async getCookingReportsByStatus(status) {
    return await CookingReportRepository.findByStatus(status);
  }
}

module.exports = new CookingReportService();
