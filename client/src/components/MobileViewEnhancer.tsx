import React, { useEffect } from 'react';
import { MOBILE_TABLE_LABELS } from '../mobile-labels';

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
/** Choose which column becomes the card's title — skip numbering & date columns,
 *  prefer party/name, then variety/broker/lorry/lot, then any meaningful column. */
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
    else if (/party|name/i.test(label)) score = 6;
    else if (/variety|broker|lorry|vehicle|lot/i.test(label)) score = 4;
    else if (/location|godown|village|town/i.test(label)) score = 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
};

/** Remember each cell's last text so status colours refresh when data changes. */
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

/** Colour-code status-like values so lists can be scanned fast. */
const detectStatus = (txt: string): 'good' | 'warn' | 'bad' | 'info' | '' => {
  if (!txt || txt.length > 40) return '';
  const t = txt.toLowerCase();
  if (/approved|completed|delivered|success|paid|verified|active|in-stock|in stock|stock-in|available/.test(t)) return 'good';
  if (/pending|awaiting|in progress|hold|partial|processing|scheduled|under|in-transit|in transit/.test(t)) return 'warn';
  if (/rejected|failed|cancelled|canceled|not ok|deficient|shortage|damaged|overdue|out of stock|out-of-stock/.test(t)) return 'bad';
  if (/received|submitted|reported|new/.test(t)) return 'info';
  return '';
};

