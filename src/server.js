// src/server.js
//
// Entry point. Run with: node src/server.js
// (or set up "dev": "node src/server.js" / nodemon in package.json)

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Payslip API listening on http://localhost:${PORT}`);
});
