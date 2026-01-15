/*
  Warnings:

  - The values [credentials,google,apple,microsoft] on the enum `AuthProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `emailVerifiedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profileStatus` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuthProvider_new" AS ENUM ('GOOGLE', 'APPLE', 'MICROSOFT', 'EMAIL');
ALTER TABLE "OAuthAccount" ALTER COLUMN "provider" TYPE "AuthProvider_new" USING ("provider"::text::"AuthProvider_new");
ALTER TYPE "AuthProvider" RENAME TO "AuthProvider_old";
ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
DROP TYPE "public"."AuthProvider_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerifiedAt",
DROP COLUMN "profileStatus",
ADD COLUMN     "status" "ProfileStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "email" DROP NOT NULL;
