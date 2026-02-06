/*
  Warnings:

  - You are about to drop the `AnalysisJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Chapter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChapterPage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreativeWork` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PageAnalysis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PageAnnotations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AnalysisJob" DROP CONSTRAINT "AnalysisJob_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_workId_fkey";

-- DropForeignKey
ALTER TABLE "ChapterPage" DROP CONSTRAINT "ChapterPage_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "PageAnalysis" DROP CONSTRAINT "PageAnalysis_pageId_fkey";

-- DropForeignKey
ALTER TABLE "PageAnnotations" DROP CONSTRAINT "PageAnnotations_pageId_fkey";

-- DropTable
DROP TABLE "AnalysisJob";

-- DropTable
DROP TABLE "Chapter";

-- DropTable
DROP TABLE "ChapterPage";

-- DropTable
DROP TABLE "CreativeWork";

-- DropTable
DROP TABLE "PageAnalysis";

-- DropTable
DROP TABLE "PageAnnotations";

-- DropEnum
DROP TYPE "AnalysisJobStatus";

-- DropEnum
DROP TYPE "ArtStyleCategory";

-- DropEnum
DROP TYPE "WorkType";
