import React, { useEffect } from 'react';
import { MOBILE_TABLE_LABELS } from '../mobile-labels';

/**
 * MobileViewEnhancer
 *
 * Runs only on mobile viewports (max-width: 767px).
 *
 * Transforms wide desktop tables into ultra-compact, high-density mobile cards:
 *  - ZERO horizontal scrolling
 *  - 3-5 records fit on a single mobile screen without endless vertical scrolling
 *  - High-priority fields (Party, Variety, Bags, Date, Rate, Status) shown in a clean 2-column key-value grid
 *  - Secondary detail fields collapsed behind a compact "Show details" toggle
 *  - Modals become native iOS-style bottom sheets
 */

/** High-priority field keywords that stay visible on the compact card */
const HIGH_PRIORITY_RE = /^(party|name|variety|bags|no\.?\s*of\s*bags|act\.?\s*bags|broker|date|rate|final|offer|base\s*rate|sute|status|lorry|godown|location|from|to)/i;

/** Low-priority field keywords that should collapse when table has many columns */
const LOW_PRIORITY_RE = /^(moisture|cutting|bend|mix|kandu|oil|sk|grains|wb|weighbridge|gross|tare|net|hamali|freight|brokerage|cd|egb|bank|loan|reason|supervisor|cook|smell|collected|reported|outturn|packaging|pkg|remark)/i;

