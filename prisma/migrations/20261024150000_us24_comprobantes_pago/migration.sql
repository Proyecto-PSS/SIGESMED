-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'GENERANDO', 'GENERADO', 'ERROR');

-- CreateTable
CREATE TABLE "comprobantes_pago" (
    "id_comprobante" TEXT NOT NULL,
    "id_pago" TEXT NOT NULL,
    "numero_comprobante" TEXT NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "archivo_key" TEXT,
    "archivo_contenido" BYTEA,
    "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "nombre_archivo" TEXT NOT NULL,
    "tamano_bytes" INTEGER,
    "datos_snapshot" JSONB,
    "fecha_emision" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_generacion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comprobantes_pago_pkey" PRIMARY KEY ("id_comprobante")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_pago_id_pago_key" ON "comprobantes_pago"("id_pago");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_pago_numero_comprobante_key" ON "comprobantes_pago"("numero_comprobante");

-- CreateIndex
CREATE INDEX "comprobantes_pago_estado_idx" ON "comprobantes_pago"("estado");

-- CreateIndex
CREATE INDEX "comprobantes_pago_fecha_emision_idx" ON "comprobantes_pago"("fecha_emision");

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "pagos_turnos"("id_pago") ON DELETE RESTRICT ON UPDATE CASCADE;
