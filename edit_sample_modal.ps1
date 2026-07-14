# Read the file
$path = "C:\Users\maju\Downloads\stocks-main (2)\stocks-main\client\src\components\SampleEntryDetailModal.tsx"
$content = Get-Content $path -Raw

Write-Host "File length: $($content.Length)"

# 1. Add STATUS column header - replace PAYMENT th followed by </tr>
# Pattern: PAYMENT th close + newline + spaces + </tr>
$old1 = ">PAYMENT</th>`r`n                                                        </tr>"
$new1 = ">PAYMENT</th>`r`n                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '75px' }}>STATUS</th>`r`n                                                        </tr>"
$count1 = 0
$content = $content -replace [regex]::Escape($old1), $new1
if ($LASTEXITCODE -or $?) { Write-Host "Step 1 done" }

# Actually let me try with -replace operator
$content = $content -replace [regex]::Escape("<th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PAYMENT</th>"), "<th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PAYMENT</th>`r`n                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '75px' }}>STATUS</th>"

$count2 = 0
# 2. Replace 'Linked' cell with payment text + STATUS cell
# Find the pattern: td with tripRate ? 'Linked' : '-'
$old3 = "{tripRate ? (                                                                                'Linked'                                                                            ) : (                                                                                '-'                                                                            )}                                                                        </td>                                                                    </tr>"
$new3 = "{formatPaymentText(patti?.paymentConditionValue || 15, patti?.paymentConditionUnit || 'Days')}                                                                        </td>                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: '600' }}>                                                                            {tripRate ? (                                                                                <span style={{ color: '#1e88e5', fontWeight: 700, background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px', border: '1px solid #90caf9', fontSize: '10px' }}>LINKED</span>                                                                            ) : (                                                                                <span style={{ color: '#d97706', fontWeight: 700, background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '10px' }}>PENDING</span>                                                                            )}                                                                        </td>                                                                    </tr>"

# This is getting too complex. Let me try a simpler approach - use sed-like replacements
# Write the file
Set-Content -Path $path -Value $content -NoNewline
Write-Host "Done"
