import { discoverSessions } from "../src/index.js";
import { createExampleClaudeRoot } from "./support.js";

const claudeRoot = await createExampleClaudeRoot();
const sessions = await discoverSessions({ roots: [claudeRoot] });

console.log(JSON.stringify(sessions, null, 2));
