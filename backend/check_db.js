import dotenv from "dotenv";
dotenv.config();

import { dbManager } from "./db.ts";

async function run() {
  try {
    const statsToday = await dbManager.getDashboardStats("en", "2026-06-28");
    console.log("Stats for 2026-06-28:\n", JSON.stringify(statsToday, null, 2));

    const statsYesterday = await dbManager.getDashboardStats("en", "2026-06-27");
    console.log("Stats for 2026-06-27:\n", JSON.stringify(statsYesterday, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
