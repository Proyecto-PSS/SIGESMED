-- CreateEnum
CREATE TYPE "EstadoNotificacionCancelacion" AS ENUM ('PENDIENTE', 'PROCESANDO', 'ENVIADA', 'FALLIDA');

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN "estado_notificacion_cancelacion" "EstadoNotificacionCancelacion",
ADD COLUMN "notificacion_cancelacion_intentada_at" TIMESTAMPTZ(3),
ADD COLUMN "notificacion_cancelacion_enviada_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "turnos_estado_notificacion_cancelacion_idx" ON "turnos"("estado_notificacion_cancelacion");
