# Etapa 1: compilación
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["AppointVaAPI.csproj", "."]
RUN dotnet restore "AppointVaAPI.csproj"

COPY . .
RUN dotnet publish "AppointVaAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Etapa 2: imagen final (solo runtime)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

EXPOSE 8080

COPY --from=build /app/publish .

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "AppointVaAPI.dll"]
