import type { AppUser, FeedbackCase, Role } from "@/domain/types";

export function canEnterApplication(user: Pick<AppUser, "provisioned">): boolean {
  return user.provisioned;
}

export function hasRole(user: AppUser, role: Role): boolean {
  return user.roles.includes(role);
}

export function canViewCase(user: AppUser, feedbackCase: FeedbackCase): boolean {
  if (!canEnterApplication(user)) return false;

  const assignedDirectly = user.assignedCaseIds?.includes(feedbackCase.id) ?? false;
  const scopedToProduct = user.productSourceKeys.includes(feedbackCase.sourceSystem);

  if (hasRole(user, "Customer Service")) {
    return assignedDirectly || scopedToProduct;
  }

  if (hasRole(user, "Product Manager") || hasRole(user, "Product User")) {
    return scopedToProduct;
  }

  return false;
}

export function canCloseOrReopenCase(user: AppUser): boolean {
  return canEnterApplication(user) && hasRole(user, "Customer Service");
}

export function canCreateCase(user: AppUser): boolean {
  return canEnterApplication(user) && hasRole(user, "Customer Service");
}

export function canAssignCase(user: AppUser, feedbackCase: FeedbackCase): boolean {
  return canViewCase(user, feedbackCase);
}

export function canBeAssignedToCase(user: AppUser, feedbackCase: FeedbackCase): boolean {
  return canViewCase(user, feedbackCase);
}

export function canManageProductRoster(user: AppUser, sourceKey: string): boolean {
  if (!canEnterApplication(user)) return false;
  if (hasRole(user, "Admin")) return true;
  return hasRole(user, "Product Manager") && user.directProductSourceKeys.includes(sourceKey);
}

export function canManageProductKnowledge(user: AppUser, sourceKey: string): boolean {
  if (!canEnterApplication(user)) return false;
  if (hasRole(user, "Admin")) return true;
  return hasRole(user, "Product Manager") && user.directProductSourceKeys.includes(sourceKey);
}

export function canSearchProductKnowledge(user: AppUser, sourceKey: string): boolean {
  if (!canEnterApplication(user)) return false;
  return canManageProductKnowledge(user, sourceKey) || user.productSourceKeys.includes(sourceKey);
}

export function canManageAnyProductRoster(user: AppUser): boolean {
  if (!canEnterApplication(user)) return false;
  return hasRole(user, "Admin") || (hasRole(user, "Product Manager") && user.directProductSourceKeys.length > 0);
}

export function canAddInternalNote(user: AppUser, feedbackCase: FeedbackCase): boolean {
  return canViewCase(user, feedbackCase);
}

export function canRequestCustomerReplyApproval(user: AppUser, feedbackCase: FeedbackCase): boolean {
  return canViewCase(user, feedbackCase);
}

export function canTransitionCase(user: AppUser, feedbackCase: FeedbackCase, nextStatus: FeedbackCase["status"]): boolean {
  if (!canViewCase(user, feedbackCase)) return false;

  if (nextStatus === "Closed" || nextStatus === "Reopened") {
    return canCloseOrReopenCase(user);
  }

  return (
    hasRole(user, "Customer Service") ||
    hasRole(user, "Product Manager") ||
    hasRole(user, "Product User")
  );
}

export function canManageAdmin(user: AppUser): boolean {
  return canEnterApplication(user) && hasRole(user, "Admin");
}

export function canEscalateCase(user: AppUser): boolean {
  return canEnterApplication(user) && hasRole(user, "Product Manager");
}

export function canApproveCustomerReply(user: AppUser, feedbackCase: FeedbackCase): boolean {
  return canViewCase(user, feedbackCase) && hasRole(user, "Product Manager");
}
