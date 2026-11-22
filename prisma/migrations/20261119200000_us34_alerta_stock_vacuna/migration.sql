-- US-34: registro y control de alertas emitidas por stock bajo de vacunas.
CREATE TYPE "EstadoAlertaStock" AS ENUM ('PENDIENTE', 'RESUELTA', 'CANCELADA');

CREATE TABLE "alertas_stock_vacunas" (
    "id_alerta" TEXT NOT NULL,
    "id_vacuna" TEXT NOT NULL,
    "id_enfermero" TEXT,
    "estado" "EstadoAlertaStock" NOT NULL DEFAULT 'PENDIENTE',
    "stock_al_momento" INTEGER NOT NULL,
    "umbral_al_momento" INTEGER NOT NULL,
    "enviada_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta_at" TIMESTAMPTZ(3),

    CONSTRAINT "alertas_stock_vacunas_pkey" PRIMARY KEY ("id_alerta"),
    CONSTRAINT "alertas_stock_vacunas_id_vacuna_fkey" FOREIGN KEY ("id_vacuna") REFERENCES "vacunas"("id_vacuna") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "alertas_stock_vacunas_id_vacuna_estado_idx" ON "alertas_stock_vacunas"("id_vacuna", "estado");
