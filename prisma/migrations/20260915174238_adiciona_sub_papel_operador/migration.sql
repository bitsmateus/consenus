-- CreateEnum
CREATE TYPE "SubPapelOperador" AS ENUM ('CAMARA', 'INTERESSADO');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "subPapelOperador" "SubPapelOperador";
