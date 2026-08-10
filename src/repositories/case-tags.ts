import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CaseTagRecord = {
  id: string;
  sourceId: string;
  sourceKey: string;
  name: string;
  color: string;
  description: string | null;
  active: boolean;
  caseCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CaseTagAssignmentRecord = {
  id: string;
  name: string;
  color: string;
  description: string | null;
};

export type CaseTagRepository = {
  listTagsForSource(sourceKey: string, includeInactive?: boolean): Promise<CaseTagRecord[]>;
  createTag(input: { sourceKey: string; name: string; color: string; description?: string; actorId?: string }): Promise<CaseTagRecord>;
  updateTag(input: { tagId: string; name: string; color: string; description?: string; active: boolean }): Promise<CaseTagRecord>;
  getTag(tagId: string): Promise<CaseTagRecord | null>;
  listCaseTags(caseId: string): Promise<CaseTagAssignmentRecord[]>;
  assignTag(input: { caseId: string; tagId: string; actorId?: string }): Promise<void>;
  removeTag(input: { caseId: string; tagId: string }): Promise<void>;
};

export function createPrismaCaseTagRepository(client: PrismaClient = prisma): CaseTagRepository {
  function toRecord(tag: {
    id: string;
    sourceId: string;
    source: { key: string };
    name: string;
    color: string;
    description: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { assignments: number };
  }): CaseTagRecord {
    return {
      id: tag.id,
      sourceId: tag.sourceId,
      sourceKey: tag.source.key,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      active: tag.active,
      caseCount: tag._count.assignments,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt
    };
  }

  return {
    async listTagsForSource(sourceKey, includeInactive = false) {
      const tags = await client.caseTag.findMany({
        where: {
          source: { key: sourceKey },
          ...(includeInactive ? {} : { active: true })
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: {
          source: { select: { key: true } },
          _count: { select: { assignments: true } }
        }
      });

      return tags.map(toRecord);
    },

    async createTag(input) {
      const tag = await client.caseTag.create({
        data: {
          source: { connect: { key: input.sourceKey } },
          name: input.name,
          color: input.color,
          description: input.description || null,
          createdById: input.actorId
        },
        include: {
          source: { select: { key: true } },
          _count: { select: { assignments: true } }
        }
      });

      return toRecord(tag);
    },

    async updateTag(input) {
      const tag = await client.caseTag.update({
        where: { id: input.tagId },
        data: {
          name: input.name,
          color: input.color,
          description: input.description || null,
          active: input.active
        },
        include: {
          source: { select: { key: true } },
          _count: { select: { assignments: true } }
        }
      });

      return toRecord(tag);
    },

    async getTag(tagId) {
      const tag = await client.caseTag.findUnique({
        where: { id: tagId },
        include: {
          source: { select: { key: true } },
          _count: { select: { assignments: true } }
        }
      });

      return tag ? toRecord(tag) : null;
    },

    async listCaseTags(caseId) {
      const assignments = await client.caseTagAssignment.findMany({
        where: { caseId },
        orderBy: { createdAt: "asc" },
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
              description: true
            }
          }
        }
      });

      return assignments.map((assignment) => ({
        id: assignment.tag.id,
        name: assignment.tag.name,
        color: assignment.tag.color,
        description: assignment.tag.description
      }));
    },

    async assignTag(input) {
      await client.caseTagAssignment.upsert({
        where: {
          caseId_tagId: {
            caseId: input.caseId,
            tagId: input.tagId
          }
        },
        create: {
          caseId: input.caseId,
          tagId: input.tagId,
          assignedById: input.actorId
        },
        update: {}
      });
    },

    async removeTag(input) {
      await client.caseTagAssignment.deleteMany({
        where: {
          caseId: input.caseId,
          tagId: input.tagId
        }
      });
    }
  };
}
