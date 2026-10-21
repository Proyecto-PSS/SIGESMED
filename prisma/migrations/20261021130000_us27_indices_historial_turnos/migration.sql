-- Acelera el historial por paciente tanto sin filtro de estado como con estado.
CREATE INDEX "turnos_id_paciente_fecha_hora_idx"
ON "turnos"("id_paciente", "fecha", "hora");

CREATE INDEX "turnos_id_paciente_estado_fecha_hora_idx"
ON "turnos"("id_paciente", "estado", "fecha", "hora");
