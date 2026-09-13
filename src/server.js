import app from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./config/database.js";
<<<<<<< HEAD
import { ensureDefaultServices } from "./controllers/service.controller.js";
=======
>>>>>>> db014bebcde242caf929d304adec53b190769e17

async function startServer() {
  try {
    await checkDatabaseConnection();

<<<<<<< HEAD
    // Bootstrap the service catalog on every deployment/start. This makes
    // production safe even when seed.sql was never imported into MySQL.
    const serviceCount = await ensureDefaultServices();
    console.log(`AGX service catalog ready: ${serviceCount} active services`);

=======
>>>>>>> db014bebcde242caf929d304adec53b190769e17
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
