# Delete folders
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "src\app\(workspace)\dashboard\[tenant]\(dashboard)\plugins"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "src\plugins"

$files = @(
    "src\app\(workspace)\dashboard\[tenant]\(cms)\cms\content\[slug]\edit\[id]\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(cms)\cms\content\[slug]\new\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(cms)\cms\single-types\[slug]\page.tsx",
    "src\components\content\field-renderers\component-field.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\new\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\[id]\edit\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\[singleTypeSlug]\single-type-detail-client.tsx"
)

# Remove the plugin block
foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
        $content = Get-Content -LiteralPath $file -Raw
        $content = $content -replace "import \{ getPluginFieldByType \} from `"@/plugins/registry`"`r?`n", ""
        $content = $content -replace "(?s)    if \(field\.type\.startsWith\(`"plugin::`"\)\) \{.*?    \}`r?`n`r?`n", ""
        Set-Content -LiteralPath $file -Value $content
        Write-Host "Removed plugin block from $file"
    }
}

# Revert field-types.ts
$fieldTypes = "src\lib\field-types.ts"
if (Test-Path -LiteralPath $fieldTypes) {
    $content = Get-Content -LiteralPath $fieldTypes -Raw
    $content = $content -replace "import \{ getAllPluginFields \} from `"@/plugins/registry`"`r?`n", ""
    $content = $content -replace "  `"Plugins`",`r?`n", ""
    $content = $content -replace "(?s)export function getAllFieldTypes\(\) \{.*?return \[\.\.\.FIELD_TYPES, \.\.\.pluginFields\]`r?`n\}`r?`n`r?`n", ""
    Set-Content -LiteralPath $fieldTypes -Value $content
    Write-Host "Reverted field-types.ts"
}

# Revert tenant-sidebar.tsx
$sidebar = "src\components\dashboard\tenant-sidebar.tsx"
if (Test-Path -LiteralPath $sidebar) {
    $content = Get-Content -LiteralPath $sidebar -Raw
    $content = $content -replace "import \{ getAllPluginSidebarItems \} from `"@/plugins/registry`"`r?`n", ""
    $content = $content -replace "        \{ title: `"Plugins`", href: `"/plugins`", icon: Puzzle, badge: `"NEW`" \},`r?`n", ""
    $content = $content -replace "        \.\.\.getAllPluginSidebarItems\(\),`r?`n", ""
    # Remove Puzzle from import
    $content = $content -replace ", Puzzle", ""
    Set-Content -LiteralPath $sidebar -Value $content
    Write-Host "Reverted tenant-sidebar.tsx"
}

# Revert getAllFieldTypes -> FIELD_TYPES
$builderFiles = @(
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\components\new\new-component-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\components\[componentSlug]\component-detail-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\components\[componentSlug]\edit\edit-component-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\edit\[slug]\edit-content-type-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\new\new-content-type-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\new\new-single-type-client.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\[singleTypeSlug]\edit\edit-single-type-client.tsx",
    "src\components\cms\field-config-modal.tsx",
    "src\components\cms\field-type-selector.tsx"
)

foreach ($file in $builderFiles) {
    if (Test-Path -LiteralPath $file) {
        $content = Get-Content -LiteralPath $file -Raw
        $content = $content -replace "import \{ getAllFieldTypes \}", "import { FIELD_TYPES }"
        $content = $content -replace "import \{ getAllFieldTypes, FIELD_CATEGORIES \}", "import { FIELD_TYPES, FIELD_CATEGORIES }"
        $content = $content -replace "getAllFieldTypes\(\)\.find", "FIELD_TYPES.find"
        $content = $content -replace "getAllFieldTypes\(\)\.filter", "FIELD_TYPES.filter"
        Set-Content -LiteralPath $file -Value $content
        Write-Host "Reverted getAllFieldTypes in $file"
    }
}
