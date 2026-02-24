
# Plataforma SAC – VX Integrações
## Sistema de Controle de Placas Travadas e Chamados

---

### 🎨 Identidade Visual
- Esquema de cores **azul corporativo** (azul escuro + branco + cinza claro)
- Design limpo, profissional e responsivo
- Indicadores visuais por status: 🟡 Aberto | 🔵 Em Tratativa | 🟢 Resolvido
- Tipografia moderna e layout organizado

---

### 📄 Página 1: Dashboard Principal
Visão geral do turno com cards de métricas:
- **Total de placas travadas no dia**
- **Placas recorrentes**
- **Tempo médio de resolução**
- **Chamados em aberto**
- **Chamados resolvidos no turno**

Abaixo dos cards, uma **tabela de chamados recentes** com status colorido, permitindo acesso rápido aos detalhes. Botão destacado para "Novo Chamado".

---

### 📄 Página 2: Lista de Chamados
Tabela completa com todos os chamados, incluindo:
- Placa, transportadora, tecnologia, status, tempo travada, data
- **Barra de pesquisa por placa**
- **Filtros**: por data, transportadora, tecnologia e status
- Clique na linha para ver detalhes e atualizar status
- Atualização dinâmica (sem recarregar página)

---

### 📄 Página 3: Formulário de Abertura de Chamado
Campos do formulário:
- Placa do veículo
- Nome da transportadora
- Tecnologia / Rastreador
- Descrição detalhada do problema
- Observação (histórico/recorrência)
- Tempo que a placa está travada
- Data e hora (preenchidos automaticamente)
- Status inicial (Aberto por padrão)

---

### 📄 Página 4: Detalhes do Chamado
Visualização completa de um chamado individual com:
- Todos os dados preenchidos
- Possibilidade de alterar o status (Aberto → Em Tratativa → Resolvido)
- Editar observações
- Registro da data/hora de resolução

---

### ⚙️ Armazenamento
- Dados persistidos no **localStorage** do navegador
- Sem necessidade de login ou backend neste momento
- Possibilidade de exportar dados futuramente

---

### 🧭 Navegação
- Barra lateral (sidebar) com logo "VX Integrações - SAC"
- Links: Dashboard, Chamados, Novo Chamado
- Layout responsivo com menu hamburger no mobile
