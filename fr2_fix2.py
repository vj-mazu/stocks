import io, sys

BASE = 'C:/Users/maju/Downloads/stocks-main/stocks-main/'

def apply(path, pairs):
    with io.open(BASE + path, 'r', encoding='utf-8', newline='') as f:
        content = f.read()
    nl = '\r\n' if '\r\n' in content else '\n'
    lines = content.split(nl)
    for old, new in pairs:
        old_lines = old.split('\n')
        new_lines = new.split('\n')
        found = False
        for i in range(len(lines) - len(old_lines) + 1):
            if all(lines[i + j].strip() == old_lines[j].strip() for j in range(len(old_lines))):
                indents = [lines[i + j][:len(lines[i + j]) - len(lines[i + j].lstrip())] for j in range(len(old_lines))]
                replaced = []
                for j, nl2 in enumerate(new_lines):
                    if nl2.strip() == '':
                        replaced.append('')
                    else:
                        indent = indents[min(j, len(indents) - 1)]
                        replaced.append(indent + nl2.strip())
                lines[i:i + len(old_lines)] = replaced
                found = True
                print(f'OK [{path}]: replaced block starting with {old_lines[0].strip()[:60]!r}')
                break
        if not found:
            print(f'FAIL [{path}]: could not match block starting with {old_lines[0].strip()[:80]!r}')
            sys.exit(1)
    with io.open(BASE + path, 'w', encoding='utf-8', newline='') as f:
        f.write(nl.join(lines))

WRAP = "maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25"

# ---- LoadingLots: FR2 badge spans no longer nowrap (fix cell overlap) ----
apply('client/src/pages/LoadingLots.tsx', [
    (
        "<span style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '1px 6px', display: 'inline-block', whiteSpace: 'nowrap' }}>FR2 Pending Approval</span>",
        "<span style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '1px 6px', display: 'inline-block', " + WRAP + " }}>FR2 Pending Approval</span>"
    ),
    (
        "<span style={{ fontSize: '9px', fontWeight: 800, color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '10px', padding: '1px 6px', display: 'inline-block', whiteSpace: 'nowrap' }}>Missing: {fr2MissingLabels.join(' | ')}</span>",
        "<span style={{ fontSize: '9px', fontWeight: 800, color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '10px', padding: '1px 6px', display: 'inline-block', " + WRAP + " }}>Missing: {fr2MissingLabels.join(' | ')}</span>"
    ),
    (
        "<span style={{ fontSize: '9px', fontWeight: 800, color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '10px', padding: '1px 6px', display: 'inline-block', whiteSpace: 'nowrap' }}>FR2 Need</span>",
        "<span style={{ fontSize: '9px', fontWeight: 800, color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '10px', padding: '1px 6px', display: 'inline-block', " + WRAP + " }}>FR2 Need</span>"
    ),
])

# ---- ManagerValueApprovals: FR2 pending summary shows only EDITED fields ----
OLD_SUM = (
    "const buildPendingSummary2 = (data?: Record<string, any> | null, offering?: Record<string, any>): PendingSummaryRow[] => {\n"
    "const pendingData = data || {};\n"
    "const rows: PendingSummaryRow[] = [];\n"
    "const pushRow = (key: string, label: string, value: string) => {\n"
    "rows.push({ key, label, value, tone: standardPendingFieldTone });\n"
    "};\n"
    "if (pendingData.finalBaseRate2 !== undefined && pendingData.finalBaseRate2 !== null && pendingData.finalBaseRate2 !== '') {\n"
    "pushRow('finalBaseRate2', 'Final Rate 2', `\u20b9${toDisplayNumber(pendingData.finalBaseRate2)} (${pendingData.finalBaseRateType2 || offering?.finalBaseRateType || offering?.baseRateType || 'PD/WB'})`);\n"
    "}\n"
    "if (pendingData.finalPrice2 !== undefined && pendingData.finalPrice2 !== null && pendingData.finalPrice2 !== '') {\n"
    "pushRow('finalPrice2', 'Final Price 2', `\u20b9${toDisplayNumber(pendingData.finalPrice2)}`);\n"
    "}\n"
    "if (pendingData.finalSute2 !== undefined && pendingData.finalSute2 !== null && pendingData.finalSute2 !== '') {\n"
    "pushRow('finalSute2', 'Sute 2', `${toDisplayNumber(pendingData.finalSute2)} ${formatChargeUnit(pendingData.finalSuteUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.hamali2 !== undefined && pendingData.hamali2 !== null && pendingData.hamali2 !== '') {\n"
    "pushRow('hamali2', 'Hamali 2', `${toDisplayNumber(pendingData.hamali2)} ${formatChargeUnit(pendingData.hamaliUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.brokerage2 !== undefined && pendingData.brokerage2 !== null && pendingData.brokerage2 !== '') {\n"
    "pushRow('brokerage2', 'Brokerage 2', `${toDisplayNumber(pendingData.brokerage2)} ${formatChargeUnit(pendingData.brokerageUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.lf2 !== undefined && pendingData.lf2 !== null && pendingData.lf2 !== '') {\n"
    "pushRow('lf2', 'LF 2', `${toDisplayNumber(pendingData.lf2)} ${formatChargeUnit(pendingData.lfUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.egbValue2 !== undefined && pendingData.egbValue2 !== null && pendingData.egbValue2 !== '') {\n"
    "pushRow('egbValue2', 'EGB 2', `${toDisplayNumber(pendingData.egbValue2)}${pendingData.egbType2 ? ` (${toTitleCase(pendingData.egbType2)})` : ''}`);\n"
    "}\n"
    "if (pendingData.cdValue2 !== undefined && pendingData.cdValue2 !== null && pendingData.cdValue2 !== '') {\n"
    "pushRow('cdValue2', 'CD 2', `${toDisplayNumber(pendingData.cdValue2)} ${formatChargeUnit(pendingData.cdUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.bankLoanValue2 !== undefined && pendingData.bankLoanValue2 !== null && pendingData.bankLoanValue2 !== '') {\n"
    "pushRow('bankLoanValue2', 'Bank Loan 2', `${toDisplayNumber(pendingData.bankLoanValue2)} ${formatChargeUnit(pendingData.bankLoanUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.paymentConditionValue2 !== undefined && pendingData.paymentConditionValue2 !== null && pendingData.paymentConditionValue2 !== '') {\n"
    "pushRow('paymentConditionValue2', 'Payment 2', `${toDisplayNumber(pendingData.paymentConditionValue2)} ${formatChargeUnit(pendingData.paymentConditionUnit2)}`.trim());\n"
    "}\n"
    "if (pendingData.finalRemarks2 !== undefined && pendingData.finalRemarks2 !== null && pendingData.finalRemarks2 !== '') {\n"
    "pushRow('finalRemarks2', 'Remarks 2', String(pendingData.finalRemarks2));\n"
    "}\n"
    "return rows;\n"
    "};"
)

