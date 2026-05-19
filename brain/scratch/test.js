const { Pool } = require("pg");
require("dotenv").config();

// Strip out query parameters to prevent pg-connection-string from overriding our custom SSL config
const cleanUrl = process.env.DATABASE_URL.split("?")[0];

console.log("Connecting with clean URL:", cleanUrl);
const pool = new Pool({
  connectionString: cleanUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Query failed:", err);
  } else {
    console.log("Query succeeded! Current time:", res.rows[0].now);
  }
  pool.end();
});
