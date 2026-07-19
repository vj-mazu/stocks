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

    const updateInspection = (inspection: any) => {
      if (!inspection || String(inspection.id) !== targetId) {
        return inspection;
      }

      return {
        ...inspection,
        lorryTransitDetail: {
          ...(inspection.lorryTransitDetail || {}),
          ...saveData,
          wbStatus: saveData.wbStatus || inspection.lorryTransitDetail?.wbStatus || 'pending'
        }
      };
    };

    const currentPhysicalInspections = Array.isArray(entry.physicalInspections)
      ? entry.physicalInspections.map(updateInspection)
      : entry.physicalInspections;

    if (currentPhysicalInspections !== entry.physicalInspections) {
      return {
        ...entry,
        physicalInspections: currentPhysicalInspections
      };
    }

    const lotAllotment = entry.lotAllotment && typeof entry.lotAllotment === 'object' ? entry.lotAllotment : null;
    const currentLotInspections = Array.isArray(lotAllotment?.physicalInspections)
      ? lotAllotment.physicalInspections.map(updateInspection)
      : lotAllotment?.physicalInspections;

    if (currentLotInspections !== lotAllotment?.physicalInspections) {
      return {
        ...entry,
        lotAllotment: {
          ...lotAllotment,
          physicalInspections: currentLotInspections
        }
      };
    }

    return entry;
  });
};
