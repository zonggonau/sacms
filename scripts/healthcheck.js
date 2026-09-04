const port = process.env.PORT || 3000;
const url = `http://127.0.0.1:${port}/api/health`;

fetch(url)
  .then((res) => {
    if (res.ok) {
      process.exit(0);
    }
    console.error(`Healthcheck returned status ${res.status}`);
    process.exit(1);
  })
  .catch((err) => {
    console.error("Healthcheck request error:", err.message);
    process.exit(1);
  });
