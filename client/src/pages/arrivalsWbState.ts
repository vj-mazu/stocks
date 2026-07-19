export const applyWbSaveToEntries = (
  entries: any[],
  inspectionId: string | number | null | undefined,
  saveData: Record<string, any> = {}
) => {
  if (!inspectionId) {
    return entries;
  }

  const targetId = String(inspectionId);

  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    const mergedEntryData = {
      ...entry,
      ...saveData,
      wbStatus: saveData.wbStatus || entry.wbStatus || 'pending',
      wbNo: saveData.wbNo ?? entry.wbNo,
      netWeight: saveData.netWeight ?? entry.netWeight,
      partyWbName: saveData.partyWbName ?? entry.partyWbName,
      wbInputType: saveData.wbInputType ?? entry.wbInputType,
      millWbId: saveData.millWbId ?? entry.millWbId,
      grossWeight: saveData.grossWeight ?? entry.grossWeight,
      tareWeight: saveData.tareWeight ?? entry.tareWeight
    };

    const updateInspection = (inspection: any) => {
      if (!inspection || String(inspection.id) !== targetId) {
        return inspection;
      }

      return {
        ...inspection,
        lorryTransitDetail: {
          ...(inspection.lorryTransitDetail || {}),
          ...saveData,
          wbStatus: saveData.wbStatus || inspection.lorryTransitDetail?.wbStatus || entry.wbStatus || 'pending',
          wbNo: saveData.wbNo ?? inspection.lorryTransitDetail?.wbNo ?? entry.wbNo,
          netWeight: saveData.netWeight ?? inspection.lorryTransitDetail?.netWeight ?? entry.netWeight,
          partyWbName: saveData.partyWbName ?? inspection.lorryTransitDetail?.partyWbName ?? entry.partyWbName,
          wbInputType: saveData.wbInputType ?? inspection.lorryTransitDetail?.wbInputType ?? entry.wbInputType,
          millWbId: saveData.millWbId ?? inspection.lorryTransitDetail?.millWbId ?? entry.millWbId,
          grossWeight: saveData.grossWeight ?? inspection.lorryTransitDetail?.grossWeight ?? entry.grossWeight,
          tareWeight: saveData.tareWeight ?? inspection.lorryTransitDetail?.tareWeight ?? entry.tareWeight
        }
      };
    };

    const currentPhysicalInspections = Array.isArray(entry.physicalInspections)
      ? entry.physicalInspections.map(updateInspection)
      : entry.physicalInspections;

    if (currentPhysicalInspections !== entry.physicalInspections) {
      return {
        ...mergedEntryData,
        physicalInspections: currentPhysicalInspections
      };
    }

    const lotAllotment = entry.lotAllotment && typeof entry.lotAllotment === 'object' ? entry.lotAllotment : null;
    const currentLotInspections = Array.isArray(lotAllotment?.physicalInspections)
      ? lotAllotment.physicalInspections.map(updateInspection)
      : lotAllotment?.physicalInspections;

    if (currentLotInspections !== lotAllotment?.physicalInspections) {
      return {
        ...mergedEntryData,
        lotAllotment: {
          ...lotAllotment,
          physicalInspections: currentLotInspections
        }
      };
    }

    return mergedEntryData;
  });
};
