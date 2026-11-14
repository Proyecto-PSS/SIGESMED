-- US-31 / US-33: datos de catálogo de la vacuna y umbral de alerta de stock.
CREATE TYPE "CategoriaVacuna" AS ENUM ('CALENDARIO_NACIONAL', 'ESTACIONAL', 'INFANTIL', 'REFUERZO', 'OTRA');

ALTER TABLE "vacunas"
  ADD COLUMN "categoria" "CategoriaVacuna" NOT NULL DEFAULT 'CALENDARIO_NACIONAL',
  ADD COLUMN "laboratorio" TEXT,
  ADD COLUMN "presentacion" TEXT,
  ADD COLUMN "umbral_alerta" SMALLINT NOT NULL DEFAULT 10;
