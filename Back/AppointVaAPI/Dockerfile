# Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["AppointVaAPI/AppointVaAPI.csproj", "AppointVaAPI/"]
RUN dotnet restore "AppointVaAPI/AppointVaAPI.csproj"
COPY . .
WORKDIR "/src/AppointVaAPI"
RUN dotnet publish "AppointVaAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
CMD sh -c "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet AppointVaAPI.dll"
