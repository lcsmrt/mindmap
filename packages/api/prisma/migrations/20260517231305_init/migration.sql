-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateTable
CREATE TABLE "Map" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "bg_color" TEXT,
    "text_color" TEXT,
    "status" "NodeStatus",
    "assignee" TEXT,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Node_map_id_idx" ON "Node"("map_id");

-- CreateIndex
CREATE INDEX "Node_parent_id_idx" ON "Node"("parent_id");

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
