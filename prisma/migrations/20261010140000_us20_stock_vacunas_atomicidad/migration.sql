-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('INGRESO', 'AJUSTE', 'CONSUMO', 'LIBERACION');

-- CreateTable
CREATE TABLE "lotes_vacunas" (
    "id_lote" TEXT NOT NULL,
    "id_vacuna" TEXT NOT NULL,
    "numero_lote" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "vencimiento" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lotes_vacunas_pkey" PRIMARY KEY ("id_lote")
);

-- CreateTable
CREATE TABLE "movimientos_stock_vacunas" (
    "id_movimiento" TEXT NOT NULL,
    "id_vacuna" TEXT NOT NULL,
    "id_lote" TEXT,
    "id_enfermero" TEXT,
    "tipo_movimiento" "TipoMovimientoStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_anterior" INTEGER NOT NULL,
    "stock_nuevo" INTEGER NOT NULL,
    "motivo" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_vacunas_pkey" PRIMARY KEY ("id_movimiento")
);

-- AlterTable
ALTER TABLE "turnos_vacunacion" ADD COLUMN "id_lote" TEXT;
ALTER TABLE "turnos_vacunacion" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lotes_vacunas_id_vacuna_numero_lote_key" ON "lotes_vacunas"("id_vacuna", "numero_lote");
CREATE INDEX "lotes_vacunas_id_vacuna_idx" ON "lotes_vacunas"("id_vacuna");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_stock_vacunas_idempotency_key_key" ON "movimientos_stock_vacunas"("idempotency_key");
CREATE INDEX "movimientos_stock_vacunas_id_vacuna_created_at_idx" ON "movimientos_stock_vacunas"("id_vacuna", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_vacunacion_idempotency_key_key" ON "turnos_vacunacion"("idempotency_key");

-- AddForeignKey
ALTER TABLE "lotes_vacunas" ADD CONSTRAINT "lotes_vacunas_id_vacuna_fkey" FOREIGN KEY ("id_vacuna") REFERENCES "vacunas"("id_vacuna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock_vacunas" ADD CONSTRAINT "movimientos_stock_vacunas_id_vacuna_fkey" FOREIGN KEY ("id_vacuna") REFERENCES "vacunas"("id_vacuna") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimientos_stock_vacunas" ADD CONSTRAINT "movimientos_stock_vacunas_id_lote_fkey" FOREIGN KEY ("id_lote") REFERENCES "lotes_vacunas"("id_lote") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimientos_stock_vacunas" ADD CONSTRAINT "movimientos_stock_vacunas_id_enfermero_fkey" FOREIGN KEY ("id_enfermero") REFERENCES "enfermeros"("id_enfermero") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_vacunacion" ADD CONSTRAINT "turnos_vacunacion_id_lote_fkey" FOREIGN KEY ("id_lote") REFERENCES "lotes_vacunas"("id_lote") ON DELETE SET NULL ON UPDATE CASCADE;
