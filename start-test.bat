@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ==========================================
echo  Barbearia Premium SaaS - Teste Local
echo ==========================================

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado no PATH.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  if exist "backend\.env.example" (
    echo [INFO] backend\.env nao encontrado. Criando a partir de .env.example...
    copy /Y "backend\.env.example" "backend\.env" >nul
  ) else (
    echo [ERRO] Arquivo backend\.env nao encontrado e .env.example tambem nao existe.
    pause
    exit /b 1
  )
)

if not exist "backend\node_modules" (
  echo [INFO] Instalando dependencias do backend...
  call npm install --prefix backend
  if errorlevel 1 goto :error
)

if not exist "frontend\node_modules" (
  echo [INFO] Instalando dependencias do frontend...
  call npm install --prefix frontend
  if errorlevel 1 goto :error
)

echo [INFO] Gerando Prisma Client...
call npm run prisma:generate --prefix backend
if errorlevel 1 goto :error

echo [INFO] Iniciando backend...
start "Barbearia API" cmd /k "cd /d ""%ROOT%backend"" && npm run dev"

timeout /t 2 /nobreak >nul

echo [INFO] Iniciando frontend...
start "Barbearia Web" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev"

echo.
echo [OK] Sistema iniciado para testes.
echo API: http://localhost:4000/api/v1/health
echo Web: http://localhost:5173
echo.
echo Para encerrar, feche as duas janelas abertas (API e Web).
exit /b 0

:error
echo.
echo [ERRO] Falha ao preparar ou iniciar o sistema.
pause
exit /b 1
