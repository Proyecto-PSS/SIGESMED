-- US-37: conserva la reserva cancelada aunque el horario vuelva a quedar disponible.
CREATE TABLE "cancelaciones_turnos_vacunacion" (
    "id_cancelacion" TEXT NOT NULL,
    "id_turno_vacunacion" TEXT NOT NULL,
    "id_paciente" TEXT NOT NULL,
    "id_enfermero" TEXT NOT NULL,
    "id_vacuna" TEXT NOT NULL,
    "id_lote" TEXT,
    "nombre_vacuna" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "motivo" TEXT NOT NULL,
    "cancelado_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancelaciones_turnos_vacunacion_pkey" PRIMARY KEY ("id_cancelacion")
);

CREATE INDEX "cancelaciones_turnos_vacunacion_id_paciente_cancelado_at_idx"
ON "cancelaciones_turnos_vacunacion"("id_paciente", "cancelado_at");

CREATE INDEX "cancelaciones_turnos_vacunacion_id_turno_vacunacion_cancelado_at_idx"
ON "cancelaciones_turnos_vacunacion"("id_turno_vacunacion", "cancelado_at");