/** Choose which column becomes the card's title */
const pickTitleIndex = (labels: string[]) => {
  let best = -1;
  let bestScore = -100;
  const numberingRe = /^(#|s\.?no\.?|sl\.?no\.?|sr\.?no\.?|no\.?|serial|sl)$/i;
  const limit = Math.min(labels.length, 6);
  for (let i = 0; i < limit; i++) {
    const label = (labels[i] || '').trim();
    if (!label) continue;
    if (numberingRe.test(label.replace(/\s/g, ''))) continue;
    let score = 1;
    if (/date|slip|bill|invoice/i.test(label)) score = -100;
    else if (/party|name/i.test(label)) score = 8;
    else if (/variety|broker|lorry|vehicle|lot/i.test(label)) score = 5;
    else if (/location|godown|village|town/i.test(label)) score = 3;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
};

/** Remember each cell's last text so status colours refresh when data changes */
const cellText = new WeakMap<HTMLTableCellElement, string>();

const updateStatusPills = (row: HTMLTableRowElement) => {
  Array.from(row.children).forEach((cell) => {
    const td = cell as HTMLTableCellElement;
    if (!td.hasAttribute('data-label')) return;
    if (td.hasAttribute('data-card-title') || td.hasAttribute('data-action')) return;
    const txt = (td.textContent || '').trim();
    if (cellText.get(td) === txt) return;
    cellText.set(td, txt);
    const status = detectStatus(txt);
    if (status) td.setAttribute('data-status-pill', status);
    else td.removeAttribute('data-status-pill');
  });
};

/** Colour-code status-like values for quick scanning */
const detectStatus = (txt: string): 'good' | 'warn' | 'bad' | 'info' | '' => {
  if (!txt || txt.length > 40) return '';
  const t = txt.toLowerCase();
  if (/approved|completed|delivered|success|paid|verified|active|in-stock|in stock|stock-in|available|pass/.test(t)) return 'good';
  if (/pending|awaiting|in progress|hold|partial|processing|scheduled|under|in-transit|in transit/.test(t)) return 'warn';
  if (/rejected|failed|cancelled|canceled|not ok|deficient|shortage|damaged|overdue|out of stock|out-of-stock|fail/.test(t)) return 'bad';
  if (/received|submitted|reported|new/.test(t)) return 'info';
  return '';
};

const MobileViewEnhancer: React.FC = () => {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');

    const labeledRows = new WeakSet<HTMLTableRowElement>();
    const tableSignatures = new WeakMap<HTMLTableElement, string>();

    const labelTable = (table: HTMLTableElement) => {
      if (table.classList.contains('no-mobile-cards')) return;
      let headRow = table.querySelector('thead tr:not(.mobile-card-header-row)');

      let headerRowInBody = false;
      if (!headRow) {
        const bodyRows = table.tBodies[0] ? Array.from(table.tBodies[0].querySelectorAll('tr')) : [];
        const thRow = bodyRows.find((r) => r.querySelectorAll('th').length > 0 && r.querySelectorAll('td').length === 0);
        if (thRow) {
          headRow = thRow;
          headerRowInBody = true;
        }
      }
      if (!headRow) return;

      const headerCells: string[] = [];
      let headerCol = 0;
      Array.from(headRow.children).forEach((c) => {
        const span = (c as HTMLTableCellElement).colSpan || 1;
        const label = (c.textContent || '').trim();
        for (let i = 0; i < span; i++) headerCells[headerCol++] = label;
      });
      if (headerCells.length === 0) return;

      const body = table.tBodies[0];
      if (!body || body.querySelectorAll('tr').length === 0) return;

      const signature = headerCells.join('|');
      const headersChanged = tableSignatures.get(table) !== signature;
      tableSignatures.set(table, signature);

      const dict = MOBILE_TABLE_LABELS[signature];
      const labels = dict ? dict.labels : headerCells;
      
      // Determine collapsible columns:
      // Either from dict.collapsed, or dynamically if table has > 6 non-action columns
      let collapsedSet: Set<string> | null = null;
      if (dict && dict.collapsed) {
        collapsedSet = new Set(dict.collapsed);
      } else if (labels.length > 6) {
        collapsedSet = new Set<string>();
        let visibleCount = 0;
        labels.forEach((label) => {
          const l = label.trim();
          if (!l || /actions?/i.test(l)) return;
          if (LOW_PRIORITY_RE.test(l)) {
            collapsedSet!.add(label);
          } else if (HIGH_PRIORITY_RE.test(l) && visibleCount < 6) {
            visibleCount++;
          } else if (visibleCount >= 6) {
            collapsedSet!.add(label);
          } else {
            visibleCount++;
          }
        });
      }

      table.classList.add('mobile-card-table');

      const titleIndex = pickTitleIndex(labels);

      body.querySelectorAll('tr').forEach((row) => {
        if (headerRowInBody && row === headRow) {
          row.classList.add('mobile-header-row');
          return;
        }

        const alreadyLabeled = labeledRows.has(row);
        if (alreadyLabeled && !headersChanged) {
          updateStatusPills(row);
          return;
        }
        labeledRows.add(row);

        const cells = Array.from(row.children) as HTMLTableCellElement[];
        const isSpecialRow =
          row.classList.contains('total-row') ||
          row.classList.contains('section-header') ||
          cells.some((c) => (c.colSpan || 1) > 1);

        let col = 0;
        let detailsCount = 0;
        cells.forEach((cell) => {
          const span = cell.colSpan || 1;
          if (isSpecialRow || span > 1) {
            row.setAttribute('data-fullwidth-row', 'true');
          } else {
            let label = labels[col] || '';

            if (!label && (cell.textContent || '').trim()) {
              detailsCount++;
              label = detailsCount === 1 ? 'Details' : `Details ${detailsCount}`;
            }

            const isAction = !!cell.querySelector('button, a, input[type="button"], input[type="submit"]');

            cell.setAttribute('data-label', label);
            if (col === titleIndex && !isAction) {
              cell.setAttribute('data-card-title', 'true');
            }
            if (isAction) {
              cell.setAttribute('data-action', 'true');
            }

            if (collapsedSet && collapsedSet.has(label) && !isAction && col !== titleIndex) {
              cell.setAttribute('data-collapsed', 'true');
            }

            const status = detectStatus((cell.textContent || '').trim());
            if (status) cell.setAttribute('data-status-pill', status);
          }
          col += span;
        });

        updateStatusPills(row);

        // "Show details / Show less" toggle for collapsed fields
        if (collapsedSet && !isSpecialRow) {
          const hidden = cells.filter((c) => c.hasAttribute('data-collapsed')).length;
          if (hidden > 0) {
            let toggle = row.querySelector('.mobile-card-toggle') as HTMLButtonElement | null;
            if (!toggle) {
              toggle = document.createElement('button');
              toggle.type = 'button';
              toggle.className = 'mobile-card-toggle';
              toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const expanded = row.classList.toggle('mobile-card-expanded');
                if (toggle) toggle.textContent = expanded ? '▲ Show less' : `▼ Show details (${hidden} more)`;
              });
              
              // Place toggle before the actions cell if possible
              const actionCell = row.querySelector('td[data-action]');
              if (actionCell) {
                row.insertBefore(toggle, actionCell);
              } else {
                row.appendChild(toggle);
              }
            }
            toggle.textContent = row.classList.contains('mobile-card-expanded')
              ? '▲ Show less'
              : `▼ Show details (${hidden} more)`;
          }
        }
      });
    };

    const tagGrid = (el: HTMLElement) => {
      if (el.classList.contains('mobile-grid-1col')) return;
      if (getComputedStyle(el).display !== 'grid') return;
      if (el.closest('nav')) return;
      el.classList.add('mobile-grid-1col');
    };

    const tagOverlay = (el: HTMLElement) => {
      if (el.classList.contains('mobile-sheet-overlay')) return;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return;

      const pinned = cs.top === '0px' && cs.left === '0px' && cs.right === '0px' && cs.bottom === '0px';
      if (!pinned) return;

      if (Array.from(el.children).some((c) => getComputedStyle(c as HTMLElement).position === 'fixed')) return;

      el.classList.add('mobile-sheet-overlay');
      const content = Array.from(el.children).find((c) => {
        const rc = getComputedStyle(c as HTMLElement);
        return (c as HTMLElement).offsetWidth > 0 && rc.position !== 'fixed';
      });
      if (content) content.classList.add('mobile-sheet-content');
    };

    const inspectNode = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      if (el.tagName === 'TABLE') labelTable(el as HTMLTableElement);
      else {
        el.querySelectorAll('table').forEach((t) => labelTable(t as HTMLTableElement));
      }

      if (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'FORM') tagGrid(el);
      el.querySelectorAll('[class*="Grid"], [class*="grid"]').forEach((g) => tagGrid(g as HTMLElement));

      if (el.tagName === 'DIV' || el.tagName === 'SECTION') tagOverlay(el);
      el.querySelectorAll('div, section').forEach((o) => tagOverlay(o as HTMLElement));
    };

    const runFullScan = () => {
      if (!mq.matches) return;
      document.querySelectorAll('table').forEach((t) => labelTable(t as HTMLTableElement));
      document.querySelectorAll('[class*="Grid"], [class*="grid"]').forEach((g) => tagGrid(g as HTMLElement));
      document.querySelectorAll('body > *, [style*="position: fixed"], [style*="position:fixed"]')
        .forEach((o) => tagOverlay(o as HTMLElement));
    };

    runFullScan();

    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver((mutations) => {
      if (!mq.matches) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const m of mutations) {
          m.addedNodes.forEach(inspectNode);
          if (m.type === 'attributes' && m.target instanceof HTMLElement) {
            if (m.attributeName === 'style' || m.attributeName === 'class') {
              inspectNode(m.target);
            }
          }
        }
        document.querySelectorAll('table').forEach((t) => labelTable(t as HTMLTableElement));
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    const onViewportChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (mq.matches) runFullScan();
      }, 150);
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      clearTimeout(timer);
    };
  }, []);

  return null;
};

export default MobileViewEnhancer;
