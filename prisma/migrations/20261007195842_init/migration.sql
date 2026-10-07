-- CreateEnum
CREATE TYPE "EspecialidadMedica" AS ENUM ('CLINICA_MEDICA', 'PEDIATRIA', 'TRAUMATOLOGIA_ORTOPEDIA');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('DISPONIBLE', 'CONFIRMADO', 'CANCELADO', 'ATENDIDO');

-- CreateEnum
CREATE TYPE "ModalidadTurno" AS ENUM ('PARTICULAR', 'COBERTURA');

-- CreateEnum
CREATE TYPE "EstadoTurnoVacunacion" AS ENUM ('DISPONIBLE', 'CONFIRMADO', 'CANCELADO', 'APLICADO');

-- CreateTable
CREATE TABLE "medicos" (
    "id_medico" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "especialidad" "EspecialidadMedica" NOT NULL,
    "matricula" TEXT NOT NULL,
    "consultorio" TEXT,
    "direccion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medicos_pkey" PRIMARY KEY ("id_medico")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id_paciente" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id_paciente")
);

-- CreateTable
CREATE TABLE "disponibilidades_medicas" (
    "id_disponibilidad_medica" TEXT NOT NULL,
    "id_medico" TEXT NOT NULL,
    "mes_vigencia" DATE NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_desde" VARCHAR(5) NOT NULL,
    "hora_hasta" VARCHAR(5) NOT NULL,
    "duracion_turno_minutos" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "disponibilidades_medicas_pkey" PRIMARY KEY ("id_disponibilidad_medica")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id_turno" TEXT NOT NULL,
    "id_medico" TEXT NOT NULL,
    "id_paciente" TEXT,
    "id_disponibilidad_medica" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "duracion_minutos" SMALLINT NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'DISPONIBLE',
    "modalidad" "ModalidadTurno",
    "motivo_cancelacion" TEXT,
    "confirmacion_enviada_at" TIMESTAMPTZ(3),
    "recordatorio_enviado_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id_turno")
);

-- CreateTable
CREATE TABLE "enfermeros" (
    "id_enfermero" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enfermeros_pkey" PRIMARY KEY ("id_enfermero")
);

-- CreateTable
CREATE TABLE "vacunas" (
    "id_vacuna" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vacunas_pkey" PRIMARY KEY ("id_vacuna")
);

-- CreateTable
CREATE TABLE "turnos_vacunacion" (
    "id_turno_vacunacion" TEXT NOT NULL,
    "id_paciente" TEXT,
    "id_enfermero" TEXT NOT NULL,
    "id_vacuna" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "estado" "EstadoTurnoVacunacion" NOT NULL DEFAULT 'DISPONIBLE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_vacunacion_pkey" PRIMARY KEY ("id_turno_vacunacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "medicos_matricula_key" ON "medicos"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_dni_key" ON "pacientes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_email_key" ON "pacientes"("email");

-- CreateIndex
CREATE INDEX "disponibilidades_medicas_mes_vigencia_idx" ON "disponibilidades_medicas"("mes_vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_medicas_id_medico_mes_vigencia_dia_semana_key" ON "disponibilidades_medicas"("id_medico", "mes_vigencia", "dia_semana");

-- CreateIndex
CREATE INDEX "turnos_id_medico_fecha_idx" ON "turnos"("id_medico", "fecha");

-- CreateIndex
CREATE INDEX "turnos_estado_fecha_idx" ON "turnos"("estado", "fecha");

-- CreateIndex
CREATE INDEX "turnos_id_disponibilidad_medica_fecha_idx" ON "turnos"("id_disponibilidad_medica", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_id_medico_fecha_hora_key" ON "turnos"("id_medico", "fecha", "hora");

-- CreateIndex
CREATE UNIQUE INDEX "vacunas_nombre_key" ON "vacunas"("nombre");

-- CreateIndex
CREATE INDEX "turnos_vacunacion_id_paciente_fecha_idx" ON "turnos_vacunacion"("id_paciente", "fecha");

-- CreateIndex
CREATE INDEX "turnos_vacunacion_id_vacuna_fecha_idx" ON "turnos_vacunacion"("id_vacuna", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_vacunacion_id_enfermero_fecha_hora_key" ON "turnos_vacunacion"("id_enfermero", "fecha", "hora");

-- AddForeignKey
ALTER TABLE "disponibilidades_medicas" ADD CONSTRAINT "disponibilidades_medicas_id_medico_fkey" FOREIGN KEY ("id_medico") REFERENCES "medicos"("id_medico") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_id_medico_fkey" FOREIGN KEY ("id_medico") REFERENCES "medicos"("id_medico") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_id_paciente_fkey" FOREIGN KEY ("id_paciente") REFERENCES "pacientes"("id_paciente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_id_disponibilidad_medica_fkey" FOREIGN KEY ("id_disponibilidad_medica") REFERENCES "disponibilidades_medicas"("id_disponibilidad_medica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_vacunacion" ADD CONSTRAINT "turnos_vacunacion_id_paciente_fkey" FOREIGN KEY ("id_paciente") REFERENCES "pacientes"("id_paciente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_vacunacion" ADD CONSTRAINT "turnos_vacunacion_id_enfermero_fkey" FOREIGN KEY ("id_enfermero") REFERENCES "enfermeros"("id_enfermero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_vacunacion" ADD CONSTRAINT "turnos_vacunacion_id_vacuna_fkey" FOREIGN KEY ("id_vacuna") REFERENCES "vacunas"("id_vacuna") ON DELETE RESTRICT ON UPDATE CASCADE;
