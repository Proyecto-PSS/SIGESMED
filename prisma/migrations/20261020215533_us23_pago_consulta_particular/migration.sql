-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PROCESANDO', 'APROBADO', 'RECHAZADO', 'ERROR');

-- CreateEnum
CREATE TYPE "ProveedorPago" AS ENUM ('SIMULADA', 'MERCADOPAGO');

-- CreateTable
CREATE TABLE "pagos_turnos" (
    "id_pago" TEXT NOT NULL,
    "id_turno" TEXT NOT NULL,
    "id_paciente" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "proveedor" "ProveedorPago" NOT NULL DEFAULT 'SIMULADA',
    "transaccion_externa_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "motivo_rechazo" TEXT,
    "codigo_error" TEXT,
    "aprobado_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagos_turnos_pkey" PRIMARY KEY ("id_pago")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagos_turnos_idempotency_key_key" ON "pagos_turnos"("idempotency_key");

-- CreateIndex
CREATE INDEX "pagos_turnos_id_turno_estado_idx" ON "pagos_turnos"("id_turno", "estado");

-- CreateIndex
CREATE INDEX "pagos_turnos_id_paciente_idx" ON "pagos_turnos"("id_paciente");

-- AddForeignKey
ALTER TABLE "pagos_turnos" ADD CONSTRAINT "pagos_turnos_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turnos"("id_turno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_turnos" ADD CONSTRAINT "pagos_turnos_id_paciente_fkey" FOREIGN KEY ("id_paciente") REFERENCES "pacientes"("id_paciente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreatePartialUniqueIndex para asegurar a nivel BD que un turno solo tenga un pago aprobado
CREATE UNIQUE INDEX "pagos_turnos_turno_aprobado_unico_idx" ON "pagos_turnos"("id_turno") WHERE "estado" = 'APROBADO';

