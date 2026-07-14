$path = "C:\Users\maju\Downloads\stocks-main (2)\stocks-main\client\src\components\SampleEntryDetailModal.tsx"
$content = Get-Content $path -Raw

# Step 1: Add STATUS column header after PAYMENT header
# Match the exact text with single quotes
$search1 = "}>PAYMENT</th>"
$replace1 = "}>PAYMENT</th><th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '75px' }}>STATUS</th>"
$content = $content.Replace($search1, $replace1)
Write-Host "Step 1 done: Added STATUS header"

# Step 2: Replace 'Linked' cell with payment text
$search2 = "{tripRate ? (                                                                                'Linked'                                                                            ) : (                                                                                '-'                                                                            )}                                                                        </td>                                                                    </tr>"
$replace2 = "{formatPaymentText(patti?.paymentConditionValue || 15, patti?.paymentConditionUnit || 'Days')}                                                                        </td>                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: '600' }}>                                                                            {tripRate ? (                                                                                <span style={{ color: '#1e88e5', fontWeight: 700, background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px', border: '1px solid #90caf9', fontSize: '10px' }}>LINKED</span>                                                                            ) : (                                                                                <span style={{ color: '#d97706', fontWeight: 700, background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '10px' }}>PENDING</span>                                                                            )}                                                                        </td>                                                                    </tr>"
$content = $content.Replace($search2, $replace2)
Write-Host "Step 2 done: Replaced Linked cell"

# Step 3: Update colSpan
$search3 = "colSpan={13} style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', border: '1px solid #cbd5e1' }}>"
$replace3 = "colSpan={14} style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', border: '1px solid #cbd5e1' }}>"
$content = $content.Replace($search3, $replace3)
Write-Host "Step 3 done: Updated colSpan"

Set-Content -Path $path -Value $content -NoNewline
Write-Host "All done!"
