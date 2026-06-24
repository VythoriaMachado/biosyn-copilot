import os

# Caminho padrão: Documentos do usuário atual. Pode ser sobrescrito criando
# um arquivo config_local.txt na mesma pasta com o caminho desejado.
_local_config = os.path.join(os.path.dirname(__file__), "config_local.txt")
if os.path.exists(_local_config):
    with open(_local_config, encoding="utf-8") as _f:
        _custom = _f.read().strip()
    EXCEL_PATH = _custom if _custom else ""
else:
    EXCEL_PATH = os.path.join(os.path.expanduser("~"), "Documents", "Cronograma_Tarefas_Financeiro.xlsx")
SHEET_CHECKLIST = "Banco de Dados Check List"
SHEET_CRONOGRAMA = "Cronograma"
DOWNLOADS_PATH = os.path.join(os.path.expanduser("~"), "Downloads")

EXCEL_HEADERS = [
    "Data", "Dia Semana", "Titulo", "Horario Inicio", "Horario Fim",
    "Tempo Previsto (min)", "Descricao", "Responsavel", "Origem",
    "Status", "Tempo Executado", "Houve Atraso", "Motivo Atraso",
    "Reagendado", "Prioridade", "Atividade Extra", "Categoria Extra",
    "Nome Atividade Extra", "Tempo Extra (min)", "Solicitante Extra",
    "Observacoes", "Timestamp Registro"
]

CATEGORIAS = ["Financeiro", "Contabilidade", "RH", "Diretoria", "Comercial", "Fiscal", "Outro"]
MOTIVOS_ATRASO = ["Demanda urgente", "Reunião inesperada", "Sistema", "Aguardando retorno", "Prioridade alterada", "Outro"]
TEMPOS_EXECUTADOS = ["Menos de 15 minutos", "15–30 minutos", "30–60 minutos", "Igual ao planejado", "Acima do planejado"]
STATUS_OPTS = ["Concluído", "Parcial", "Não realizado"]
PRIORIDADES = ["Alta", "Média", "Baixa"]
