// Same page, reached from inside the Developer Portal shell (DeveloperLayout
// + DeveloperSidebar) instead of the main dashboard shell (TenantSidebar) —
// so navigating here from Schema/Content Types/MCP/etc. never swaps sidebars.
// The canonical implementation stays at (dashboard)/infrastructure/page.tsx;
// every other reference to that route (error messages, the main dashboard's
// own sidebar link, etc.) keeps working unchanged.
export { default } from "../../(dashboard)/infrastructure/page"
