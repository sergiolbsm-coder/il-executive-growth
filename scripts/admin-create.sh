#!/usr/bin/env bash
# Cria o primeiro administrador no banco informado, perguntando os valores (a senha não aparece nem vai para o histórico).
# Ao conectar, o app aplica as migrations pendentes (0001, 0002) — por isso a URL é de um banco que você quer usar de fato.
set -euo pipefail
cd "$(dirname "$0")/.."

read -r -s -p "DATABASE_URL do Neon (cole; não aparece): " DATABASE_URL; echo
read -r -p "Nome do administrador: " ADMIN_NAME
read -r -p "E-mail do administrador: " ADMIN_EMAIL
read -r -s -p "Senha (mínimo 8 caracteres; não aparece): " ADMIN_PASSWORD; echo

[[ "$DATABASE_URL" == postgres* ]] || { echo "A DATABASE_URL precisa começar com postgresql://"; exit 1; }
[[ "$ADMIN_EMAIL" == *@*.* ]] || { echo "E-mail inválido."; exit 1; }
(( ${#ADMIN_PASSWORD} >= 8 )) || { echo "A senha precisa ter ao menos 8 caracteres."; exit 1; }

DATABASE_URL="$DATABASE_URL" ADMIN_NAME="$ADMIN_NAME" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run admin:create
