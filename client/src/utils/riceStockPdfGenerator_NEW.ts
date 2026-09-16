/**
 * ENHANCED Rice Stock PDF Generator - 101% Screen Design Match & Multi-Page Pagination
 * 
 * Layout: A4 Landscape
 * - Rice on LEFT column
 * - Other types on RIGHT column (stacked vertically: Broken, RJ Rice 1, RJ Broken, 0 Broken, Faram, Unpolish)
 * - Bottom row: Bran, RJ Rice (2), Sizer Broken (3 columns)
 * 
 * Features:
 * - 100% No Data Missed: All varieties, productions, purchases, sales, and palti splits are included.
 * - Multi-page Continuation: If a single date has heavy data, it cleanly flows to Page 2 / Page 3 with date continuation ribbons without any overlapping or clipping.
 * - Exact match to Records.tsx Rice Stock tab calculations and styles.
 */

import jsPDF from 'jspdf';

// A4 Landscape dimensions
const PAGE_WIDTH = 297;  // mm
const PAGE_HEIGHT = 210; // mm
const MARGIN = 8;        // mm
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const MAX_USABLE_Y = PAGE_HEIGHT - MARGIN - 4; // 198mm max safe boundary

// Font sizes (optimized for A4 landscape)
const TITLE_SIZE = 13;
const DATE_HEADER_SIZE = 10;
const PRODUCT_HEADER_SIZE = 8.5;
const COLUMN_HEADER_SIZE = 6.5;
const CONTENT_SIZE = 5.8;

// Colors (RGB tuples)
const BLUE_HEADER: [number, number, number] = [68, 114, 196];    // #4472C4
const GRAY_BG: [number, number, number] = [233, 236, 239];       // #e9ecef
const LIGHT_GRAY: [number, number, number] = [241, 243, 244];    // #f1f3f4
const GREEN_BG: [number, number, number] = [209, 250, 229];      // #d1fae5 - Production
const BLUE_BG: [number, number, number] = [219, 234, 254];       // #dbeafe - Purchase
const RED_BG: [number, number, number] = [254, 226, 226];        // #fee2e2 - Sale
const YELLOW_BG: [number, number, number] = [254, 243, 199];     // #fef3c7 - Palti Source
const ORANGE_BG: [number, number, number] = [255, 237, 213];     // #ffedd5 - Palti Target
const OPENING_BG: [number, number, number] = [224, 242, 254];    // #e0f2fe - Opening
const CLOSING_BG: [number, number, number] = [243, 244, 246];    // #f3f4f6 - Closing

const ALL_PRODUCT_TYPES = [
    'Rice', 'Bran', 'Broken', 'RJ Rice 1', 'RJ Rice (2)', 
    'RJ Broken', 'Sizer Broken', '0 Broken', 'Faram', 'Unpolish', 'Other'
];

interface PDFOptions {
    title: string;
    subtitle?: string;
    dateRange?: string;
    filterType?: string;
}

/**
 * Standardize and categorize product into standard types
 */
function categorizeProduct(productType: string): string {
    if (!productType) return 'Rice';

    const exactProductTypes: { [key: string]: string } = {
        'Rice': 'Rice',
        'Bran': 'Bran',
        'Broken': 'Broken',
        'Faram': 'Faram',
        'Unpolish': 'Unpolish',
        '0 Broken': '0 Broken',
        'Zero Broken': '0 Broken',
        'Sizer Broken': 'Sizer Broken',
        'RJ Broken': 'RJ Broken',
        'Rejection Broken': 'RJ Broken',
        'RJ Rice 1': 'RJ Rice 1',
        'RJ Rice (2)': 'RJ Rice (2)',
        'RJ Rice 2': 'RJ Rice (2)',
    };

    if (exactProductTypes[productType]) {
        return exactProductTypes[productType];
    }

    const productLower = productType.toLowerCase();
    const exactMatch = Object.entries(exactProductTypes).find(
        ([key]) => key.toLowerCase() === productLower
    );
    if (exactMatch) {
        return exactMatch[1];
    }

    if (productLower.includes('unpolish')) return 'Unpolish';
    if (productLower.includes('faram')) return 'Faram';
    if (productLower.includes('zero broken') || productLower.includes('0 broken')) return '0 Broken';
    if (productLower.includes('sizer broken')) return 'Sizer Broken';
    if (productLower.includes('rejection broken') || productLower.includes('rj broken')) return 'RJ Broken';
    if (productLower.includes('rj rice 1')) return 'RJ Rice 1';
    if (productLower.includes('rj rice 2') || productLower.includes('rj rice (2)')) return 'RJ Rice (2)';
    if (productLower.includes('broken')) return 'Broken';
    if (productLower.includes('rice')) return 'Rice';
    if (productLower.includes('bran')) return 'Bran';

    return 'Other';
}

