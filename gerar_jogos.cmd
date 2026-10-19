@echo off
rem Atalho: gera 5 jogos pela estrategia "atrasados" lendo a Mega-Sena.xlsx desta pasta.
rem Passe argumentos extras normalmente, ex.: gerar_jogos.cmd -n 10 -e mista --salvar
cd /d "%~dp0"
python gerar_jogos.py %*
pause
