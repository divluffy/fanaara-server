-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('MANGA', 'MANHWA', 'MANHUA', 'COMIC', 'WEBTOON', 'OTHER');

-- CreateEnum
CREATE TYPE "ArtStyleCategory" AS ENUM ('BW_MANGA', 'FULL_COLOR', 'WESTERN_COMIC', 'SEMI_REALISTIC', 'REALISTIC', 'CHIBI', 'PIXEL_ART', 'OTHER');

-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "CreativeWork" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "workType" "WorkType" NOT NULL,
    "artStyleCategory" "ArtStyleCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "defaultLang" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterPage" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAnalysis" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAnnotations" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageAnnotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "status" "AnalysisJobStatus" NOT NULL,
    "progress" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChapterPage_chapterId_orderIndex_idx" ON "ChapterPage"("chapterId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PageAnalysis_pageId_key" ON "PageAnalysis"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "PageAnnotations_pageId_key" ON "PageAnnotations"("pageId");

-- CreateIndex
CREATE INDEX "AnalysisJob_chapterId_idx" ON "AnalysisJob"("chapterId");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreativeWork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterPage" ADD CONSTRAINT "ChapterPage_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysis" ADD CONSTRAINT "PageAnalysis_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ChapterPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnnotations" ADD CONSTRAINT "PageAnnotations_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ChapterPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
