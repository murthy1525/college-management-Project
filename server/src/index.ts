import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`CMS API listening on http://localhost:${env.port}`);
});
