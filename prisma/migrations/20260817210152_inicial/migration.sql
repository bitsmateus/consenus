-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'OPERADOR', 'PARTE', 'PROCURADOR');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "TipoProcurador" AS ENUM ('ADVOGADO', 'ESCRITORIO_ADVOCACIA', 'EMPRESA_CONSULTORIA', 'REPRESENTANTE_EMPRESA');

-- CreateEnum
CREATE TYPE "StatusAto" AS ENUM ('RASCUNHO', 'AGUARDANDO_DOCUMENTACAO', 'DOCUMENTACAO_EM_ANALISE', 'DATA_CONFIRMADA', 'CONVIDADO_CONVOCADO', 'SESSAO_REALIZADA', 'COMPOSICAO_INTEGRAL', 'COMPOSICAO_PARCIAL', 'REDESIGNADA', 'ENCERRADO_SEM_COMPOSICAO', 'SESSAO_PREJUDICADA', 'CANCELADO');

-- CreateEnum
CREATE TYPE "DesfechoSessao" AS ENUM ('COMPOSICAO_INTEGRAL', 'COMPOSICAO_PARCIAL', 'REDESIGNACAO', 'ENCERRAMENTO_SEM_COMPOSICAO', 'SESSAO_PREJUDICADA');

-- CreateEnum
CREATE TYPE "ModalidadeSessao" AS ENUM ('VIDEOCONFERENCIA', 'PRESENCIAL', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "PapelNoAto" AS ENUM ('SOLICITANTE', 'CONVIDADO', 'PROCURADOR', 'CONCILIADOR');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CARTA_CONVITE_SOLICITANTE', 'CARTA_CONVITE_CONVIDADO', 'ATA', 'TERMO_ACORDO', 'DOCUMENTO_DA_PARTE', 'LAUDO_AR', 'DOCUMENTO_ASSINADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "CanalEnvio" AS ENUM ('AR_DIGITAL', 'EMAIL', 'ENTREGA_MANUAL');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'FALHOU');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('ATO_CRIADO', 'PARTE_ADICIONADA', 'CARTA_SOLICITANTE_GERADA', 'CARTA_SOLICITANTE_ENVIADA', 'DOCUMENTO_RECEBIDO', 'DOCUMENTACAO_CONFERIDA', 'DATA_CONFIRMADA', 'CARTA_CONVIDADO_GERADA', 'CARTA_CONVIDADO_ENVIADA', 'SESSAO_REALIZADA', 'ATA_GERADA', 'TERMO_GERADO', 'DOCUMENTO_ASSINADO_ANEXADO', 'ATO_CONCLUIDO', 'ATO_CANCELADO', 'OBSERVACAO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "totpSecret" TEXT,
    "totpAtivo" BOOLEAN NOT NULL DEFAULT false,
    "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "ultimoLoginEm" TIMESTAMP(3),
    "pessoaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPessoa" NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" VARCHAR(2),
    "cep" TEXT,
    "tipoProcurador" "TipoProcurador",
    "oab" TEXT,
    "vinculadoAId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ato" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "StatusAto" NOT NULL DEFAULT 'RASCUNHO',
    "objeto" TEXT,
    "dataReservada" TIMESTAMP(3),
    "dataConfirmada" TIMESTAMP(3),
    "modalidade" "ModalidadeSessao" NOT NULL DEFAULT 'VIDEOCONFERENCIA',
    "linkVideoconferencia" TEXT,
    "idReuniao" TEXT,
    "senhaReuniao" TEXT,
    "localPresencial" TEXT,
    "horaInicio" TIMESTAMP(3),
    "horaEncerramento" TIMESTAMP(3),
    "desfecho" "DesfechoSessao",
    "motivoPrejudicada" TEXT,
    "observacoesSessao" TEXT,
    "prazoDocumentacaoAte" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParteDoAto" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "papel" "PapelNoAto" NOT NULL,
    "representaId" TEXT,
    "compareceu" BOOLEAN,
    "observacaoPresenca" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParteDoAto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "codigoVerificacao" TEXT NOT NULL,
    "emitidoPelaCamara" BOOLEAN NOT NULL DEFAULT false,
    "nomeArquivo" TEXT NOT NULL,
    "chaveStorage" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "enviadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envio" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "canal" "CanalEnvio" NOT NULL,
    "status" "StatusEnvio" NOT NULL DEFAULT 'PENDENTE',
    "enviadoEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "comprovanteId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAto" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "usuarioId" TEXT,
    "metadados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoSistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nomeCamara" TEXT NOT NULL DEFAULT 'Consensus One',
    "prazoDocumentacaoDias" INTEGER NOT NULL DEFAULT 15,
    "horasAvisoModalidade" INTEGER NOT NULL DEFAULT 48,
    "diasAteSessao" INTEGER NOT NULL DEFAULT 20,
    "urlVerificacao" TEXT NOT NULL DEFAULT 'https://consensone.com.br/verificar',
    "emailRemetente" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_pessoaId_key" ON "Usuario"("pessoaId");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Pessoa_documento_key" ON "Pessoa"("documento");

-- CreateIndex
CREATE INDEX "Pessoa_documento_idx" ON "Pessoa"("documento");

-- CreateIndex
CREATE INDEX "Pessoa_nome_idx" ON "Pessoa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Ato_numero_key" ON "Ato"("numero");

-- CreateIndex
CREATE INDEX "Ato_status_idx" ON "Ato"("status");

-- CreateIndex
CREATE INDEX "Ato_dataConfirmada_idx" ON "Ato"("dataConfirmada");

-- CreateIndex
CREATE INDEX "ParteDoAto_atoId_idx" ON "ParteDoAto"("atoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParteDoAto_atoId_pessoaId_papel_key" ON "ParteDoAto"("atoId", "pessoaId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_codigoVerificacao_key" ON "Documento"("codigoVerificacao");

-- CreateIndex
CREATE INDEX "Documento_atoId_idx" ON "Documento"("atoId");

-- CreateIndex
CREATE INDEX "Documento_codigoVerificacao_idx" ON "Documento"("codigoVerificacao");

-- CreateIndex
CREATE INDEX "Envio_atoId_idx" ON "Envio"("atoId");

-- CreateIndex
CREATE INDEX "EventoAto_atoId_criadoEm_idx" ON "EventoAto"("atoId", "criadoEm");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_criadoEm_idx" ON "LogAuditoria"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "LogAuditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_vinculadoAId_fkey" FOREIGN KEY ("vinculadoAId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ato" ADD CONSTRAINT "Ato_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteDoAto" ADD CONSTRAINT "ParteDoAto_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteDoAto" ADD CONSTRAINT "ParteDoAto_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteDoAto" ADD CONSTRAINT "ParteDoAto_representaId_fkey" FOREIGN KEY ("representaId") REFERENCES "ParteDoAto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_comprovanteId_fkey" FOREIGN KEY ("comprovanteId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAto" ADD CONSTRAINT "EventoAto_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAto" ADD CONSTRAINT "EventoAto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
