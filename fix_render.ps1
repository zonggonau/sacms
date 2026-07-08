$files = @(
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\new\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\[id]\edit\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\[singleTypeSlug]\single-type-detail-client.tsx",
    "src\components\content\field-renderers\component-field.tsx"
)

foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
        $content = Get-Content -LiteralPath $file -Raw
        
        $content = $content -replace "value=\{fieldValue !== undefined \? fieldValue : value\}", "value={value}"
        $content = $content -replace "onChange=\{v => typeof handleFieldChange === 'function' \? handleFieldChange\(field.slug, v\) : onFieldChange\(v\)\}", "onChange={v => handleFieldChange(field.slug, v)}"
        
        Set-Content -LiteralPath $file -Value $content
        Write-Host "Updated $file"
    } else {
        Write-Host "Not found $file"
    }
}
