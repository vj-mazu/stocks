import React, { useEffect } from 'react';

/**
 * MobileViewEnhancer
 *
 * Runs only on mobile viewports (max-width: 767px). Makes the whole app feel
 * like a native mobile app without editing every page:
 *
 *  1. TABLE → VERTICAL CARDS
 *     Every <table> with a <thead> gets `mobile-card-table` and each <td> gets
 *     a `data-label` from its matching <th>. Global CSS (mobile-app.css) then
 *     renders each row as a card of "label: value" rows — no horizontal scroll,
 *     no hidden data.
 *
 *  2. GRID → SINGLE COLUMN
 *     Elements with computed `display: grid` (styled-components or inline) get
 *     `mobile-grid-1col` so they stack vertically.
 *
 *  3. MODALS → BOTTOM SHEETS
 *     Full-screen `position: fixed` overlays (pinned to all four edges) get
 *     `mobile-sheet-overlay` and their content child gets `mobile-sheet-content`,
 *     which CSS turns into an iOS-style bottom sheet.
 *
 * Performance: on mount we scan the DOM once; afterwards we only inspect the
 * subtrees that React actually added/changed (MutationObserver + addedNodes),
 * so large pages (Arrivals, ledgers) stay smooth.
 */
const MobileViewEnhancer: React.FC = () => {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');

    // Rows already labeled (avoids re-scanning) + tables whose header layout we
    // already know (re-labels when the header signature changes, e.g. ledger views).
    const labeledRows = new WeakSet<HTMLTableRowElement>();
    const tableSignatures = new WeakMap<HTMLTableElement, string>();

    const labelTable = (table: HTMLTableElement) => {
      if (table.classList.contains('no-mobile-cards')) return;
      const headRow = table.querySelector('thead tr');
      if (!headRow) return;

      // Map headers to column indices, expanding colSpan so labels stay aligned
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

      table.classList.add('mobile-card-table');

      body.querySelectorAll('tr').forEach((row) => {
        const alreadyLabeled = labeledRows.has(row);
        if (alreadyLabeled && !headersChanged) return;
        labeledRows.add(row);

        const cells = Array.from(row.children) as HTMLTableCellElement[];
        const isSpecialRow =
          row.classList.contains('total-row') ||
          row.classList.contains('section-header') ||
          cells.some((c) => (c.colSpan || 1) > 1);

        let col = 0;
        cells.forEach((cell) => {
          const span = cell.colSpan || 1;
          if (isSpecialRow || span > 1) {
            cell.setAttribute('data-fullwidth', 'true');
            row.setAttribute('data-fullwidth-row', 'true');
          } else {
            cell.setAttribute('data-label', headerCells[col] || '');
          }
          col += span;
        });
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

      // Full-screen overlay = pinned to all four edges of the viewport
      const pinned = cs.top === '0px' && cs.left === '0px' && cs.right === '0px' && cs.bottom === '0px';
      if (!pinned) return;

      // Skip slide-in drawers whose child is also fixed (e.g. mobile nav menu)
      if (Array.from(el.children).some((c) => getComputedStyle(c as HTMLElement).position === 'fixed')) return;

      el.classList.add('mobile-sheet-overlay');
      const content = Array.from(el.children).find((c) => {
        const rc = getComputedStyle(c as HTMLElement);
        return (c as HTMLElement).offsetWidth > 0 && rc.position !== 'fixed';
      });
      if (content) content.classList.add('mobile-sheet-content');
    };

    // Inspect one element (or its subtree) for things we need to enhance
    const inspectNode = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      if (el.tagName === 'TABLE') labelTable(el as HTMLTableElement);
      else {
        el.querySelectorAll('table').forEach((t) => labelTable(t as HTMLTableElement));
      }

      if (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'FORM') tagGrid(el);
      el.querySelectorAll('[class*="Grid"], [class*="grid"]').forEach((g) => tagGrid(g as HTMLElement));

      // Overlays are usually top-level (portals) or added wholesale
      if (el.tagName === 'DIV' || el.tagName === 'SECTION') tagOverlay(el);
      el.querySelectorAll('div, section').forEach((o) => tagOverlay(o as HTMLElement));
    };

    const runFullScan = () => {
      if (!mq.matches) return;
      document.querySelectorAll('table').forEach((t) => labelTable(t as HTMLTableElement));
      document.querySelectorAll('[class*="Grid"], [class*="grid"]').forEach((g) => tagGrid(g as HTMLElement));
      document.querySelectorAll('body > div, body > section').forEach((o) => tagOverlay(o as HTMLElement));
      // Also catch in-tree fixed overlays (rendered inside Layout, not portals)
      document.querySelectorAll('div, section').forEach((o) => tagOverlay(o as HTMLElement));
    };

    // Initial scan (mobile only)
    runFullScan();

    // Observe additions/changes and process only what's new
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver((mutations) => {
      if (!mq.matches) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const m of mutations) {
          m.addedNodes.forEach(inspectNode);
          // Attributes like display/visibility toggles on modals
          if (m.type === 'attributes' && m.target instanceof HTMLElement) {
            if (m.attributeName === 'style' || m.attributeName === 'class') {
              inspectNode(m.target);
            }
          }
        }
        // Cheap safety pass: catch rows React updated in place (same node)
        document.querySelectorAll('table').forEach((t) => labelTable(t as HTMLTableElement));
      }, 120);
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
