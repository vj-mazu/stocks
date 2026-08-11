/**
 * Per-table mobile label dictionaries.
 *
 * Keyed by the table's joined <th> header text exactly as read from the DOM.
 * Guarantees that every value inside a mobile card has a REAL label, even when
 * the table's own headers are cryptic (e.g. "M%") or empty — this is the
 * "which column is which" problem.
 *
 * `labels`   — the exact column labels to show on mobile (index-aligned).
 * `collapsed`— field labels hidden behind a "Show all N more" toggle, so very
 *              wide tables produce compact cards instead of full-screen ones.
 *
 * Desktop & tablet are unaffected (this only feeds the mobile card layer).
 */
export interface MobileTableLabels {
  labels: string[];
  collapsed?: string[];
}

export const MOBILE_TABLE_LABELS: Record<string, MobileTableLabels> = {
  /* Paddy / Rice Sample Book ledger — cryptic quality codes → full labels.
     The 20 quality / WB fields collapse behind a toggle so the card stays short. */
  'No|Date|Type|Broker|Variety|Party|Paddy Location|Bags|Lorry|Status|M%|Cut|Bend|Mix S|Mix L|Mix|Kandu|Oil|SK|Grains|WB R|WB Bk|WB T|Paddy WB|Q.Supv|Cook|Decision|By|Offer ₹|P.Type|Final ₹|Supervisor|Act.Bags|Gross|Tare|Net Wt|Rate Info|Base Rate|Total Amt|Avg Rate|': {
    labels: [
      'No', 'Date', 'Type', 'Broker', 'Variety', 'Party', 'Paddy Location',
      'Bags', 'Lorry', 'Status',
      'Moisture %', 'Cutting %', 'Bend %', 'Mix Small %', 'Mix Large %',
      'Mixed %', 'Kandu %', 'Oil %', 'SK %', 'Grains %',
      'WB Raw', 'WB Broken', 'WB Total', 'Paddy WB',
      'Quality Supv.', 'Cooking', 'Decision', 'By', 'Offer (₹)', 'Paddy Type',
      'Final (₹)', 'Supervisor', 'Act. Bags', 'Gross', 'Tare', 'Net Wt',
      'Rate Info', 'Base Rate', 'Total Amt', 'Avg Rate', '',
    ],
    collapsed: [
      'Moisture %', 'Cutting %', 'Bend %', 'Mix Small %', 'Mix Large %',
      'Mixed %', 'Kandu %', 'Oil %', 'SK %', 'Grains %',
      'WB Raw', 'WB Broken', 'WB Total', 'Paddy WB',
      'Quality Supv.', 'Cooking', 'Decision', 'By', 'Offer (₹)', 'Paddy Type',
      'Final (₹)', 'Supervisor', 'Act. Bags', 'Gross', 'Tare', 'Net Wt',
      'Rate Info', 'Base Rate', 'Total Amt', 'Avg Rate', '',
    ],
  },

  /* Arrivals — full labels + collapse the less-used WB/detail columns. */
  'SL No|Date|Broker|Party Name|Godown|No. of Bags|Variety|Moisture|Cutting|WB Number|Mill WB Name|Sute Net Wt|Lorry Number|Status|Actions': {
    labels: [
      'SL No', 'Date', 'Broker', 'Party Name', 'Godown', 'No. of Bags',
      'Variety', 'Moisture %', 'Cutting %', 'WB Number', 'Mill WB Name',
      'Sute Net Wt', 'Lorry Number', 'Status', 'Actions',
    ],
    collapsed: ['Cutting %', 'WB Number', 'Mill WB Name', 'Sute Net Wt', 'Lorry Number'],
  },

  /* Records Management — Rice Stock Movement: full labels + collapse detail cols. */
  'SL No|Date|Type|Broker|From|To Kunchinittu|To Warehouse|Outturn|Variety|Bags|Moisture|Cutting|WB No|Gross Weight|Tare Weight|Net Weight|Lorry No|Status|Actions': {
    labels: [
      'SL No', 'Date', 'Type', 'Broker', 'From', 'To Kunchinittu', 'To Warehouse',
      'Outturn', 'Variety', 'Bags', 'Moisture %', 'Cutting %', 'WB No',
      'Gross Wt', 'Tare Wt', 'Net Wt', 'Lorry No', 'Status', 'Actions',
    ],
    collapsed: ['Outturn', 'Bags', 'Moisture %', 'Cutting %', 'WB No', 'Gross Wt', 'Tare Wt', 'Net Wt', 'Lorry No'],
  },

  /* Manager / Owner Sample Reports — 24 cryptic columns: full labels + collapse. */
  'Sl|Type|Bags|Pkg|Party|Loc|Variety|Collected By|Report By|Quality|Cooking|Rate|Sute|Mst%|Bkrg|LF|Hamali|CD|EGB|Bank Ln|Pay|Reason|Status|Action': {
    labels: [
      'Sl', 'Type', 'Bags', 'Pkg', 'Party', 'Location', 'Variety',
      'Collected By', 'Report By', 'Quality', 'Cooking', 'Rate (₹)', 'Sute',
      'Moisture %', 'Brokerage', 'Lorry Freight', 'Hamali', 'CD', 'EGB',
      'Bank Loan', 'Pay', 'Reason', 'Status', 'Action',
    ],
    collapsed: [
      'Rate (₹)', 'Sute', 'Moisture %', 'Brokerage', 'Lorry Freight', 'Hamali',
      'CD', 'EGB', 'Bank Loan', 'Pay', 'Reason',
    ],
  },
};