NEW_SUM = (
    "const buildPendingSummary2 = (data?: Record<string, any> | null, offering?: Record<string, any>): PendingSummaryRow[] => {\n"
    "const pendingData = data || {};\n"
    "const rows: PendingSummaryRow[] = [];\n"
    "const pushRow = (key: string, label: string, value: string) => {\n"
    "rows.push({ key, label, value, tone: standardPendingFieldTone });\n"
    "};\n"
    "// Show only fields that were actually edited - i.e. differ from the currently\n"
    "// approved FR2 values. First-time FR2 (no current values) shows all fields.\n"
    "const edited = (key: string): boolean => {\n"
    "const p = pendingData[key];\n"
    "if (p === undefined || p === null || p === '') return false;\n"
    "const cur = offering ? offering[key] : null;\n"
    "if (cur === undefined || cur === null || cur === '') return true;\n"
    "return String(p) !== String(cur);\n"
    "};\n"
    "if (edited('finalBaseRate2')) {\n"
    "pushRow('finalBaseRate2', 'Final Rate 2', `\u20b9${toDisplayNumber(pendingData.finalBaseRate2)} (${pendingData.finalBaseRateType2 || offering?.finalBaseRateType || offering?.baseRateType || 'PD/WB'})`);\n"
    "}\n"
    "if (edited('finalPrice2')) {\n"
    "pushRow('finalPrice2', 'Final Price 2', `\u20b9${toDisplayNumber(pendingData.finalPrice2)}`);\n"
    "}\n"
    "if (edited('finalSute2')) {\n"
    "pushRow('finalSute2', 'Sute 2', `${toDisplayNumber(pendingData.finalSute2)} ${formatChargeUnit(pendingData.finalSuteUnit2)}`.trim());\n"
    "}\n"
    "if (edited('hamali2')) {\n"
    "pushRow('hamali2', 'Hamali 2', `${toDisplayNumber(pendingData.hamali2)} ${formatChargeUnit(pendingData.hamaliUnit2)}`.trim());\n"
    "}\n"
    "if (edited('brokerage2')) {\n"
    "pushRow('brokerage2', 'Brokerage 2', `${toDisplayNumber(pendingData.brokerage2)} ${formatChargeUnit(pendingData.brokerageUnit2)}`.trim());\n"
    "}\n"
    "if (edited('lf2')) {\n"
    "pushRow('lf2', 'LF 2', `${toDisplayNumber(pendingData.lf2)} ${formatChargeUnit(pendingData.lfUnit2)}`.trim());\n"
    "}\n"
    "if (edited('egbValue2')) {\n"
    "pushRow('egbValue2', 'EGB 2', `${toDisplayNumber(pendingData.egbValue2)}${pendingData.egbType2 ? ` (${toTitleCase(pendingData.egbType2)})` : ''}`);\n"
    "}\n"
    "if (edited('cdValue2')) {\n"
    "pushRow('cdValue2', 'CD 2', `${toDisplayNumber(pendingData.cdValue2)} ${formatChargeUnit(pendingData.cdUnit2)}`.trim());\n"
    "}\n"
    "if (edited('bankLoanValue2')) {\n"
    "pushRow('bankLoanValue2', 'Bank Loan 2', `${toDisplayNumber(pendingData.bankLoanValue2)} ${formatChargeUnit(pendingData.bankLoanUnit2)}`.trim());\n"
    "}\n"
    "if (edited('paymentConditionValue2')) {\n"
    "pushRow('paymentConditionValue2', 'Payment 2', `${toDisplayNumber(pendingData.paymentConditionValue2)} ${formatChargeUnit(pendingData.paymentConditionUnit2)}`.trim());\n"
    "}\n"
    "if (edited('finalRemarks2')) {\n"
    "pushRow('finalRemarks2', 'Remarks 2', String(pendingData.finalRemarks2));\n"
    "}\n"
    "return rows;\n"
    "};"
)

apply('client/src/pages/ManagerValueApprovals.tsx', [(OLD_SUM, NEW_SUM)])

print('FR2 FIXES APPLIED')
