-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TipoDiagnostico" AS ENUM ('PRESUNTIVO', 'DEFINITIVO', 'EN_ESTUDIO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "atenciones_medicas" (
    "id_atencion" TEXT NOT NULL,
    "id_paciente" TEXT NOT NULL,
    "id_medico" TEXT NOT NULL,
    "diagnostico_principal" TEXT NOT NULL,
    "tipo_diagnostico" "TipoDiagnostico" NOT NULL,
    "observaciones_clinicas" TEXT,
    "detalle_tratamiento" TEXT,
    "indicaciones_farmacologicas" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "atenciones_medicas_pkey" PRIMARY KEY ("id_atencion")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "atenciones_medicas_id_paciente_created_at_idx" ON "atenciones_medicas"("id_paciente", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "atenciones_medicas_id_medico_created_at_idx" ON "atenciones_medicas"("id_medico", "created_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "atenciones_medicas" ADD CONSTRAINT "atenciones_medicas_id_paciente_fkey" FOREIGN KEY ("id_paciente") REFERENCES "pacientes"("id_paciente") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "atenciones_medicas" ADD CONSTRAINT "atenciones_medicas_id_medico_fkey" FOREIGN KEY ("id_medico") REFERENCES "medicos"("id_medico") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

