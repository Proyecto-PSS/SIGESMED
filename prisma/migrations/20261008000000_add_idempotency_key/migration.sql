-- AlterTable
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "turnos_idempotency_key_key" ON "turnos"("idempotency_key");
