-- CreateEnum
CREATE TYPE "EstadoRecordatorio" AS ENUM ('PENDIENTE', 'PROCESANDO', 'ENVIADO', 'REINTENTO_PROGRAMADO', 'FALLIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "recordatorios_turnos" (
    "id_recordatorio" TEXT NOT NULL,
    "id_turno" TEXT NOT NULL,
    "id_paciente" TEXT NOT NULL,
    "estado" "EstadoRecordatorio" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "programado_para" TIMESTAMPTZ(3) NOT NULL,
    "ultimo_intento_at" TIMESTAMPTZ(3),
    "enviado_at" TIMESTAMPTZ(3),
    "ultimo_error" TEXT,
    "ciclo" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recordatorios_turnos_pkey" PRIMARY KEY ("id_recordatorio")
);

-- CreateIndex
CREATE INDEX "recordatorios_turnos_estado_programado_para_idx" ON "recordatorios_turnos"("estado", "programado_para");

-- CreateIndex
CREATE INDEX "recordatorios_turnos_id_turno_estado_idx" ON "recordatorios_turnos"("id_turno", "estado");

-- CreateIndex
CREATE INDEX "recordatorios_turnos_id_paciente_idx" ON "recordatorios_turnos"("id_paciente");

-- AddForeignKey
ALTER TABLE "recordatorios_turnos" ADD CONSTRAINT "recordatorios_turnos_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turnos"("id_turno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios_turnos" ADD CONSTRAINT "recordatorios_turnos_id_paciente_fkey" FOREIGN KEY ("id_paciente") REFERENCES "pacientes"("id_paciente") ON DELETE CASCADE ON UPDATE CASCADE;
