# Edit SampleEntryDetailModal.tsx - Add STATUS column and fix PAYMENT column
param(
    [string]$FilePath
)

$content = Get-Content $FilePath -Raw

# 1. Add STATUS column header after PAYMENT
$old1 = '<th style="padding: 8px; font-weight: 800; text-align: center; border: 1px solid #cbd5e1">PAYMENT</th>
                                                        </tr>'

$new1 = '<th style="padding: 8px; font-weight: 800; text-align: center; border: 1px solid #cbd5e1">PAYMENT</th>
                                                             <th style="padding: 8px; font-weight: 800; text-align: center; border: 1px solid #cbd5e1; width: 75px">STATUS</th>
                                                        </tr>'

if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "Step 1: Added STATUS column header - OK"
} else {
    Write-Host "Step 1: Pattern not found!"
}

# 2. Replace the PAYMENT cell (Linked) with payment text and add STATUS cell
$old2 = '<td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600">
                                                                            {tripRate ? (
                                                                                ''Linked''
                                                                            ) : (
                                                                                ''-''
                                                                            )}
                                                                        </td>
                                                                    </tr>'

$new2 = '<td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600">
                                                                            <span style="font-weight: 600">{formatPaymentText(patti?.paymentConditionValue || 15, patti?.paymentConditionUnit || ''Days'')}</span>
                                                                        </td>
                                                                        <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600">
                                                                            {tripRate ? (
                                                                                <span style="color: #1e88e5; font-weight: 700; background: #e3f2fd; padding: 2px 8px; border-radius: 4px; border: 1px solid #90caf9; font-size: 10px">LINKED</span>
                                                                            ) : (
                                                                                <span style="color: #d97706; font-weight: 700; background: #fffbeb; padding: 2px 8px; border-radius: 4px; border: 1px solid #fde68a; font-size: 10px">PENDING</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>'

if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    Write-Host "Step 2: Replaced PAYMENT cell with STATUS cell - OK"
} else {
    Write-Host "Step 2: Pattern not found!"
}

# 3. Update colSpan from 13 to 14
$old3 = '<td colSpan={13} style="padding: 12px'
$new3 = '<td colSpan={14} style="padding: 12px'

if ($content.Contains($old3)) {
    $content = $content.Replace($old3, $new3)
    Write-Host "Step 3: Updated colSpan - OK"
} else {
    Write-Host "Step 3: Pattern not found!"
}

Set-Content -Path $FilePath -Value $content -NoNewline
Write-Host "File saved successfully!"
