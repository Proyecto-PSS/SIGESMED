ALTER TYPE "EstadoTurno" ADD VALUE 'AUSENTE';

ALTER TABLE "turnos"
ADD COLUMN "ausencia_registrada_por_id" TEXT,
ADD COLUMN "ausencia_registrada_por_rol" TEXT,
ADD COLUMN "ausencia_registrada_at" TIMESTAMPTZ(3);
