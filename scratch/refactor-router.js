const fs = require('fs')
const path = require('path')

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')

  content = content.replace(
    /window\.location\.href = '\/dashboard'/g,
    `router.push('/dashboard')`
  )
  content = content.replace(
    /window\.location\.href = '\/dashboard\/templates'/g,
    `router.push('/dashboard/templates')`
  )
  content = content.replace(
    /window\.location\.href = '\/dashboard\/billing'/g,
    `router.push('/dashboard/billing')`
  )

  fs.writeFileSync(filePath, content)
  console.log(`Updated router in ${filePath}`)
}

const base = 'd:\\projek\\z.ai\\sacms\\src\\app\\dashboard\\(global)'

processFile(path.join(base, 'page.tsx'))
processFile(path.join(base, 'templates', 'page.tsx'))
processFile(path.join(base, 'billing', 'page.tsx'))
