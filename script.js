const fs = require('fs');

const files = [
  'd:/projek/z.ai/sacms/src/app/api/tenant/[tenant]/license/activate/route.ts',
  'd:/projek/z.ai/sacms/src/app/api/tenant/[tenant]/settings/route.ts',
  'd:/projek/z.ai/sacms/src/app/api/tenant/[tenant]/infrastructure/route.ts',
  'd:/projek/z.ai/sacms/src/app/api/auth/user/plan/route.ts',
  'd:/projek/z.ai/sacms/src/app/(workspace)/dashboard/(global)/page.tsx',
  'd:/projek/z.ai/sacms/src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/single-types/page.tsx',
  'd:/projek/z.ai/sacms/src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/content-types/page.tsx',
  'd:/projek/z.ai/sacms/src/app/api/admin/stats/route.ts',
  'd:/projek/z.ai/sacms/src/app/(workspace)/dashboard/(global)/billing/page.tsx',
  'd:/projek/z.ai/sacms/src/app/api/admin/ai/generate-system/route.ts',
  'd:/projek/z.ai/sacms/src/app/(system)/admin/global/page.tsx',
  'd:/projek/z.ai/sacms/src/app/(system)/admin/settings/page.tsx',
  'd:/projek/z.ai/sacms/src/lib/tenant-plan.ts',
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('"sacms-global"')) {
      console.log('Fixing ' + file);
      
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('"sacms-global"')) {
          console.log(`\n--- ${file}:${i+1} ---`);
          console.log(line);
        }
      });
    }
  }
}
