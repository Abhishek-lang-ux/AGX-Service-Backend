import app from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./config/database.js";

async function startServer() {
  try {
    await checkDatabaseConnection();

    app.listen(env.port, () => {
      console.log(`AGX API running on http://localhost:${env.port}`);
      console.log(`Environment: ${env.nodeEnv}`);
    });
  } catch (error) {
    console.error("Unable to start AGX API:", error.message);
    process.exit(1);
  }
}

startServer();
