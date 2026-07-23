#!/bin/bash

# ==========================================================================
#   ORBIT · Rastreador de Acoplamentos de Tipos (Anti-Pattern Finder)
# ==========================================================================

echo -e "\n🔍 \033[1;36m[INICIANDO RASTREAMENTO DE ACOPLAMENTOS DE TIPOS]\033[0m"
echo "-----------------------------------------------------------------"

# 1. Rastrear interfaces e tipos declarados localmente dentro de repositórios
echo -e "\n🚨 \033[1;31m[CRÍTICO] Interfaces declaradas localmente em Repositórios (Duplicação):\033[0m"
git grep -n -E "(interface |type )" -- 'src/lib/repositories/' 'src/repositories/' 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  🟢 Nenhum tipo local declarado na pasta de repositórios!"
fi

# 2. Rastrear imports de Repositórios feitos por locais errados (blando as camadas)
echo -e "\n⚠️ \033[1;33m[ALERTA] Componentes/Screens importando Repositórios diretamente (Ignorando Hooks/Contexto):\033[0m"
git grep -n "from '.*\/repositories\/.*'" -- 'src/components/' 'src/screens/' 'src/app/' 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  🟢 Camada de Componentes está limpa de imports diretos de Repositórios!"
fi

# 3. Rastrear tipagens manuais do Supabase (ignorando o gerador ou tipos centrais)
echo -e "\n⚡ \033[1;35m[AQUICONTRACT] Arquivos que definem tipagens de linhas de banco (Row) fora do /types:\033[0m"
git grep -n -i "Row" -- 'src/' | grep -v 'src/types/' | grep -v 'node_modules' 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  🟢 Nenhuma nomenclatura de Row isolada fora da pasta oficial."
fi

echo "-----------------------------------------------------------------"
echo -e "🏁 \033[1;32m[VARREDURA CONCLUÍDA!]\033[0m repasse esses pontos ao dev para alinhar ao SSOT.\n"
