import { createApp } from "./app.js";
import { getConfig } from "./config.js";

const cfg = getConfig();
const app = createApp(cfg);

app.listen(cfg.port, "127.0.0.1", () => {
  console.log(`Server running on http://localhost:${cfg.port}`);
});
