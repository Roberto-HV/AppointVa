using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Autenticacion;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Xunit;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// A deactivated employee loses panel access (login, refresh, open sessions);
/// reactivating restores it, and an owner linked to an employee profile is unaffected.
/// </summary>
public class AccesoEmpleadoInactivoTests
{
    private static readonly Guid NegocioId = Guid.NewGuid();
    private const string Contrasena = "Correcta123!";

    private readonly ApplicationDbContext _db = DbContextFactory.Create();
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtService _jwt = Substitute.For<IJwtService>();

    public AccesoEmpleadoInactivoTests()
    {
        _userManager = Substitute.For<UserManager<ApplicationUser>>(
            Substitute.For<IUserStore<ApplicationUser>>(), null, null, null, null, null, null, null, null);
        _jwt.GenerarToken(Arg.Any<ApplicationUser>(), Arg.Any<string>()).Returns("jwt");
        _jwt.GenerarRefreshTokenAsync(Arg.Any<Guid>()).Returns("refresh");
    }

    private AutenticacionController CrearAuth() => new(
        _userManager, _jwt, Substitute.For<IEmailService>(), Substitute.For<IConfiguration>(),
        Substitute.For<IBlobStorageService>(), Substitute.For<IAuditService>(), _db,
        Substitute.For<IPanelJobsAccesoService>());

    private (ApplicationUser Usuario, Empleado Empleado) Sembrar(string rol, int empleadoActivo)
    {
        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = $"{rol.ToLowerInvariant()}@ejemplo.com",
            Nombre = "Ana",
            NegocioId = NegocioId,
            EmailConfirmed = true,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(),
            NegocioId = NegocioId,
            UsuarioId = usuario.Id,
            Nombre = "Ana",
            Activo = empleadoActivo,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        _db.Empleados.Add(empleado);
        _db.SaveChanges();

        _userManager.FindByEmailAsync(usuario.Email).Returns(usuario);
        _userManager.FindByIdAsync(usuario.Id.ToString()).Returns(usuario);
        _userManager.CheckPasswordAsync(usuario, Contrasena).Returns(true);
        _userManager.GetRolesAsync(usuario).Returns(new List<string> { rol });
        return (usuario, empleado);
    }

    private Task<IActionResult> Login(ApplicationUser u) =>
        CrearAuth().Login(new LoginDto { Email = u.Email!, Contrasena = Contrasena });

    private Task<IActionResult> Refresh(ApplicationUser u)
    {
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(), Token = Guid.NewGuid().ToString(), UsuarioId = u.Id, Usuario = u,
            FechaCreacion = DateTime.UtcNow, FechaExpiracion = DateTime.UtcNow.AddDays(1)
        };
        _jwt.ValidarRefreshTokenAsync(token.Token).Returns(token);
        return CrearAuth().Refresh(new RefrescarTokenDto { RefreshToken = token.Token });
    }

    [Fact]
    public async Task EmpleadoInactivo_NoPuedeIniciarSesionNiRefrescar_ConElMismo401Generico()
    {
        var (usuario, _) = Sembrar(Roles.Empleado, empleadoActivo: 0);

        var login = await Login(usuario);
        login.Should().BeOfType<UnauthorizedObjectResult>()
            .Which.Value.Should().BeEquivalentTo(new { mensaje = "Credenciales inválidas" });
        (await Refresh(usuario)).Should().BeOfType<UnauthorizedObjectResult>();
        await _userManager.DidNotReceive().CheckPasswordAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>());
    }

    [Fact]
    public async Task EmpleadoReactivado_PuedeIniciarSesionYRefrescar()
    {
        var (usuario, empleado) = Sembrar(Roles.Empleado, empleadoActivo: 0);
        (await Login(usuario)).Should().BeOfType<UnauthorizedObjectResult>();

        (await CrearEmpleados(empleado).Reactivar(empleado.Id)).Should().BeOfType<OkObjectResult>();

        (await Login(usuario)).Should().BeOfType<OkObjectResult>();
        (await Refresh(usuario)).Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task PropietarioConFichaDeEmpleadoInactiva_NoSeVeAfectado()
    {
        var (usuario, _) = Sembrar(Roles.Propietario, empleadoActivo: 0);

        (await Login(usuario)).Should().BeOfType<OkObjectResult>();
        (await Refresh(usuario)).Should().BeOfType<OkObjectResult>();
    }

    private EmpleadosController CrearEmpleados(Empleado empleado)
    {
        var repo = Substitute.For<IEmpleadoRepository>();
        repo.ObtenerPorIdAsync(empleado.Id, NegocioId).Returns(empleado);
        repo.ObtenerServicioIdsAsync(empleado.Id).Returns(new List<Guid>());
        repo.ActualizarAsync(Arg.Any<Empleado>()).Returns(ci => { _db.SaveChanges(); return ci.Arg<Empleado>(); });
        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        return new EmpleadosController(repo, contexto, _userManager, Substitute.For<IBlobStorageService>(), _db, _jwt);
    }

    [Fact]
    public async Task Desactivar_EmpleadoConCuenta_RevocaRefreshTokensYRotaElSello()
    {
        var (usuario, empleado) = Sembrar(Roles.Empleado, empleadoActivo: 1);

        (await CrearEmpleados(empleado).Desactivar(empleado.Id)).Should().BeOfType<OkObjectResult>();

        empleado.Activo.Should().Be(0);
        await _jwt.Received(1).RevocarTodosRefreshTokensAsync(usuario.Id);
        await _userManager.Received(1).UpdateSecurityStampAsync(usuario);
    }

    [Fact]
    public async Task Desactivar_FichaDelPropietario_NoCierraSusSesiones()
    {
        var (usuario, empleado) = Sembrar(Roles.Propietario, empleadoActivo: 1);

        await CrearEmpleados(empleado).Desactivar(empleado.Id);

        await _jwt.DidNotReceive().RevocarTodosRefreshTokensAsync(Arg.Any<Guid>());
        await _userManager.DidNotReceive().UpdateSecurityStampAsync(Arg.Any<ApplicationUser>());
    }
}
