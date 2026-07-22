using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Xunit;

namespace AppointVaAPI.Tests.Controllers;

public class VerificarEmailTests
{
    private static readonly Guid NegocioId = Guid.NewGuid();

    private static (
        PublicoController controller,
        UserManager<ApplicationUser> userManager,
        IEmailService emailService,
        AppointVaAPI.Data.ApplicationDbContext db)
        CrearComponentes(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);

        var store = Substitute.For<IUserStore<ApplicationUser>>();
        var userManager = Substitute.For<UserManager<ApplicationUser>>(
            store, null, null, null, null, null, null, null, null);

        var emailService = Substitute.For<IEmailService>();

        var config = Substitute.For<IConfiguration>();
        config["FrontendUrl"].Returns("https://app.appointva.com");

        var controller = new PublicoController(
            db,
            Substitute.For<INegocioRepository>(),
            Substitute.For<ICitaRepository>(),
            Substitute.For<IClienteRepository>(),
            Substitute.For<IDisponibilidadService>(),
            Substitute.For<INotificacionService>(),
            emailService,
            config,
            Substitute.For<IBackgroundJobClient>(),
            userManager,
            Substitute.For<IBlobStorageService>(),
            Substitute.For<IPushService>());

        return (controller, userManager, emailService, db);
    }

    [Fact]
    public async Task VerificarEmail_TokenValido_EnviaBienvenida()
    {
        var (controller, userManager, emailService, db) =
            CrearComponentes("VerificarEmail_TokenValido");

        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = "propietario@ejemplo.com",
            Nombre = "Ana",
            NegocioId = NegocioId,
            EmailConfirmed = false,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };

        db.Negocios.Add(new AppointVaAPI.Models.Negocio
        {
            Id = NegocioId,
            Slug = "salon-ana",
            Nombre = "Salon Ana",
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        userManager.FindByIdAsync(usuario.Id.ToString())
            .Returns(Task.FromResult<ApplicationUser?>(usuario));
        userManager.ConfirmEmailAsync(usuario, Arg.Any<string>())
            .Returns(Task.FromResult(IdentityResult.Success));

        var resultado = await controller.VerificarEmail(usuario.Id.ToString(), "token-valido");

        resultado.Should().BeOfType<OkObjectResult>();
        await Task.Delay(200);
        await emailService.Received(1).EnviarBienvenidaAsync(
            usuario.Email,
            usuario.Nombre,
            "Salon Ana",
            "salon-ana",
            "https://app.appointva.com/dashboard");
    }

    [Fact]
    public async Task VerificarEmail_YaVerificado_NoEnviaBienvenida()
    {
        var (controller, userManager, emailService, _) =
            CrearComponentes("VerificarEmail_YaVerificado");

        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = "propietario@ejemplo.com",
            Nombre = "Ana",
            NegocioId = NegocioId,
            EmailConfirmed = true,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };

        userManager.FindByIdAsync(usuario.Id.ToString())
            .Returns(Task.FromResult<ApplicationUser?>(usuario));

        var resultado = await controller.VerificarEmail(usuario.Id.ToString(), "token-cualquiera");

        resultado.Should().BeOfType<OkObjectResult>();
        await emailService.DidNotReceive().EnviarBienvenidaAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task VerificarEmail_TokenInvalido_NoEnviaBienvenida()
    {
        var (controller, userManager, emailService, _) =
            CrearComponentes("VerificarEmail_TokenInvalido");

        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = "propietario@ejemplo.com",
            Nombre = "Ana",
            NegocioId = NegocioId,
            EmailConfirmed = false,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };

        userManager.FindByIdAsync(usuario.Id.ToString())
            .Returns(Task.FromResult<ApplicationUser?>(usuario));
        userManager.ConfirmEmailAsync(usuario, Arg.Any<string>())
            .Returns(Task.FromResult(IdentityResult.Failed(
                new IdentityError { Code = "InvalidToken", Description = "Token inválido." })));

        var resultado = await controller.VerificarEmail(usuario.Id.ToString(), "token-invalido");

        resultado.Should().BeOfType<BadRequestObjectResult>();
        await emailService.DidNotReceive().EnviarBienvenidaAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string>(), Arg.Any<string>());
    }
}
