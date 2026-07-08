$files = @(
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\new\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\[id]\edit\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\[singleTypeSlug]\single-type-detail-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(cms)\cms\content\[slug]\edit\[id]\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(cms)\cms\content\[slug]\new\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(cms)\cms\single-types\[slug]\page.tsx",
    "src\components\content\field-renderers\component-field.tsx"
)

foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
        $content = Get-Content -LiteralPath $file -Raw
        $content = $content -replace "(?s)[ \t]*if \(field\.type\.startsWith\(`"plugin::`"\)\) \{.*?\}[ \t]*\}[ \t]*\r?\n", ""
        Set-Content -LiteralPath $file -Value $content
        Write-Host "Removed plugin block from $file"
    }
}
