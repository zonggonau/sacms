const fs = require('fs');
const path = require('path');

const files = [
    "src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/content-types/[slug]/new/page.tsx",
    "src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/content-types/[slug]/[id]/edit/page.tsx",
    "src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/single-types/[singleTypeSlug]/single-type-detail-client.tsx",
    "src/app/(workspace)/dashboard/[tenant]/(cms)/cms/content/[slug]/edit/[id]/page.tsx",
    "src/app/(workspace)/dashboard/[tenant]/(cms)/cms/content/[slug]/new/page.tsx",
    "src/app/(workspace)/dashboard/[tenant]/(cms)/cms/single-types/[slug]/page.tsx",
    "src/components/content/field-renderers/component-field.tsx"
];

for (const file of files) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // Find the start of the if statement
        const startIndex = content.indexOf('    if (field.type.startsWith("plugin::")) {');
        if (startIndex !== -1) {
            // Find the end of the block
            const endString = '      }\r\n    }';
            const endString2 = '      }\n    }';
            let endIndex = content.indexOf(endString, startIndex);
            let endLength = endString.length;
            
            if (endIndex === -1) {
                endIndex = content.indexOf(endString2, startIndex);
                endLength = endString2.length;
            }

            if (endIndex !== -1) {
                const before = content.substring(0, startIndex);
                const after = content.substring(endIndex + endLength);
                content = before + after;
                
                // Clean up any double blank lines left behind
                content = content.replace(/\n\s*\n\s*switch/g, '\n\n    switch');
                
                fs.writeFileSync(fullPath, content);
                console.log("Cleaned", file);
            } else {
                console.log("Could not find end of block in", file);
            }
        } else {
             console.log("Could not find start of block in", file);
        }
    } else {
        console.log("Not found", file);
    }
}
