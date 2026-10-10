ALTER TABLE "pacientes" ADD COLUMN "obra_social" TEXT;
ALTER TABLE "pacientes" ADD COLUMN "numero_afiliado" TEXT;

ALTER TABLE "medicos" ADD COLUMN "email" TEXT;
UPDATE "medicos" SET "email" = 'medico+' || "id_medico" || '@legacy.invalid' WHERE "email" IS NULL;
ALTER TABLE "medicos" ALTER COLUMN "email" SET NOT NULL;
CREATE UNIQUE INDEX "medicos_email_key" ON "medicos"("email");

ALTER TABLE "enfermeros" ADD COLUMN "email" TEXT;
ALTER TABLE "enfermeros" ADD COLUMN "matricula" TEXT;
UPDATE "enfermeros" SET "email" = 'enfermero+' || "id_enfermero" || '@legacy.invalid', "matricula" = 'LEGACY-' || "id_enfermero" WHERE "email" IS NULL;
ALTER TABLE "enfermeros" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "enfermeros" ALTER COLUMN "matricula" SET NOT NULL;
ALTER TABLE "enfermeros" ALTER COLUMN "id_enfermero" DROP DEFAULT;
CREATE UNIQUE INDEX "enfermeros_email_key" ON "enfermeros"("email");
CREATE UNIQUE INDEX "enfermeros_matricula_key" ON "enfermeros"("matricula");
