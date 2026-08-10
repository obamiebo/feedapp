import type { AppUser, FeedbackCase } from "@/domain/types";
import { canManageProductTags, canViewCase } from "@/lib/access-control";
import type { AuditLogRepository } from "@/repositories/audit-logs";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import type { CaseRepository } from "@/repositories/cases";
import { createPrismaCaseRepository } from "@/repositories/cases";
import type { CaseTagRecord, CaseTagRepository } from "@/repositories/case-tags";
import { createPrismaCaseTagRepository } from "@/repositories/case-tags";

export type CaseTagService = {
  listTagsForSourceForUser(sourceKey: string, user: AppUser, includeInactive?: boolean): Promise<CaseTagRecord[]>;
  createTagForUser(input: { sourceKey: string; name: string; color: string; description?: string }, user: AppUser): Promise<void>;
  updateTagForUser(input: { tagId: string; name: string; color: string; description?: string; active: boolean }, user: AppUser): Promise<void>;
  assignTagForUser(input: { caseId: string; tagId: string }, user: AppUser): Promise<void>;
  removeTagForUser(input: { caseId: string; tagId: string }, user: AppUser): Promise<void>;
};

type CaseTagServiceDependencies = {
  tags: CaseTagRepository;
  cases: CaseRepository;
  auditLogs: AuditLogRepository;
};

export function createCaseTagService(dependencies?: Partial<CaseTagServiceDependencies>): CaseTagService {
  const tags = dependencies?.tags ?? createPrismaCaseTagRepository();
  const cases = dependencies?.cases ?? createPrismaCaseRepository();
  const auditLogs = dependencies?.auditLogs ?? createPrismaAuditLogRepository();

  async function resolveCaseForUser(caseId: string, user: AppUser): Promise<FeedbackCase> {
    const feedbackCase = await cases.getCaseById(caseId);
    if (!feedbackCase || !canViewCase(user, feedbackCase)) {
      throw new Error("Current user cannot access this case");
    }
    return feedbackCase;
  }

  function assertCanManageSource(user: AppUser, sourceKey: string) {
    if (!canManageProductTags(user, sourceKey)) {
      throw new Error("Current user cannot manage tags for this product");
    }
  }

  function normalizeColor(value: string) {
    return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#244f89";
  }

  function normalizeName(value: string) {
    const name = value.trim();
    if (name.length < 2) {
      throw new Error("Tag name is required");
    }
    return name.slice(0, 60);
  }

  return {
    async listTagsForSourceForUser(sourceKey, user, includeInactive = false) {
      if (!user.productSourceKeys.includes(sourceKey) && !canManageProductTags(user, sourceKey)) {
        throw new Error("Current user cannot view tags for this product");
      }
      return tags.listTagsForSource(sourceKey, includeInactive);
    },

    async createTagForUser(input, user) {
      assertCanManageSource(user, input.sourceKey);
      const tag = await tags.createTag({
        sourceKey: input.sourceKey,
        name: normalizeName(input.name),
        color: normalizeColor(input.color),
        description: input.description?.trim(),
        actorId: user.id
      });
      await auditLogs.createAuditLog({
        actorId: user.id,
        action: "case_tag.created",
        metadata: {
          tagId: tag.id,
          sourceKey: tag.sourceKey,
          name: tag.name
        }
      });
    },

    async updateTagForUser(input, user) {
      const existing = await tags.getTag(input.tagId);
      if (!existing) {
        throw new Error("Tag was not found");
      }
      assertCanManageSource(user, existing.sourceKey);
      const updated = await tags.updateTag({
        tagId: input.tagId,
        name: normalizeName(input.name),
        color: normalizeColor(input.color),
        description: input.description?.trim(),
        active: input.active
      });
      await auditLogs.createAuditLog({
        actorId: user.id,
        action: "case_tag.updated",
        metadata: {
          tagId: updated.id,
          sourceKey: updated.sourceKey,
          name: updated.name,
          active: updated.active
        }
      });
    },

    async assignTagForUser(input, user) {
      const [feedbackCase, tag] = await Promise.all([resolveCaseForUser(input.caseId, user), tags.getTag(input.tagId)]);
      if (!tag || !tag.active || tag.sourceKey !== feedbackCase.sourceSystem) {
        throw new Error("Tag is not available for this case product");
      }
      await tags.assignTag({ caseId: input.caseId, tagId: input.tagId, actorId: user.id });
      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: input.caseId,
        action: "case_tag.assigned",
        metadata: {
          tagId: tag.id,
          tagName: tag.name,
          sourceKey: tag.sourceKey
        }
      });
    },

    async removeTagForUser(input, user) {
      const [feedbackCase, tag] = await Promise.all([resolveCaseForUser(input.caseId, user), tags.getTag(input.tagId)]);
      if (!tag || tag.sourceKey !== feedbackCase.sourceSystem) {
        throw new Error("Tag is not available for this case product");
      }
      await tags.removeTag(input);
      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: input.caseId,
        action: "case_tag.removed",
        metadata: {
          tagId: tag.id,
          tagName: tag.name,
          sourceKey: tag.sourceKey
        }
      });
    }
  };
}
