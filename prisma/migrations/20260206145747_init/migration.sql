/*
  Warnings:

  - You are about to drop the `ChapterManga` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PageManga` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Work` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChapterManga" DROP CONSTRAINT "ChapterManga_workId_fkey";

-- DropForeignKey
ALTER TABLE "PageManga" DROP CONSTRAINT "PageManga_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "PageManga" DROP CONSTRAINT "PageManga_chapterMangaId_fkey";

-- DropTable
DROP TABLE "ChapterManga";

-- DropTable
DROP TABLE "PageManga";

-- DropTable
DROP TABLE "Work";

-- DropEnum
DROP TYPE "AnalysisStatus";

-- DropEnum
DROP TYPE "ChapterStatus";
