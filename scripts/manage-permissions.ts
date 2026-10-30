import { createClient } from "@wix/sdk";
import * as appPermissions from "@wix/auto_sdk_app-management_app-permissions";
import { execSync } from "child_process";

// Application ID
const appId = "3525674a-5e85-4ad6-b8d8-e221cdf17c7b";

// Desired scopes for Order Editor & Upsell app
const REQUIRED_SCOPES = [
  "SCOPE.ECOM.DRAFT-ORDERS",
  "SCOPE.DC-ECOM-MEGA.MANAGE-ECOM",
  "SCOPE.DC-STORES.MANAGE-ORDERS",
  "SCOPE.DC-STORES.READ-ORDERS",
  "SCOPE.DC-STORES.READ-PRODUCTS",
  "SCOPE.DC-DATA.MANAGE-DATA",
  "SCOPE.DC-PROMOTE.EMAIL-MARKETING"
];

function getWixToken(): string {
  try {
    return execSync("npx wix token", { encoding: "utf8" }).trim();
  } catch (err) {
    console.error("Failed to obtain Wix CLI token. Run 'npx wix login' first.");
    process.exit(1);
  }
}

async function main() {
  const token = getWixToken();
  const client = createClient({
    modules: { appPermissions },
    auth: {
      getAuthHeaders: async () => ({
        headers: {
          Authorization: token
        }
      })
    }
  });

  console.log(`Checking permissions for App ID: ${appId}...\n`);

  // 1. Fetch current permissions
  const existing = await client.appPermissions.listAppPermissions(appId);
  const existingIds = new Set(
    ((existing.appPermissions ?? []) as any[]).map((p) => p.permission?.permissionId).filter(Boolean)
  );

  console.log("Currently configured permissions:");
  for (const id of existingIds) {
    console.log(`  ✓ ${id}`);
  }

  // 2. Add missing scopes
  const toAdd = REQUIRED_SCOPES.filter((s) => !existingIds.has(s));
  if (toAdd.length === 0) {
    console.log("\nAll required permission scopes are already configured!");
    return;
  }

  console.log(`\nAdding ${toAdd.length} missing permission scopes...`);
  for (const scopeId of toAdd) {
    try {
      await client.appPermissions.createAppPermission({
        appId,
        permission: { permissionId: scopeId }
      });
      console.log(`  + Added: ${scopeId}`);
    } catch (err: any) {
      console.error(`  x Failed to add ${scopeId}:`, err.message || err);
    }
  }

  console.log("\nPermission synchronization complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