const MobileViewEnhancer: React.FC = () => {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');

    // Rows already labeled (avoids re-scanning) + tables whose header layout we
    // already know (re-labels when the header signature changes, e.g. ledger views).
    const labeledRows = new WeakSet<HTMLTableRowElement>();
    const tableSignatures = new WeakMap<HTMLTableElement, string>();
    // First normal data row per table — recorded once, reused by the header card
    // so it always mirrors the same row the card layout is based on.
    const firstDataRows = new WeakMap<HTMLTableElement, HTMLTableRowElement>();

    const labelTable = (table: HTMLTableElement) => {
      if (table.classList.contains('no-mobile-cards')) return;
      // Skip our own aligned header row when looking for the real header row.
      let headRow = table.querySelector('thead tr:not(.mobile-card-header-row)');

      // Some tables keep their header row inside <tbody> as <th> cells — use that.
      let headerRowInBody = false;
      if (!headRow) {
        const bodyRows = table.tBodies[0] ? Array.from(table.tBodies[0].querySelectorAll('tr')) : [];
        const thRow = bodyRows.find((r) => r.querySelectorAll('th').length > 0 && r.querySelectorAll('td').length === 0 && !r.classList.contains('mobile-card-header-row'));
        if (thRow) {
          headRow = thRow;
          headerRowInBody = true;
        }
      }
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
      if (!body || body.querySelectorAll('tr').length === 0) {
        // Empty tables: still re-sync the header card (it no-ops until a source
        // row appears). This covers tables that render empty first and get rows
        // added in place by React later.
        syncHeaderCard(table);
        return;
      }

      const signature = headerCells.join('|');
      const headersChanged = tableSignatures.get(table) !== signature;
      tableSignatures.set(table, signature);

      // Per-table label dictionary: guarantees a real label for every value even
      // when the table's own headers are cryptic ("M%") or empty.
      const dict = MOBILE_TABLE_LABELS[signature];
      const labels = dict ? dict.labels : headerCells;
      const collapsedSet = dict && dict.collapsed ? new Set(dict.collapsed) : null;

      table.classList.add('mobile-card-table');
      if (labels.length >= 10) table.classList.add('mobile-card-dense');

      const titleIndex = pickTitleIndex(labels);

      let firstDataRow: HTMLTableRowElement | null = null;

      body.querySelectorAll('tr').forEach((row) => {
        // Hide the header row when it lives inside tbody (it's not a data card)
        if (headerRowInBody && row === headRow) {
          row.classList.add('mobile-header-row');
          return;
        }

        const alreadyLabeled = labeledRows.has(row);
        if (alreadyLabeled && !headersChanged) {
          // Refresh status colours when cell text changed in place (e.g. Pending→Approved)
          updateStatusPills(row);
          return;
        }
        labeledRows.add(row);

        const cells = Array.from(row.children) as HTMLTableCellElement[];
        const isSpecialRow =
          row.classList.contains('total-row') ||
          row.classList.contains('section-header') ||
          cells.some((c) => (c.colSpan || 1) > 1);
        if (!firstDataRow && !isSpecialRow && row.querySelectorAll('td').length > 0) {
          firstDataRow = row;
          firstDataRows.set(table, row);
        }

        let col = 0;
        let detailsCount = 0;
        cells.forEach((cell) => {
          const span = cell.colSpan || 1;
          if (isSpecialRow || span > 1) {
            row.setAttribute('data-fullwidth-row', 'true');
          } else {
            let label = labels[col] || '';

            // Never show a naked value: empty header + non-empty value → "Details"
            if (!label && (cell.textContent || '').trim()) {
              detailsCount++;
              label = detailsCount === 1 ? 'Details' : `Details ${detailsCount}`;
            }

            const isAction = !!cell.querySelector('button, a, input[type="button"], input[type="submit"]');

            cell.setAttribute('data-label', label);
            if (col === titleIndex) cell.setAttribute('data-card-title', 'true');
            if (isAction) cell.setAttribute('data-action', 'true');

            // Hide low-priority fields behind the "Show all" toggle (wide tables)
            if (collapsedSet && collapsedSet.has(label) && !isAction && col !== titleIndex) {
              cell.setAttribute('data-collapsed', 'true');
            }

            const status = detectStatus((cell.textContent || '').trim());
            if (status) cell.setAttribute('data-status-pill', status);
          }
          col += span;
        });

        updateStatusPills(row);

        // "Show all N more" toggle at the bottom of collapsible cards
        if (collapsedSet && !isSpecialRow) {
          const hidden = cells.filter((c) => c.hasAttribute('data-collapsed')).length;
          if (hidden > 0) {
            let toggle = row.querySelector('.mobile-card-toggle') as HTMLButtonElement | null;
            if (!toggle) {
              toggle = document.createElement('button');
              toggle.type = 'button';
              toggle.className = 'mobile-card-toggle';
              toggle.addEventListener('click', () => {
                const expanded = row.classList.toggle('mobile-card-expanded');
                if (toggle) toggle.textContent = expanded ? 'Show less' : `Show all ${hidden} more`;
              });
              row.appendChild(toggle);
            }
            toggle.textContent = row.classList.contains('mobile-card-expanded')
              ? 'Show less'
              : `Show all ${hidden} more`;
          }
        }
      });

      // Build an aligned "header card" that mirrors the card grid below it, so
      // every column name sits directly above its values (headers & data stay
      // in sync). Runs unconditionally (reads the first data row fresh from the
      // DOM) so it self-heals even if React clears/re-creates <thead> while the
      // tbody rows stay already-labeled.
      syncHeaderCard(table);
    };

    /** Find the row the header card should mirror (first normal data row). */
    const findHeaderSourceRow = (table: HTMLTableElement): HTMLTableRowElement | null => {
      const recorded = firstDataRows.get(table);
      if (recorded && recorded.isConnected && !recorded.classList.contains('mobile-header-row')) {
        return recorded;
      }
      const body = table.tBodies[0];
      if (!body) return null;
      const rows = Array.from(body.querySelectorAll('tr'));
      return (
        rows.find((r) => {
          if (r.classList.contains('mobile-header-row')) return false;
          if (r.classList.contains('total-row') || r.classList.contains('section-header')) return false;
          const cells = Array.from(r.children) as HTMLTableCellElement[];
          if (cells.length === 0) return false;
          return !cells.some((c) => (c.colSpan || 1) > 1);
        }) || null
      );
    };

    /** Render/refresh the aligned header card inside <thead>. */
    const syncHeaderCard = (table: HTMLTableElement) => {
      const firstDataRow = findHeaderSourceRow(table);
      if (!firstDataRow) return;

      // Keep the EXACT order and positions the cards use, so every header sits
      // directly above its value. Collapsed cells are skipped the same way the
      // cards hide them; cells that merely contain a link (date/party/godown)
      // stay, rendered full-width exactly like the card renders them; only the
      // genuine Actions column gets no header. Empty-label cells are kept as
      // blank slots — the card also renders them as (empty) grid items.
      const headerCells: { label: string; full: boolean; title: boolean }[] = [];
      const cells = Array.from(firstDataRow.children) as HTMLTableCellElement[];

      // The action row is the contiguous tail of button/link cells (conventionally
      // the last cell, sometimes labelled "Actions"). Everything from the first
      // action-ish cell to the end is the actions row → no headers for it.
      let firstActionIdx = -1;
      for (let i = cells.length - 1; i >= 0; i--) {
        const td = cells[i];
        if (!td.hasAttribute('data-action')) break;
        const label = td.getAttribute('data-label') || '';
        if (!/^(actions?|)$/i.test(label)) break;
        firstActionIdx = i;
      }

      cells.forEach((td, idx) => {
        if (td.hasAttribute('data-collapsed')) return; // hidden behind "Show all"
        const label = td.getAttribute('data-label') || '';
        const isActionColumn = idx >= firstActionIdx && firstActionIdx >= 0;
        if (isActionColumn) return; // action row needs no header
        const title = td.hasAttribute('data-card-title');
        // Full-width in the card (title + link cells) = spans both columns here too.
        const full = title || td.hasAttribute('data-action');
        headerCells.push({ label, title, full });
      });
      if (headerCells.length === 0) return;

      // Tables with headers inside <tbody> have no <thead> — create one.
      let thead = table.querySelector('thead');
      if (!thead) thead = table.createTHead();

      let headTr = thead.querySelector('tr.mobile-card-header-row') as HTMLTableRowElement | null;
      if (!headTr) {
        headTr = document.createElement('tr');
        headTr.className = 'mobile-card-header-row';
        thead.appendChild(headTr);
      }

      const expected = headerCells.map((h) => (h.title ? 'T' : h.full ? 'F' : '') + h.label);
      const current = Array.from(headTr.children).map(
        (th) =>
          (th.hasAttribute('data-header-title') ? 'T' : th.hasAttribute('data-header-full') ? 'F' : '') +
          (th.textContent || '').trim()
      );
      if (expected.length === current.length && expected.every((e, i) => e === current[i])) return;

      headTr.textContent = '';
      headerCells.forEach(({ label, title, full }) => {
        const th = document.createElement('th');
        th.textContent = label;
        // The card's own title cell keeps its special styling; other full-width
        // cells (e.g. link cells) just span the row like the card does.
        if (title) th.setAttribute('data-header-title', 'true');
        else if (full) th.setAttribute('data-header-full', 'true');
        headTr.appendChild(th);
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
      // Overlays: portals attach to body; in-tree ones (opened later) are caught
      // by the MutationObserver. Also catch inline `position: fixed` elements.
      document.querySelectorAll('body > *, [style*="position: fixed"], [style*="position:fixed"]')
        .forEach((o) => tagOverlay(o as HTMLElement));
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
