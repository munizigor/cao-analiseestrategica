#!/usr/bin/env python3
"""
Gera as páginas HTML dos planos de aula a partir dos arquivos Markdown.

Os arquivos .md em planos/ são a FONTE. Edite-os e rode:

    python3 build.py

Os .html correspondentes são regerados. Não edite os .html à mão — eles
são sobrescritos a cada execução.

Requer: pip install markdown
"""

import re
import sys
from pathlib import Path

try:
    import markdown
    from markdown.extensions.toc import slugify
except ImportError:
    sys.exit("Falta a biblioteca markdown. Rode: pip install markdown")

RAIZ = Path(__file__).parent
PLANOS = RAIZ / "planos"

SUBTITULO = (
    "Análise Estratégica · CAO/CBMDF · CEPED<br>"
    "Instrutor: Ten-Cel QOBM/Comb. Igor <strong>MUNIZ</strong> da Silva"
)

MODELO = """<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{titulo} | Análise Estratégica - CAO CBMDF</title>
    <link rel="stylesheet" href="{css}">
</head>

<body>

    <header>
        <h1>{titulo}</h1>
        <p>{subtitulo}</p>
        <a href="{voltar}" class="voltar">&larr; Repositório de Aulas</a>
    </header>

    <div class="container">
        <div class="card">
{conteudo}
        </div>
    </div>

    <footer>
        Corpo de Bombeiros Militar do Distrito Federal<br>
        Vidas alheias e riquezas a salvar.
    </footer>

</body>

</html>
"""


def extrai_titulo(texto: str, caminho: Path) -> str:
    """Usa o primeiro cabeçalho de nível 1 como título da página."""
    for linha in texto.splitlines():
        if linha.startswith("# "):
            titulo = linha[2:].strip()
            # remove ênfase e marcações residuais do markdown
            titulo = re.sub(r"[*_`]", "", titulo)
            return titulo.replace("*(", "(").strip()
    return caminho.stem


def reescreve_links(html: str) -> str:
    """Aponta os links internos entre planos para os .html gerados.

    As âncoras precisam de tradução: o GitHub preserva acentos ao gerar o id
    de um cabeçalho, enquanto a extensão toc do python-markdown os remove e
    colapsa separadores repetidos. Os .md guardam a âncora no formato do
    GitHub (para funcionar na navegação do repositório) e aqui ela é
    convertida para o formato das páginas geradas.
    """

    def alvo(m: re.Match) -> str:
        caminho, ancora = m.group(1), m.group(2) or ""
        if ancora:
            ancora = "#" + slugify(ancora[1:], "-")
        return f'href="{caminho}.html{ancora}"'

    html = re.sub(r'href="([^"#]+?)\.md(#[^"]*)?"', alvo, html)
    # o texto visível do link também cita o arquivo: `README.md` -> `README.html`
    html = re.sub(r"\.md(</code></a>|</a>)", r".html\1", html)
    # o índice de templates aponta para a pasta; leva para o T1
    html = html.replace('href="templates/"', 'href="templates/T1-priorizacao-dores.html"')
    return html


def remove_cabecalho_repetido(html: str) -> str:
    """Tira o bloco de identificação que abre os .md.

    Nos arquivos markdown, logo abaixo do título vem uma citação com a
    disciplina e o nome do instrutor. Na página gerada essa informação já
    está no cabeçalho vermelho, então repeti-la só ocupa espaço.
    """
    return re.sub(
        r"(</h1>)\s*<blockquote>.*?</blockquote>\s*(?:<hr\s*/?>)?",
        r"\1",
        html,
        count=1,
        flags=re.DOTALL,
    )


# Os templates trazem linhas de preenchimento como "Grupo: ______".
# O CommonMark do GitHub as deixa em paz, mas o python-markdown as lê como
# ênfase e devolve "<strong><em>_</em></strong>". Guardamos essas sequências
# antes da conversão e as devolvemos depois.
_TOKEN = "xxSUBLINHADO{}xx"


def protege_sublinhados(texto: str) -> tuple[str, list[str]]:
    achados: list[str] = []

    def guarda(m: re.Match) -> str:
        achados.append(m.group(0))
        return _TOKEN.format(len(achados) - 1)

    return re.sub(r"_{2,}", guarda, texto), achados


def restaura_sublinhados(html: str, achados: list[str]) -> str:
    for i, original in enumerate(achados):
        html = html.replace(_TOKEN.format(i), original)
    return html


def limpa_cabecalho_vazio(html: str) -> str:
    """Remove o <thead> das tabelas sem cabeçalho.

    Várias tabelas dos planos são de duas colunas do tipo campo/valor e não
    têm cabeçalho. O markdown ainda assim gera um <thead> com células vazias,
    que vira uma faixa vermelha sem conteúdo na página.
    """
    return re.sub(
        r"<thead>\s*<tr>(?:\s*<th[^>]*>\s*</th>)+\s*</tr>\s*</thead>",
        "",
        html,
    )


def envolve_tabelas(html: str) -> str:
    """Tabelas largas precisam rolar dentro do próprio contêiner."""
    return re.sub(
        r"<table>(.*?)</table>",
        r'<div class="tabela-rolavel"><table>\1</table></div>',
        html,
        flags=re.DOTALL,
    )


def caixas_de_selecao(html: str) -> str:
    """Converte as listas de conferência do markdown em checkboxes reais."""
    html = html.replace("<li>[ ] ", '<li><input type="checkbox" disabled> ')
    html = html.replace("<li>[x] ", '<li><input type="checkbox" checked disabled> ')
    return html


def converte(caminho: Path) -> Path:
    texto = caminho.read_text(encoding="utf-8")
    titulo = extrai_titulo(texto, caminho)

    protegido, sublinhados = protege_sublinhados(texto)
    corpo = markdown.markdown(
        protegido,
        extensions=["tables", "fenced_code", "sane_lists", "attr_list", "toc"],
    )
    corpo = restaura_sublinhados(corpo, sublinhados)
    corpo = remove_cabecalho_repetido(corpo)
    corpo = limpa_cabecalho_vazio(corpo)
    corpo = envolve_tabelas(reescreve_links(caixas_de_selecao(corpo)))
    corpo = "\n".join("            " + linha for linha in corpo.splitlines())

    # profundidade relativa: planos/ -> 1 nível, planos/templates/ -> 2 níveis
    niveis = len(caminho.relative_to(PLANOS).parts) - 1
    prefixo = "../" * niveis

    pagina = MODELO.format(
        titulo=titulo,
        subtitulo=SUBTITULO,
        css=prefixo + "estilo.css",
        voltar="../" + prefixo + "index.html",
        conteudo=corpo,
    )

    destino = caminho.with_suffix(".html")
    destino.write_text(pagina, encoding="utf-8")
    return destino


def main() -> None:
    arquivos = sorted(PLANOS.rglob("*.md"))
    if not arquivos:
        sys.exit("Nenhum arquivo .md encontrado em planos/")
    for md in arquivos:
        destino = converte(md)
        print(f"  {md.relative_to(RAIZ)} -> {destino.relative_to(RAIZ)}")
    print(f"\n{len(arquivos)} páginas geradas.")


if __name__ == "__main__":
    main()
