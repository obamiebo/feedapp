-- DropForeignKey
ALTER TABLE "RoleAssignment" DROP CONSTRAINT "RoleAssignment_userId_fkey";
ALTER TABLE "RoleAssignment" DROP CONSTRAINT "RoleAssignment_roleId_fkey";
ALTER TABLE "DepartmentMember" DROP CONSTRAINT "DepartmentMember_userId_fkey";
ALTER TABLE "DepartmentMember" DROP CONSTRAINT "DepartmentMember_departmentId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_caseId_fkey";
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_caseId_fkey";
ALTER TABLE "SlaPolicy" DROP CONSTRAINT "SlaPolicy_departmentId_fkey";
ALTER TABLE "IntegrationEvent" DROP CONSTRAINT "IntegrationEvent_sourceId_fkey";

-- CreateIndex
CREATE INDEX "RoleAssignment_roleId_idx" ON "RoleAssignment"("roleId");
CREATE INDEX "DepartmentMember_departmentId_idx" ON "DepartmentMember"("departmentId");
CREATE INDEX "Case_assigneeId_idx" ON "Case"("assigneeId");
CREATE INDEX "Case_customerId_idx" ON "Case"("customerId");
CREATE INDEX "Case_sourceSystem_idx" ON "Case"("sourceSystem");
CREATE INDEX "Case_slaDeadlineAt_idx" ON "Case"("slaDeadlineAt");
CREATE INDEX "Message_caseId_idx" ON "Message"("caseId");
CREATE INDEX "Approval_caseId_idx" ON "Approval"("caseId");
CREATE INDEX "Approval_approverId_idx" ON "Approval"("approverId");
CREATE INDEX "IntegrationEvent_sourceId_idx" ON "IntegrationEvent"("sourceId");
CREATE INDEX "IntegrationEvent_caseId_idx" ON "IntegrationEvent"("caseId");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
