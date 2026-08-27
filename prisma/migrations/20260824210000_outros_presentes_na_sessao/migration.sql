-- Quem mais participou da sessão além das partes vinculadas ao procedimento.
-- Texto livre porque nem todo presente é cadastrado: preposto, contador,
-- intérprete. Vai na Ata, na lista de presentes.

-- AlterTable
ALTER TABLE "Ato" ADD COLUMN     "outrosPresentes" TEXT;
