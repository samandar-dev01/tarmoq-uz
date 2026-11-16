-- Additive: the name of a category for Russian readers. Null means "show the Uzbek name".
ALTER TABLE "Category" ADD COLUMN "nameRu" TEXT;

-- The four categories every environment has (prisma/seed.ts), by their stable slugs.
UPDATE "Category" SET "nameRu" = 'Мобильная съёмка' WHERE "slug" = 'mobile-videography';
UPDATE "Category" SET "nameRu" = 'Фотография' WHERE "slug" = 'photography';
UPDATE "Category" SET "nameRu" = 'Видеомонтаж' WHERE "slug" = 'video-editing';
UPDATE "Category" SET "nameRu" = 'Съёмка с дрона' WHERE "slug" = 'drone';
