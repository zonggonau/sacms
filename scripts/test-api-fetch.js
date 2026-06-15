
async function testFetch() {
  const token = "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"
  const baseUrl = "http://localhost:3001"
  const slug = "sacms-features"
  
  try {
    console.log(`Testing fetch for ${slug}...`)
    const res = await fetch(`${baseUrl}/api/public/content/${slug}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    
    console.log("Status:", res.status)
    const json = await res.json()
    console.log("Results count:", json.data?.length || 0)
    if (json.data?.length > 0) {
      console.log("First title:", json.data[0].title)
    } else {
      console.log("Full response:", JSON.stringify(json, null, 2))
    }
  } catch (err) {
    console.error("Fetch failed:", err.message)
  }
}

testFetch()
