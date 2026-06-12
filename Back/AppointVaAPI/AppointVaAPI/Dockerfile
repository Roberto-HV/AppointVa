# Etapa 1: compilación
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["AppointVaAPI.csproj", "."]
RUN dotnet restore "AppointVaAPI.csproj"

COPY . .
RUN dotnet publish "AppointVaAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Etapa 2: imagen final (solo runtime)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "AppointVaAPI.dll"]
