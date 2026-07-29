export const caseStatuses = [
  "New",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
  "Reopened"
] as const;

export const priorities = ["Low", "Medium", "High", "Critical"] as const;

export const roles = [
  "Admin",
  "Customer Service",
  "Product Manager",
  "Product User"
] as const;

export const messageChannels = ["Email", "SMS", "Internal Note"] as const;
