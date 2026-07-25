import assert from "node:assert/strict";
import test from "node:test";

import { pathIsWithin } from "../src/utils/vault_path.ts";

test("file watcher matches exact folders and descendants only", () => {
	assert.equal(pathIsWithin("Utility", "Utility"), true);
	assert.equal(pathIsWithin("Utility/Latex Suite.js", "Utility"), true);
	assert.equal(pathIsWithin("UtilityNested/Latex Suite.js", "Utility"), false);
	assert.equal(pathIsWithin("Other/Utility/Latex Suite.js", "Utility"), false);
});
