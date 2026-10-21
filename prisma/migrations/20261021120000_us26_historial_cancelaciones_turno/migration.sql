-- Conserva las cancelaciones como historial y permite volver a ofrecer el mismo horario.
-- Solo puede existir un turno no cancelado por médico, fecha y hora.
ALTER TABLE "turnos"
  DROP CONSTRAINT "turnos_id_disponibilidad_medica_fkey";

ALTER TABLE "turnos"
  ALTER COLUMN "id_disponibilidad_medica" DROP NOT NULL;

ALTER TABLE "turnos"
  ADD CONSTRAINT "turnos_id_disponibilidad_medica_fkey"
  FOREIGN KEY ("id_disponibilidad_medica")
  REFERENCES "disponibilidades_medicas"("id_disponibilidad_medica")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "turnos_id_medico_fecha_hora_key";

CREATE UNIQUE INDEX "turnos_id_medico_fecha_hora_activo_key"
ON "turnos"("id_medico", "fecha", "hora")
WHERE "estado" IN ('DISPONIBLE', 'CONFIRMADO');