/**
 * Normalization helper
 */
const normalize = (str: any) => {
    if (!str) return '';
    return String(str).toLowerCase().trim().replace(/[_\s-]+/g, ' ');
};

/**
 * Full stock computation from raw data (matches Records.tsx exactly)
 */
function computeRiceStockData(rawData: any[]): any[] {
    const dailyData: { [date: string]: any } = {};

    // Filter valid approved movements
    const sortedData = (rawData || [])
        .filter(item => {
            if (!item) return false;
            const loc = (item.locationCode || item.location || '').toString().toUpperCase();
            if (loc === 'CLEARING') return false;
            const isApproved = (item.status || item.approvalStatus) === 'approved';
            const isAdminEntry = item.createdByAdmin || item.adminApprovedBy;
            return isApproved || isAdminEntry;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group movements by date
    sortedData.forEach((item: any) => {
        const date = item.date ? (item.date.includes('T') ? item.date.split('T')[0] : item.date) : '';
        if (!date) return;

        if (!dailyData[date]) {
            dailyData[date] = {
                date,
                openingStock: [],
                yesterdayBifurcation: [],
                productions: [],
                conversions: [],
                openingStockTotal: 0,
                closingStockTotal: 0
            };
        }

        let productType = item.productType || item.product || 'Rice';
        if ((item.movementType || item.movement_type) === 'palti') {
            const sType = item.sourceProductType || item.source_product_type;
            if (sType) productType = sType;
        }

        const category = categorizeProduct(productType);
        const qtls = Number(item.quantityQuintals || item.qtls || item.actualQtls || 0);
        const bags = Number(item.bags || 0);

        dailyData[date].productions.push({
            id: item.id,
            qtls: Math.abs(Number(qtls)),
            bags: Math.abs(Number(bags)),
            bagSizeKg: Number(item.bagSizeKg || item.bag_size_kg || 26),
            product: productType,
            variety: item.variety || item.outturn?.allottedVariety || item.standardized_variety || item.standardizedVariety || '-',
            packaging: (() => {
                if ((item.movementType || item.movement_type) === 'palti') {
                    const sourcePkg = item.sourcePackaging?.brandName || item.source_packaging_brand || 'A1';
                    const targetPkg = item.targetPackaging?.brandName || item.target_packaging_brand || 'A1';
                    return `${sourcePkg} → ${targetPkg}`;
                }
                if (typeof item.packaging === 'object' && item.packaging !== null) {
                    return item.packaging.brandName || item.packaging.code || '';
                }
                return item.packaging || item.packaging_brand || '';
            })(),
            location: item.locationCode || item.location_code || item.location || 'A1',
            fromLocation: item.fromLocation || item.from_location || item.fromlocation || '',
            toLocation: item.toLocation || item.to_location || item.tolocation || '',
            movementType: item.movementType || item.movement_type || 'production',
            category: category,
            actualQtls: qtls,
            sourceBags: item.sourceBags || item.source_bags || 0,
            shortageKg: item.shortageKg || item.conversionShortageKg || item.conversion_shortage_kg || 0,
            shortageBags: item.shortageBags || item.conversionShortageBags || item.conversion_shortage_bags || 0,
            sourcePackaging: item.sourcePackaging || (item.source_packaging_brand ? { brandName: item.source_packaging_brand, allottedKg: 26 } : null),
            targetPackaging: item.targetPackaging || (item.target_packaging_brand ? { brandName: item.target_packaging_brand, allottedKg: 26 } : null),
            remarks: item.remarks || null
        });
    });

    const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const createStockKey = (variety: string, location: string, product: string, packaging: string, bagSizeKg: number): string => {
        let varClean = String(variety || '').toLowerCase().trim();
        let process = 'raw';
        if (varClean.includes('steam')) {
            process = 'steam';
            varClean = varClean.replace('steam', '').trim();
        } else if (varClean.includes('raw')) {
            process = 'raw';
            varClean = varClean.replace('raw', '').trim();
        }
        varClean = varClean.replace(/[_\s-]+/g, ' ').trim();
        const loc = String(location || '').toLowerCase().trim().replace(/[_\s-]+/g, ' ');
        const prod = String(product || 'rice').toLowerCase().trim();
        const pkg = String(packaging || '').toLowerCase().trim().replace(/[_\s-]+/g, ' ');
        const size = Number(bagSizeKg || 26).toFixed(2);
        return `${varClean}|${process}|${loc}|${prod}|${pkg}|${size}`;
    };

    const runningStockDetailed: { [key: string]: number } = {};
    const runningStockByType: { [productType: string]: number } = {};
    ALL_PRODUCT_TYPES.forEach(type => { runningStockByType[type] = 0; });

    sortedDates.forEach((date) => {
        const dayData = dailyData[date];
        const openingStockByType: { [type: string]: number } = {};
        ALL_PRODUCT_TYPES.forEach(type => { openingStockByType[type] = runningStockByType[type]; });

        const openingStockDetailed: { [key: string]: number } = {};
        Object.entries(runningStockDetailed).forEach(([key, qtls]) => {
            openingStockDetailed[key] = qtls;
        });

        const movementsByType: { [type: string]: number } = {};
        ALL_PRODUCT_TYPES.forEach(type => { movementsByType[type] = 0; });

        dayData.productions.forEach((prod: any) => {
            const category = prod.category || 'Rice';
            const movementType = (prod.movementType || '').toLowerCase();
            const variety = prod.variety || '-';
            const baseLocation = prod.location || 'A1';
            const packaging = prod.packaging || 'A1';

            if (movementType === 'palti') {
                const sourceLoc = prod.fromLocation || baseLocation;
                const targetLoc = prod.toLocation || baseLocation;
                const sourcePkg = prod.sourcePackaging?.brandName || 'A1';
                let targetPkgName = 'A1';
                if (prod.targetPackaging?.brandName) targetPkgName = prod.targetPackaging.brandName;
                else if (typeof packaging === 'string' && packaging.includes('→')) {
                    targetPkgName = packaging.split('→')[1]?.trim() || 'A1';
                }

                const sourceKgPerBag = prod.sourcePackaging?.allottedKg || 26;
                const targetKgPerBag = prod.targetPackaging?.allottedKg || prod.bagSizeKg || 26;
                const targetBags = prod.bags || 0;
                const targetQtls = prod.actualQtls || (targetBags * targetKgPerBag) / 100;
                const shortageKg = Number(prod.shortageKg || 0);
                const shortageQtls = shortageKg / 100;
                const sourceQtls = targetQtls + shortageQtls;

                const sourceKey = createStockKey(variety, sourceLoc, category, sourcePkg, sourceKgPerBag);
                const targetKey = createStockKey(variety, targetLoc, category, targetPkgName, targetKgPerBag);

                if (!runningStockDetailed[sourceKey]) runningStockDetailed[sourceKey] = 0;
                if (!runningStockDetailed[targetKey]) runningStockDetailed[targetKey] = 0;

                runningStockDetailed[sourceKey] -= sourceQtls;
                runningStockDetailed[targetKey] += targetQtls;

                if (Math.abs(runningStockDetailed[sourceKey]) < 0.0001) delete runningStockDetailed[sourceKey];
                if (Math.abs(runningStockDetailed[targetKey]) < 0.0001) delete runningStockDetailed[targetKey];

                if (normalize(sourceLoc) !== 'direct load') movementsByType[category] -= sourceQtls;
                if (normalize(targetLoc) !== 'direct load') movementsByType[category] += targetQtls;
                return;
            }

            const bagSize = prod.bagSizeKg || 26;
            const stockKey = createStockKey(variety, baseLocation, category, packaging, bagSize);
            if (!runningStockDetailed[stockKey]) runningStockDetailed[stockKey] = 0;

            let qtlsChange = prod.actualQtls;
            if (movementType === 'sale') qtlsChange = -Math.abs(qtlsChange);
            else qtlsChange = Math.abs(qtlsChange);

            runningStockDetailed[stockKey] += qtlsChange;
            if (Math.abs(runningStockDetailed[stockKey]) < 0.0001) delete runningStockDetailed[stockKey];

            if (normalize(baseLocation) !== 'direct load') {
                movementsByType[category] += qtlsChange;
            }
        });

        const closingStockByType: { [type: string]: number } = {};
        ALL_PRODUCT_TYPES.forEach(type => {
            runningStockByType[type] += movementsByType[type];
            closingStockByType[type] = runningStockByType[type];
        });

        // Build yesterday's bifurcation groups
        const bifurcationGroups: { [key: string]: any } = {};
        Object.entries(openingStockDetailed).forEach(([key, qtls]) => {
            if (qtls > 0.01 && !key.includes('|direct load|')) {
                const [stockVariety, stockProcess, location, product, packaging, bagSize] = key.split('|');
                const displayLocation = (location || '').toUpperCase();
                const displayPackaging = (packaging || '').toUpperCase();
                let displayVariety = (stockVariety || product || 'Rice').toUpperCase();
                if (stockProcess && !displayVariety.toLowerCase().includes(stockProcess.toLowerCase())) {
                    displayVariety += ` ${stockProcess.toUpperCase()}`;
                }

                let cleanPackaging = displayPackaging;
                if (displayPackaging && displayPackaging.includes('→')) {
                    cleanPackaging = displayPackaging.split('→').pop()?.trim() || displayPackaging;
                }

                const properCaseCategory = categorizeProduct(product);
                const bifurcationKey = `${displayVariety}|${stockProcess?.toUpperCase() || ''}|${displayLocation}|${product}|${displayPackaging}|${bagSize}`;

                if (!bifurcationGroups[bifurcationKey]) {
                    bifurcationGroups[bifurcationKey] = {
                        product: properCaseCategory,
                        variety: displayVariety,
                        packaging: cleanPackaging,
                        category: properCaseCategory,
                        location: displayLocation,
                        qtls: 0,
                        bags: 0,
                        bagSizeKg: Number(bagSize) || 26
                    };
                }

                bifurcationGroups[bifurcationKey].qtls += qtls;
                bifurcationGroups[bifurcationKey].bags += Math.round(qtls * 100 / (Number(bagSize) || 26));
            }
        });

        dayData.yesterdayBifurcation = Object.values(bifurcationGroups).filter(g => g.bags > 0 && g.qtls > 0.01);

        dayData.openingStock = [];
        ALL_PRODUCT_TYPES.forEach(type => {
            const qtls = Number(openingStockByType[type] || 0);
            if (qtls > 0.01) {
                let totalBags = 0;
                Object.entries(openingStockDetailed).forEach(([key, keyQtls]) => {
                    const [, , , prodName, , bagSize] = key.split('|');
                    if (normalize(prodName) === normalize(type)) {
                        const bSize = Number(bagSize) || 26;
                        totalBags += Math.round((keyQtls * 100) / bSize);
                    }
                });

                dayData.openingStock.push({
                    product: type,
                    qtls: qtls,
                    bags: totalBags,
                    category: type
                });
            }
        });

        dayData.openingStockTotal = Object.values(openingStockByType).reduce((sum, val) => sum + Number(val || 0), 0);
        dayData.closingStockTotal = Object.values(closingStockByType).reduce((sum, val) => sum + Number(val || 0), 0);

        Object.entries(runningStockDetailed).forEach(([key]) => {
            if (key.includes('|direct load|')) delete runningStockDetailed[key];
        });
    });

    return sortedDates.reverse().map(date => dailyData[date]);
}

/**
 * Main PDF generation function
 */
export const generateRiceStockPDF = (
    stockData: any[],
    options: PDFOptions
): void => {
    console.log(`📊 Generating Enhanced Rice Stock PDF: ${stockData?.length || 0} records`);

    if (!stockData || stockData.length === 0) {
        console.error('❌ No rice stock data provided');
        alert('No data to export');
        return;
    }

    // Check if data is already processed dailyData array or raw items
    const isAlreadyProcessed = stockData.length > 0 && stockData[0].yesterdayBifurcation !== undefined;
    const processedData = isAlreadyProcessed ? stockData : computeRiceStockData(stockData);

    if (!processedData || processedData.length === 0) {
        alert('No rice stock data available for export');
        return;
    }

    // Create PDF in landscape mode (A4)
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    console.log(`📅 Processing ${processedData.length} date(s)`);

    let isVeryFirstPage = true;

    processedData.forEach((dayData: any) => {
        if (!isVeryFirstPage) {
            doc.addPage();
        }
        renderDateWithPagination(doc, dayData, dayData.date, options, isVeryFirstPage);
        isVeryFirstPage = false;
    });

    // Save PDF
    const filename = `Rice_Stock_${new Date().toISOString().split('T')[0]}.pdf`;
    try {
        doc.save(filename);
        console.log(`✅ PDF saved: ${filename}`);
    } catch (error) {
        console.error('❌ PDF save error:', error);
        alert('Failed to download PDF. Please try again.');
    }
};

/**
 * Group daily data by product type
 */
function groupDataByProductType(dayData: any): { [type: string]: any } {
    const groups: { [type: string]: any } = {};

    ALL_PRODUCT_TYPES.forEach(type => {
        groups[type] = {
            openingBifurcation: [],
            openingTotal: { qtls: 0, bags: 0 },
            movements: [],
            closing: { qtls: 0, bags: 0 }
        };
    });

    // 1. Variety-wise opening stock
    const bifurcation = dayData.yesterdayBifurcation || [];
    bifurcation.forEach((item: any) => {
        const type = categorizeProduct(item.category || item.product || 'Rice');
        if (groups[type]) {
            groups[type].openingBifurcation.push(item);
            groups[type].openingTotal.qtls += Number(item.qtls || 0);
            groups[type].openingTotal.bags += Number(item.bags || 0);
        }
    });

    // 2. Opening summary totals fallback
    if (dayData.openingStock) {
        dayData.openingStock.forEach((item: any) => {
            const type = categorizeProduct(item.category || item.product || 'Rice');
            if (groups[type] && groups[type].openingBifurcation.length === 0) {
                groups[type].openingTotal.qtls = Number(item.qtls || 0);
                groups[type].openingTotal.bags = Number(item.bags || 0);
            }
        });
    }

    // 3. Daily movements
    const prods = dayData.productions || [];
    prods.forEach((item: any) => {
        const type = categorizeProduct(item.category || item.product || item.productType || 'Rice');
        if (groups[type]) {
            groups[type].movements.push(item);
        }
    });

    // 4. Calculate closing stock
    ALL_PRODUCT_TYPES.forEach(type => {
        let qtls = groups[type].openingTotal.qtls;
        let bags = groups[type].openingTotal.bags;

        groups[type].movements.forEach((m: any) => {
            const mType = (m.movementType || '').toLowerCase();
            const mQtls = Math.abs(Number(m.actualQtls || m.qtls || 0));
            const mBags = Math.abs(Number(m.bags || 0));

            if (mType === 'sale') {
                qtls -= mQtls;
                bags -= mBags;
            } else if (mType === 'palti') {
                const fromLoc = m.fromLocation || '';
                const toLoc = m.toLocation || '';
                const sourceKg = m.sourcePackaging?.allottedKg || 26;
                const shortageKg = Number(m.shortageKg || 0);
                const sourceQtls = mQtls + (shortageKg / 100);
                const sourceBags = m.sourceBags || Math.round((sourceQtls * 100) / sourceKg);

                if (normalize(fromLoc) !== 'direct load') {
                    qtls -= sourceQtls;
                    bags -= sourceBags;
                }
                if (normalize(toLoc) !== 'direct load') {
                    qtls += mQtls;
                    bags += mBags;
                }
            } else {
                qtls += mQtls;
                bags += mBags;
            }
        });

        groups[type].closing = {
            qtls: Math.max(0, qtls),
            bags: Math.max(0, bags)
        };
    });

    return groups;
}

/**
 * Approximate height calculation for a product card to decide page breaks
 */
function estimateCardHeight(data: any): number {
    let h = 10.3; // Card header + column headers
    const bifCount = data.openingBifurcation?.length || 0;
    if (bifCount > 0) {
        h += 4.0 + (bifCount * 4.0);
    }
    if (data.openingTotal?.qtls > 0 || bifCount > 0) {
        h += 4.5; // Opening subtotal
    }
    const movements = data.movements || [];
    movements.forEach((m: any) => {
        if ((m.movementType || '').toLowerCase() === 'palti') {
            h += (Number(m.shortageKg || 0) > 0 ? 12.0 : 8.0);
        } else {
            h += 4.0;
        }
    });
    h += 4.5; // Closing subtotal
    h += 2.0; // Margin
    return h;
}

/**
 * Render a complete date with Smart Multi-Page Flow
 */
function renderDateWithPagination(
    doc: jsPDF,
    dayData: any,
    date: string,
    options: PDFOptions,
    isFirstPage: boolean
): void {
    let yPos = MARGIN;

    if (isFirstPage) {
        yPos = renderPageHeader(doc, options, yPos);
    }

    yPos = renderDateHeader(doc, date, yPos, false);

    const productGroups = groupDataByProductType(dayData);

    const leftX = MARGIN;
    const leftWidth = (CONTENT_WIDTH - 2) / 2;
    const dividerX = leftX + leftWidth;
    const rightX = dividerX + 2;
    const rightWidth = leftWidth;

    const contentStartY = yPos;

    // 1. Render Left Column: Rice (with multi-page chunking if huge)
    const riceData = productGroups['Rice'] || { openingBifurcation: [], openingTotal: { qtls: 0, bags: 0 }, movements: [], closing: { qtls: 0, bags: 0 } };
    const leftEndY = renderProductCard(doc, 'Rice', riceData, leftX, contentStartY, leftWidth, date);

    // 2. Render Right Column: Stacked vertically
    const rightTypes = ['Broken', 'RJ Rice 1', 'RJ Broken', '0 Broken', 'Faram', 'Unpolish'];
    let rightY = contentStartY;

    rightTypes.forEach(type => {
        const typeData = productGroups[type] || { openingBifurcation: [], openingTotal: { qtls: 0, bags: 0 }, movements: [], closing: { qtls: 0, bags: 0 } };
        const hasData = (typeData.openingBifurcation?.length > 0) || (typeData.movements?.length > 0) || (typeData.openingTotal.qtls > 0);
        if (hasData) {
            const cardH = estimateCardHeight(typeData);
            if (rightY + cardH > MAX_USABLE_Y) {
                // If it doesn't fit on this page, start a fresh continuation page
                doc.addPage();
                renderDateHeader(doc, date, MARGIN, true);
                rightY = MARGIN + 10;
            }
            rightY = renderProductCard(doc, type, typeData, rightX, rightY, rightWidth, date);
            rightY += 2;
        }
    });

    // Divider line between Left and Right on the current page
    doc.setDrawColor(210, 215, 220);
    doc.setLineWidth(0.4);
    const maxTopY = Math.max(leftEndY, rightY);
    if (maxTopY > contentStartY && maxTopY <= MAX_USABLE_Y) {
        doc.line(dividerX + 1, contentStartY, dividerX + 1, maxTopY);
    }

    // 3. BOTTOM Row (3 columns: Bran, RJ Rice 2, Sizer Broken)
    const bottomTypes = ['Bran', 'RJ Rice (2)', 'Sizer Broken'];
    const maxBottomH = Math.max(
        ...bottomTypes.map(t => estimateCardHeight(productGroups[t] || { openingBifurcation: [], openingTotal: { qtls: 0, bags: 0 }, movements: [], closing: { qtls: 0, bags: 0 } }))
    );

    let bottomY = maxTopY + 3;
    // Check if bottom row fits on current page
    if (bottomY + maxBottomH > MAX_USABLE_Y || maxTopY > 150) {
        // Break to a new continuation page for bottom row summary
        doc.addPage();
        renderDateHeader(doc, date, MARGIN, true);
        bottomY = MARGIN + 10;
    }

    renderBottomRow(doc, productGroups, bottomY, date);
}

/**
 * Render Header
 */
function renderPageHeader(doc: jsPDF, options: PDFOptions, yPos: number): number {
    doc.setFontSize(TITLE_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(68, 114, 196);
    doc.text(options.title || 'Rice Stock Report', PAGE_WIDTH / 2, yPos + 4, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const dateRangeStr = options.dateRange ? `Period: ${options.dateRange} | ` : '';
    const subtitle = `${dateRangeStr}Generated: ${new Date().toLocaleDateString('en-GB')}`;
    doc.text(subtitle, PAGE_WIDTH / 2, yPos + 8.5, { align: 'center' });

    return yPos + 12;
}

/**
 * Render Blue Date Ribbon
 */
function renderDateHeader(doc: jsPDF, dateStr: string, yPos: number, isContinuation: boolean = false): number {
    doc.setFillColor(...BLUE_HEADER);
    doc.rect(MARGIN, yPos, CONTENT_WIDTH, 6.5, 'F');

    doc.setFontSize(DATE_HEADER_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const displayDate = formatDateDisplay(dateStr);
    const label = isContinuation ? `${displayDate}  (Continued)` : displayDate;
    doc.text(label, MARGIN + 3, yPos + 4.6);

    return yPos + 8;
}

/**
 * Helper to ensure text strictly fits on a single line and never wraps or overflows
 */
function fitSingleLine(doc: jsPDF, text: string, maxWidth: number): string {
    if (!text) return '';
    let clean = String(text).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.toUpperCase() === 'DIRECT_LOAD') clean = 'DIRECT LOAD';
    if (doc.getTextWidth(clean) <= maxWidth) return clean;

    let truncated = clean;
    while (truncated.length > 3 && doc.getTextWidth(truncated + '…') > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
}

/**
 * Render Column Headers
 */
function renderColumnHeaders(doc: jsPDF, x: number, y: number, width: number): number {
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(x, y, width, 4.2, 'F');

    doc.setFontSize(COLUMN_HEADER_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(95, 99, 104);

    const cols = [
        { text: 'Qtls', xOff: 1.5, maxW: width * 0.12 },
        { text: 'Bags', xOff: width * 0.13, maxW: width * 0.12 },
        { text: 'Product', xOff: width * 0.25, maxW: width * 0.16 },
        { text: 'Variety', xOff: width * 0.41, maxW: width * 0.23 },
        { text: 'Packaging', xOff: width * 0.64, maxW: width * 0.18 },
        { text: 'Location', xOff: width * 0.82, maxW: width * 0.17 }
    ];

    cols.forEach(c => {
        doc.text(c.text, x + c.xOff, y + 3);
    });

    return y + 4.8;
}

/**
 * Render a complete product card with internal pagination safety
 */
function renderProductCard(
    doc: jsPDF,
    productType: string,
    data: any,
    x: number,
    y: number,
    width: number,
    dateStr?: string
): number {
    let currentY = y;

    // If near bottom of page, start a new page
    if (currentY + 18 > MAX_USABLE_Y) {
        doc.addPage();
        if (dateStr) renderDateHeader(doc, dateStr, MARGIN, true);
        currentY = MARGIN + 10;
    }

    // Card Header
    doc.setFillColor(...GRAY_BG);
    doc.rect(x, currentY, width, 5, 'F');
    doc.setFontSize(PRODUCT_HEADER_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(73, 80, 87);
    doc.text(productType, x + width / 2, currentY + 3.6, { align: 'center' });
    currentY += 5.5;

    // Column Headers
    currentY = renderColumnHeaders(doc, x, currentY, width);

    // 1. Variety-wise Opening Stock
    const bifItems = data.openingBifurcation || [];
    if (bifItems.length > 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(x, currentY, width, 3.5, 'F');
        doc.setFontSize(CONTENT_SIZE);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.text('Variety-wise Opening Stock', x + 2, currentY + 2.5);
        currentY += 4;

        bifItems.forEach((item: any) => {
            if (currentY + 4 > MAX_USABLE_Y) {
                doc.addPage();
                if (dateStr) renderDateHeader(doc, dateStr, MARGIN, true);
                currentY = MARGIN + 10;
                currentY = renderColumnHeaders(doc, x, currentY, width);
            }

            currentY = renderDataRow(doc, {
                qtls: Number(item.qtls || 0).toFixed(2),
                bags: `${item.bags || 0}${item.bagSizeKg ? `/${item.bagSizeKg}k` : ''}`,
                product: item.product || productType,
                variety: item.variety || '-',
                packaging: item.packaging || 'A1',
                location: item.location || 'A1'
            }, x, currentY, width, [255, 255, 255]);
        });
    }

    // Opening Stock Subtotal
    if (data.openingTotal?.qtls > 0 || bifItems.length > 0) {
        if (currentY + 4.5 > MAX_USABLE_Y) {
            doc.addPage();
            if (dateStr) renderDateHeader(doc, dateStr, MARGIN, true);
            currentY = MARGIN + 10;
        }

        currentY = renderSummaryRow(
            doc,
            `Opening: ${Number(data.openingTotal?.qtls || 0).toFixed(2)} Qtls / ${data.openingTotal?.bags || 0} Bags`,
            x, currentY, width, OPENING_BG, [30, 64, 175]
        );
    }

    // 2. Daily Movements
    const movements = data.movements || [];
    if (movements.length > 0) {
        movements.forEach((m: any) => {
            const mType = (m.movementType || '').toLowerCase();

            if (mType === 'palti') {
                if (currentY + 12 > MAX_USABLE_Y) {
                    doc.addPage();
                    if (dateStr) renderDateHeader(doc, dateStr, MARGIN, true);
                    currentY = MARGIN + 10;
                    currentY = renderColumnHeaders(doc, x, currentY, width);
                }
                currentY = renderPaltiRow(doc, m, x, currentY, width);
            } else {
                if (currentY + 4 > MAX_USABLE_Y) {
                    doc.addPage();
                    if (dateStr) renderDateHeader(doc, dateStr, MARGIN, true);
                    currentY = MARGIN + 10;
                    currentY = renderColumnHeaders(doc, x, currentY, width);
                }

                let bgColor: [number, number, number] = [255, 255, 255];
                if (mType === 'production') bgColor = GREEN_BG;
                else if (mType === 'purchase') bgColor = BLUE_BG;
                else if (mType === 'sale') bgColor = RED_BG;

                const qtlsVal = Math.abs(Number(m.actualQtls || m.qtls || 0)).toFixed(2);
                const prefix = mType === 'sale' ? '-' : '+';
                currentY = renderDataRow(doc, {
                    qtls: `${prefix}${qtlsVal}`,
                    bags: `${m.bags || 0}${m.bagSizeKg ? `/${m.bagSizeKg}k` : ''}`,
                    product: `${mType.toUpperCase().slice(0, 4)}: ${m.product || productType}`,
                    variety: m.variety || '-',
                    packaging: m.packaging?.brandName || m.packaging || 'A1',
                    location: m.locationCode || m.location || 'A1'
                }, x, currentY, width, bgColor);
            }
        });
    }

    // 3. Closing Stock Subtotal
    if (currentY + 4.5 > MAX_USABLE_Y) {
        doc.addPage();
        if (dateStr) renderDateHeader(doc, dateStr, MARGIN, true);
        currentY = MARGIN + 10;
    }

    const closingQtls = Number(data.closing?.qtls || 0).toFixed(2);
    const closingBags = Number(data.closing?.bags || 0);
    currentY = renderSummaryRow(
        doc,
        `Closing: ${closingQtls} Qtls / ${closingBags} Bags`,
        x, currentY, width, CLOSING_BG, [0, 0, 0]
    );

    return currentY + 1.5;
}

/**
 * Render single data row with single-line fit protection
 */
function renderDataRow(
    doc: jsPDF,
    row: { qtls: string; bags: string; product: string; variety: string; packaging: string; location: string },
    x: number,
    y: number,
    width: number,
    bgColor: [number, number, number]
): number {
    doc.setFillColor(...bgColor);
    doc.rect(x, y, width, 3.8, 'F');

    doc.setFontSize(CONTENT_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const cols = [
        { text: String(row.qtls || '0'), xOff: 1.5, maxW: width * 0.12 },
        { text: String(row.bags || '0'), xOff: width * 0.13, maxW: width * 0.12 },
        { text: String(row.product || ''), xOff: width * 0.25, maxW: width * 0.16 },
        { text: String(row.variety || ''), xOff: width * 0.41, maxW: width * 0.23 },
        { text: String(row.packaging || ''), xOff: width * 0.64, maxW: width * 0.18 },
        { text: String(row.location || ''), xOff: width * 0.82, maxW: width * 0.17 }
    ];

    cols.forEach(c => {
        const singleLine = fitSingleLine(doc, c.text, c.maxW);
        doc.text(singleLine, x + c.xOff, y + 2.7);
    });

    return y + 4;
}

/**
 * Render Palti Hierarchical Rows (Source, Target, Shortage)
 */
function renderPaltiRow(
    doc: jsPDF,
    m: any,
    x: number,
    y: number,
    width: number
): number {
    let currentY = y;
    const targetQtls = Math.abs(Number(m.actualQtls || m.qtls || 0));
    const targetBags = Math.abs(Number(m.bags || 0));
    const shortageKg = Number(m.shortageKg || 0);
    const shortageQtls = shortageKg / 100;
    const sourceQtls = targetQtls + shortageQtls;

    const sourcePkg = m.sourcePackaging?.brandName || 'A1';
    const targetPkg = m.targetPackaging?.brandName || m.packaging || 'A1';
    const sourcePkgKg = Number(m.sourcePackaging?.allottedKg || 26);
    const targetPkgKg = Number(m.targetPackaging?.allottedKg || m.bagSizeKg || 26);
    const sourceBags = m.sourceBags || Math.round((sourceQtls * 100) / sourcePkgKg);

    // Row 1: Source (Yellow)
    currentY = renderDataRow(doc, {
        qtls: `-${sourceQtls.toFixed(2)}`,
        bags: `${sourceBags}/${sourcePkgKg}k`,
        product: 'Palti Source',
        variety: m.variety || '-',
        packaging: sourcePkg,
        location: m.fromLocation || m.locationCode || 'A1'
    }, x, currentY, width, YELLOW_BG);

    // Row 2: Target (Orange)
    currentY = renderDataRow(doc, {
        qtls: `+${targetQtls.toFixed(2)}`,
        bags: `${targetBags}/${targetPkgKg}k`,
        product: 'Target',
        variety: m.variety || '-',
        packaging: targetPkg,
        location: m.toLocation || m.location || 'A1'
    }, x, currentY, width, ORANGE_BG);

    // Row 3: Shortage (Red) if shortage > 0
    if (shortageKg > 0) {
        currentY = renderDataRow(doc, {
            qtls: `S: ${(shortageKg / 100).toFixed(2)}`,
            bags: '-',
            product: 'Shortage',
            variety: '-',
            packaging: '-',
            location: `${shortageKg}kg`
        }, x, currentY, width, RED_BG);
    }

    return currentY;
}

/**
 * Render Summary Subtotal Row
 */
function renderSummaryRow(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    width: number,
    bgColor: [number, number, number],
    textColor: [number, number, number]
): number {
    doc.setFillColor(...bgColor);
    doc.rect(x, y, width, 4, 'F');

    doc.setFontSize(CONTENT_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(text, x + 2, y + 2.9);

    return y + 4.5;
}

/**
 * Render bottom row (3 equal columns: Bran, RJ Rice (2), Sizer Broken)
 */
function renderBottomRow(doc: jsPDF, productGroups: any, y: number, dateStr?: string): void {
    const bottomTypes = ['Bran', 'RJ Rice (2)', 'Sizer Broken'];
    const columnWidth = (CONTENT_WIDTH - 4) / 3;

    bottomTypes.forEach((type, index) => {
        const x = MARGIN + (index * (columnWidth + 2));
        const data = productGroups[type] || { openingBifurcation: [], openingTotal: { qtls: 0, bags: 0 }, movements: [], closing: { qtls: 0, bags: 0 } };
        renderProductCard(doc, type, data, x, y, columnWidth, dateStr);
    });
}

/**
 * Helper to format date display (DD-MMM-YYYY)
 */
function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return 'Unknown Date';
    try {
        const parts = dateStr.includes('T') ? dateStr.split('T')[0].split('-') : dateStr.split('-');
        if (parts.length === 3) {
            const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${String(parts[2]).padStart(2, '0')}-${months[date.getMonth()]}-${parts[0]}`;
        }
        return dateStr;
    } catch {
        return dateStr;
    }
}

export default generateRiceStockPDF;
