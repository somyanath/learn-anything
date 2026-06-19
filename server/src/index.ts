import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
