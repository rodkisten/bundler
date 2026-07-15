import { env } from "./utils.mjs";
const url = env("PUSHCUT_URL", "https://api.pushcut.io/l-nh53UuliQPN7-1JMPbg/notifications/Bundler%20Build%20Published");
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ input: env("WORKFLOW_ID"), text: "Open browser bundle pipeline", title: "Build finished" }),
});
if (!response.ok) throw new Error(`Pushcut notification failed: ${response.status} ${response.statusText}`);
