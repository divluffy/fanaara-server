-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('NONE', 'UPLOADED', 'ANALYZING', 'ANALYZED', 'FAILED');

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterManga" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ChapterStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterManga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageManga" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "s3KeyOriginal" TEXT NOT NULL,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'NONE',
    "analysisJson" JSONB,
    "layersJson" JSONB,
    "layersVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chapterMangaId" TEXT,

    CONSTRAINT "PageManga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterManga_workId_order_key" ON "ChapterManga"("workId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PageManga_chapterId_order_key" ON "PageManga"("chapterId", "order");

-- AddForeignKey
ALTER TABLE "ChapterManga" ADD CONSTRAINT "ChapterManga_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageManga" ADD CONSTRAINT "PageManga_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageManga" ADD CONSTRAINT "PageManga_chapterMangaId_fkey" FOREIGN KEY ("chapterMangaId") REFERENCES "ChapterManga"("id") ON DELETE SET NULL ON UPDATE CASCADE;
