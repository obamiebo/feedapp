import type { AppUser, FeedbackCase, SlaPolicy } from "@/domain/types";

export const departments = [
  { id: "dept-products", name: "Products" },
  { id: "dept-payments", name: "Payments" },
  { id: "dept-logistics", name: "Logistics" }
];

export const currentUser: AppUser = {
  id: "user-cs-1",
  email: "service.rep@example.com",
  name: "Customer Service Rep",
  roles: ["Customer Service"],
  departmentIds: ["dept-products", "dept-payments", "dept-logistics"],
  directProductSourceKeys: ["commerce-platform", "support-form", "product-api"],
  productSourceKeys: ["commerce-platform", "support-form", "product-api"],
  productGroupIds: [],
  assignedCaseIds: ["case-1001", "case-1002"],
  provisioned: true
};

export const demoCases: FeedbackCase[] = [
  {
    id: "case-1001",
    title: "Customer cannot complete checkout",
    description: "Payment succeeds but the order confirmation never loads.",
    status: "In Progress",
    priority: "Critical",
    departmentId: "dept-payments",
    assigneeId: "user-cs-1",
    customerId: "customer-2001",
    sourceSystem: "commerce-platform",
    externalId: "COM-8842",
    slaDeadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 20 * 60 * 1000)
  },
  {
    id: "case-1002",
    title: "Feedback on delivery notifications",
    description: "Customer says SMS delivery updates arrive late.",
    status: "Assigned",
    priority: "Medium",
    departmentId: "dept-logistics",
    assigneeId: "user-cs-1",
    customerId: "customer-2002",
    sourceSystem: "support-form",
    externalId: "SUP-1902",
    slaDeadlineAt: new Date(Date.now() + 18 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000)
  },
  {
    id: "case-1003",
    title: "Product recommendation opportunity",
    description: "Customer reports limits in current package and may need an analytics add-on.",
    status: "New",
    priority: "Low",
    departmentId: "dept-products",
    customerId: "customer-2003",
    sourceSystem: "product-api",
    externalId: "PROD-4471",
    slaDeadlineAt: new Date(Date.now() + 46 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 90 * 60 * 1000),
    updatedAt: new Date(Date.now() - 90 * 60 * 1000)
  }
];

export const defaultSlaPolicies: SlaPolicy[] = [
  {
    departmentId: "dept-payments",
    priority: "Critical",
    responseTargetHours: 1,
    resolutionTargetHours: 8,
    escalationTargetHours: 2
  },
  {
    departmentId: "dept-logistics",
    priority: "Medium",
    responseTargetHours: 4,
    resolutionTargetHours: 24,
    escalationTargetHours: 12
  }
];
