CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProductAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "UserProductAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProductGroupAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "UserProductGroupAccess_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IntegrationSource" ADD COLUMN "groupId" TEXT;
ALTER TABLE "IntegrationSource" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "ProductGroup_key_key" ON "ProductGroup"("key");
CREATE UNIQUE INDEX "UserProductAccess_userId_sourceId_key" ON "UserProductAccess"("userId", "sourceId");
CREATE INDEX "UserProductAccess_sourceId_idx" ON "UserProductAccess"("sourceId");
CREATE UNIQUE INDEX "UserProductGroupAccess_userId_groupId_key" ON "UserProductGroupAccess"("userId", "groupId");
CREATE INDEX "UserProductGroupAccess_groupId_idx" ON "UserProductGroupAccess"("groupId");
CREATE INDEX "IntegrationSource_groupId_idx" ON "IntegrationSource"("groupId");

ALTER TABLE "IntegrationSource" ADD CONSTRAINT "IntegrationSource_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserProductAccess" ADD CONSTRAINT "UserProductAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductAccess" ADD CONSTRAINT "UserProductAccess_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductGroupAccess" ADD CONSTRAINT "UserProductGroupAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductGroupAccess" ADD CONSTRAINT "UserProductGroupAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
