import { loadConfig } from "./config";
import { createContainer } from "./container";
import { createApp } from "./http/app";

const config = loadConfig();
const container = createContainer(config);
const app = createApp(container);

for (const warning of container.warnings) {
  console.warn(`[config] ${warning}`);
}

app.listen(config.port, config.host, () => {
  console.log(
    `[api] listening on http://${config.host}:${config.port} ` +
      `(provider=${container.provider.id}, tools=${container.mcpServer.registry.size()})`,
  );
});
