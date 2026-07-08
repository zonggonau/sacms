$files = @(
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\components\new\new-component-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\components\[componentSlug]\component-detail-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\components\[componentSlug]\edit\edit-component-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\edit\[slug]\edit-content-type-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\new\new-content-type-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\new\new-single-type-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\[singleTypeSlug]\edit\edit-single-type-client.tsx"
)

foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
        $content = Get-Content -LiteralPath $file -Raw
        $content = $content -replace "import \{ FIELD_TYPES \}", "import { getAllFieldTypes }"
        $content = $content -replace "import \{ FIELD_TYPES, FIELD_CATEGORIES \}", "import { getAllFieldTypes, FIELD_CATEGORIES }"
        $content = $content -replace "FIELD_TYPES\.find", "getAllFieldTypes().find"
        $content = $content -replace "FIELD_TYPES\.filter", "getAllFieldTypes().filter"
        Set-Content -LiteralPath $file -Value $content
        Write-Host "Updated $file"
    } else {
        Write-Host "Not found $file"
    }
}
