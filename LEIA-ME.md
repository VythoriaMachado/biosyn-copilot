# BioSyn Cronograma Financeiro

Sistema web completo de gerenciamento de cronograma diário, integrado ao Outlook e à planilha Excel.

---

## PRÉ-REQUISITOS

1. **Python 3.10 ou superior** — [python.org/downloads](https://python.org/downloads)
   - Durante a instalação, marque **"Add Python to PATH"**
2. **Microsoft Outlook** instalado e configurado com sua conta
3. **Planilha** `Cronograma_Tarefas_Financeiro.xlsm` no caminho padrão

---

## INSTALAÇÃO (apenas na 1ª vez)

Dê duplo clique em **`setup.bat`**

O script vai:
- Criar um ambiente virtual Python
- Instalar todas as dependências automaticamente

---

## USO DIÁRIO

Dê duplo clique em **`start.bat`**

O sistema abre automaticamente no navegador em `http://localhost:5050`

---

## MÓDULOS

| Módulo | Descrição |
|---|---|
| **Dashboard do Dia** | Agenda completa com stats, reuniões e pendências |
| **Checklist Diário** | Formulário guiado — uma atividade por vez |
| **Planejamento** | Proposta automática para o próximo dia útil |
| **Dashboard Semanal** | Gráficos e insights da semana |
| **Painel Gerencial** | Análise mensal/trimestral/anual |
| **Insights de IA** | Padrões e recomendações automáticas |

---

## CONFIGURAÇÃO

Edite `config.py` para ajustar:

```python
# Caminho da planilha
EXCEL_PATH = r"C:\...\Cronograma_Tarefas_Financeiro.xlsm"

# Nome da aba no Excel
SHEET_CHECKLIST = "Banco de Dados Check List"
```

---

## ESTRUTURA DOS ARQUIVOS

```
cronograma-app/
├── app.py                  ← Servidor Flask (rotas da API)
├── config.py               ← Configurações e caminhos
├── excel_handler.py        ← Leitura e gravação Excel
├── outlook_handler.py      ← Integração Outlook (win32com)
├── insights.py             ← Análise estatística / IA
├── dashboard_generator.py  ← Gerador do HTML semanal
├── requirements.txt        ← Dependências Python
├── start.bat               ← Inicializar o sistema
├── setup.bat               ← Instalação inicial
├── demo.html               ← Preview estático (sem backend)
└── templates/
    └── index.html          ← Interface principal (SPA)
└── static/
    ├── css/style.css       ← Estilos BioSyn
    └── js/app.js           ← Lógica frontend completa
```

---

## PLANILHA EXCEL

O sistema grava na aba **"Banco de Dados Check List"** com as colunas:

| # | Campo |
|---|---|
| A | Data |
| B | Dia da Semana |
| C | Título |
| D | Horário Início |
| E | Horário Fim |
| F | Tempo Previsto (min) |
| G | Descrição |
| H | Responsável |
| I | Origem (Outlook/Manual) |
| J | Status |
| K | Tempo Executado |
| L | Houve Atraso |
| M | Motivo Atraso |
| N | Reagendado |
| O | Prioridade |
| P | Atividade Extra |
| Q | Categoria Extra |
| R | Nome Atividade Extra |
| S | Tempo Extra (min) |
| T | Solicitante Extra |
| U | Observações |
| V | Timestamp Registro |

**Registros nunca são apagados — apenas adicionados.**

---

## EXPORTAÇÕES AUTOMÁTICAS

Salvos automaticamente em `C:\Users\...\Downloads`:

- `Dashboard_Semanal_AAAA-MM-DD.html` — abre no navegador
- Exportações PDF/Word/Excel disponíveis no Painel Gerencial

---

## SUPORTE

Dúvidas ou ajustes: consulte o assistente Claude Code ou
envie e-mail para o time de TI/Dados da BioSyn.
