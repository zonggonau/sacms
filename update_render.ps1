$files = @(
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\new\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\content-types\[slug]\[id]\edit\page.tsx",
    "src\app\(workspace)\dashboard\[tenant]\(dashboard)\content-type-builder\single-types\[singleTypeSlug]\single-type-detail-client.tsx",
    "src\components\content\field-renderers\component-field.tsx"
)

$importStr = "`nimport { getPluginFieldByType } from `"@/plugins/registry`""

$checkStr = @"

    if (field.type.startsWith("plugin::")) {
      const pluginField = getPluginFieldByType(field.type)
      if (pluginField) {
        const PluginComponent = pluginField.component
        return (
          <div className="space-y-2">
            <PluginComponent
              value={fieldValue !== undefined ? fieldValue : value}
              onChange={v => typeof handleFieldChange === 'function' ? handleFieldChange(field.slug, v) : onFieldChange(v)}
              label={field.name}
              required={field.required}
            />
          </div>
        )
      }
    }
"@

foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
        $content = Get-Content -LiteralPath $file -Raw
        
        if ($content -notmatch "getPluginFieldByType") {
            # Add import after RichTextField
            $content = $content -replace "(import \{ RichTextField \} from .*`r?`n)", "`$1$importStr`r`n"
            
            # Add plugin check before switch(field.type)
            $content = $content -replace "(switch\s*\(\s*field\.type\s*\)\s*\{)", "$checkStr`r`n    `$1"
            
            Set-Content -LiteralPath $file -Value $content
            Write-Host "Updated $file"
        }
    } else {
        Write-Host "Not found $file"
    }
}
