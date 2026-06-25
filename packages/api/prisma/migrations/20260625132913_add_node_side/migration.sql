-- CreateEnum
CREATE TYPE "Side" AS ENUM ('LEFT', 'RIGHT');

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "side" "Side";
