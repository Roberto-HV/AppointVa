using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Data
{
    public class DataSeeder
    {
        public static async Task SeedAsync(IServiceProvider serviceProvider)
        {
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

            try
            {
                // ============ ROLES ============
                string[] roles = [Roles.SuperAdmin, Roles.Propietario, Roles.Empleado];
                foreach (var rol in roles)
                {
                    if (!await roleManager.RoleExistsAsync(rol))
                    {
                        await roleManager.CreateAsync(new IdentityRole<Guid>(rol));
                        Console.WriteLine($"✓ Rol '{rol}' creado.");
                    }
                }
                // ============ PLANES ============
                if (!context.Planes.Any())
                {
                    var planes = new List<Plan>
                    {
                        new Plan
                        {
                            Id = Guid.NewGuid(),
                            Nombre = "Basico",
                            PrecioMensual = 199.00m,
                            MaxEmpleados = 3,
                            MaxCitasMes = 200,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow
                        },
                        new Plan
                        {
                            Id = Guid.NewGuid(),
                            Nombre = "Pro",
                            PrecioMensual = 399.00m,
                            MaxEmpleados = 10,
                            MaxCitasMes = 1000,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow
                        },
                        new Plan
                        {
                            Id = Guid.NewGuid(),
                            Nombre = "Premium",
                            PrecioMensual = 799.00m,
                            MaxEmpleados = 50,
                            MaxCitasMes = 10000,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow
                        }
                    };

                    await context.Planes.AddRangeAsync(planes);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ 3 planes insertados.");
                }

                // ============ NEGOCIO DEMO ============
                var negocio = await context.Negocios.FirstOrDefaultAsync(n => n.Slug == "barberia-luis");
                
                if (negocio == null)
                {
                    var planPro = await context.Planes.FirstOrDefaultAsync(p => p.Nombre == "Pro");
                    
                    negocio = new Negocio
                    {
                        Id = Guid.NewGuid(),
                        Slug = "barberia-luis",
                        Nombre = "Barberia Luis",
                        Telefono = "+52 55 1234 5678",
                        Email = "contacto@barberialuis.com",
                        Direccion = "Av. Reforma 123, Col. Centro, CDMX",
                        Descripcion = "Barberia clasica con mas de 12 anos de experiencia. Cortes premium, barba tradicional y tratamientos.",
                        ColorPrimario = "#C8A961",
                        Activo = 1,
                        PlanId = planPro?.Id,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };

                    await context.Negocios.AddAsync(negocio);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Negocio 'Barberia Luis' creado.");
                }

                // ============ CATEGORIAS DE SERVICIOS ============
                var categorias = await context.CategoriasServicios
                    .Where(c => c.NegocioId == negocio.Id)
                    .ToListAsync();

                if (!categorias.Any())
                {
                    var newCategorias = new List<CategoriaServicio>
                    {
                        new CategoriaServicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            Nombre = "Cortes",
                            Orden = 1,
                            Activo = 1
                        },
                        new CategoriaServicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            Nombre = "Barba y Combos",
                            Orden = 2,
                            Activo = 1
                        },
                        new CategoriaServicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            Nombre = "Color y Tratamientos",
                            Orden = 3,
                            Activo = 1
                        }
                    };

                    await context.CategoriasServicios.AddRangeAsync(newCategorias);
                    await context.SaveChangesAsync();
                    categorias = newCategorias;
                    Console.WriteLine("✓ 3 categorias de servicios creadas.");
                }

                // ============ SERVICIOS ============
                var servicios = await context.Servicios
                    .Where(s => s.NegocioId == negocio.Id)
                    .ToListAsync();

                if (!servicios.Any())
                {
                    var catCortes = categorias.FirstOrDefault(c => c.Nombre == "Cortes");
                    var catBarba = categorias.FirstOrDefault(c => c.Nombre == "Barba y Combos");
                    var catColor = categorias.FirstOrDefault(c => c.Nombre == "Color y Tratamientos");

                    var newServicios = new List<Servicio>
                    {
                        new Servicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            CategoriaId = catCortes?.Id,
                            Nombre = "Corte clasico",
                            Descripcion = "Corte profesional con tijera y maquina, lavado incluido.",
                            DuracionMinutos = 30,
                            Precio = 250.00m,
                            Orden = 1,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow,
                            FechaActualizacion = DateTime.UtcNow
                        },
                        new Servicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            CategoriaId = catBarba?.Id,
                            Nombre = "Corte + Barba",
                            Descripcion = "Combo completo: corte de cabello, perfilado y arreglo de barba.",
                            DuracionMinutos = 50,
                            Precio = 420.00m,
                            Orden = 2,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow,
                            FechaActualizacion = DateTime.UtcNow
                        },
                        new Servicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            CategoriaId = catCortes?.Id,
                            Nombre = "Diseno y degradado",
                            Descripcion = "Fade detallado, lineas precisas y disenos personalizados.",
                            DuracionMinutos = 45,
                            Precio = 380.00m,
                            Orden = 3,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow,
                            FechaActualizacion = DateTime.UtcNow
                        },
                        new Servicio
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            CategoriaId = catColor?.Id,
                            Nombre = "Tinte de cabello",
                            Descripcion = "Aplicacion de color profesional con tratamiento post-tinte.",
                            DuracionMinutos = 90,
                            Precio = 650.00m,
                            Orden = 4,
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow,
                            FechaActualizacion = DateTime.UtcNow
                        }
                    };

                    await context.Servicios.AddRangeAsync(newServicios);
                    await context.SaveChangesAsync();
                    servicios = newServicios;
                    Console.WriteLine("✓ 4 servicios creados.");
                }

                // ============ EMPLEADOS ============
                var empleados = await context.Empleados
                    .Where(e => e.NegocioId == negocio.Id)
                    .ToListAsync();

                if (!empleados.Any())
                {
                    var newEmpleados = new List<Empleado>
                    {
                        new Empleado
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            Nombre = "Luis Ramirez",
                            Telefono = "+52 55 9876 5432",
                            Email = "luis@barberialuis.com",
                            Biografia = "Dueno y barbero principal. 12 anos de experiencia. Especialista en cortes clasicos.",
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow,
                            FechaActualizacion = DateTime.UtcNow
                        },
                        new Empleado
                        {
                            Id = Guid.NewGuid(),
                            NegocioId = negocio.Id,
                            Nombre = "Carlos Mendez",
                            Telefono = "+52 55 5555 3322",
                            Email = "carlos@barberialuis.com",
                            Biografia = "Barbero senior con 6 anos de experiencia. Especialista en disenos y degradados.",
                            Activo = 1,
                            FechaCreacion = DateTime.UtcNow,
                            FechaActualizacion = DateTime.UtcNow
                        }
                    };

                    await context.Empleados.AddRangeAsync(newEmpleados);
                    await context.SaveChangesAsync();
                    empleados = newEmpleados;
                    Console.WriteLine("✓ 2 empleados creados.");

                    // ============ HORARIOS DE EMPLEADO ============
                    // Luis: 9:00 - 19:00 (Lunes a Sabado)
                    // Carlos: 10:00 - 20:00 (Lunes a Sabado)
                    var horarios = new List<HorarioEmpleado>();

                    var luis = empleados.First(e => e.Nombre == "Luis Ramirez");
                    var carlos = empleados.First(e => e.Nombre == "Carlos Mendez");

                    for (byte dia = 1; dia <= 6; dia++) // Lunes (1) a Sabado (6)
                    {
                        horarios.Add(new HorarioEmpleado
                        {
                            Id = Guid.NewGuid(),
                            EmpleadoId = luis.Id,
                            DiaSemana = dia,
                            HoraInicio = TimeSpan.Parse("09:00"),
                            HoraFin = TimeSpan.Parse("19:00"),
                            Activo = 1
                        });

                        horarios.Add(new HorarioEmpleado
                        {
                            Id = Guid.NewGuid(),
                            EmpleadoId = carlos.Id,
                            DiaSemana = dia,
                            HoraInicio = TimeSpan.Parse("10:00"),
                            HoraFin = TimeSpan.Parse("20:00"),
                            Activo = 1
                        });
                    }

                    await context.HorariosEmpleados.AddRangeAsync(horarios);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Horarios semanales asignados (Lunes a Sabado).");

                    // ============ RELACION EMPLEADO-SERVICIO ============
                    // Luis hace TODO
                    // Carlos hace todo EXCEPTO tinte
                    var empleadoServicios = new List<EmpleadoServicio>();

                    var srvCorteClasico = servicios.First(s => s.Nombre == "Corte clasico");
                    var srvCorteBarba = servicios.First(s => s.Nombre == "Corte + Barba");
                    var srvDiseno = servicios.First(s => s.Nombre == "Diseno y degradado");
                    var srvTinte = servicios.First(s => s.Nombre == "Tinte de cabello");

                    // Luis hace TODO
                    empleadoServicios.AddRange(new[]
                    {
                        new EmpleadoServicio { EmpleadoId = luis.Id, ServicioId = srvCorteClasico.Id },
                        new EmpleadoServicio { EmpleadoId = luis.Id, ServicioId = srvCorteBarba.Id },
                        new EmpleadoServicio { EmpleadoId = luis.Id, ServicioId = srvDiseno.Id },
                        new EmpleadoServicio { EmpleadoId = luis.Id, ServicioId = srvTinte.Id }
                    });

                    // Carlos hace todo EXCEPTO tinte
                    empleadoServicios.AddRange(new[]
                    {
                        new EmpleadoServicio { EmpleadoId = carlos.Id, ServicioId = srvCorteClasico.Id },
                        new EmpleadoServicio { EmpleadoId = carlos.Id, ServicioId = srvCorteBarba.Id },
                        new EmpleadoServicio { EmpleadoId = carlos.Id, ServicioId = srvDiseno.Id }
                    });

                    await context.EmpleadosServicios.AddRangeAsync(empleadoServicios);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Servicios asignados a empleados.");
                }

                // ============ SUPER ADMIN ============
                if (await userManager.FindByEmailAsync("admin@appointva.com") is null)
                {
                    var superAdmin = new ApplicationUser
                    {
                        Id = Guid.NewGuid(),
                        UserName = "admin@appointva.com",
                        Email = "admin@appointva.com",
                        Nombre = "Super",
                        Apellido = "Admin",
                        Activo = true,
                        EmailConfirmed = true,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };
                    await userManager.CreateAsync(superAdmin, "Admin123!");
                    await userManager.AddToRoleAsync(superAdmin, Roles.SuperAdmin);
                    Console.WriteLine("✓ Usuario SuperAdmin creado: admin@appointva.com / Admin123!");
                }

                // ============ PROPIETARIO DEMO ============
                if (await userManager.FindByEmailAsync("luis@barberia-luis.com") is null)
                {
                    var propietario = new ApplicationUser
                    {
                        Id = Guid.NewGuid(),
                        UserName = "luis@barberia-luis.com",
                        Email = "luis@barberia-luis.com",
                        Nombre = "Luis",
                        Apellido = "Ramirez",
                        NegocioId = negocio.Id,
                        Activo = true,
                        EmailConfirmed = true,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };
                    await userManager.CreateAsync(propietario, "Luis123!");
                    await userManager.AddToRoleAsync(propietario, Roles.Propietario);

                    // Vincular con el empleado Luis Ramirez
                    var empleadoLuis = empleados.FirstOrDefault(e => e.Nombre == "Luis Ramirez");
                    if (empleadoLuis is not null)
                    {
                        empleadoLuis.UsuarioId = propietario.Id;
                        await context.SaveChangesAsync();
                    }
                    Console.WriteLine("✓ Usuario Propietario creado: luis@barberia-luis.com / Luis123!");
                }

                // ============ EMPLEADO DEMO ============
                if (await userManager.FindByEmailAsync("carlos@barberia-luis.com") is null)
                {
                    var empleadoUser = new ApplicationUser
                    {
                        Id = Guid.NewGuid(),
                        UserName = "carlos@barberia-luis.com",
                        Email = "carlos@barberia-luis.com",
                        Nombre = "Carlos",
                        Apellido = "Mendez",
                        NegocioId = negocio.Id,
                        Activo = true,
                        EmailConfirmed = true,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };
                    await userManager.CreateAsync(empleadoUser, "Carlos123!");
                    await userManager.AddToRoleAsync(empleadoUser, Roles.Empleado);

                    // Vincular con el empleado Carlos Mendez
                    var empleadoCarlos = empleados.FirstOrDefault(e => e.Nombre == "Carlos Mendez");
                    if (empleadoCarlos is not null)
                    {
                        empleadoCarlos.UsuarioId = empleadoUser.Id;
                        await context.SaveChangesAsync();
                    }
                    Console.WriteLine("✓ Usuario Empleado creado: carlos@barberia-luis.com / Carlos123!");
                }

                // ============================================================
                //   SALÓN ARAMIS  (guards independientes por paso)
                // ============================================================
                var negocioAramis = await context.Negocios.FirstOrDefaultAsync(n => n.Slug == "salon-aramis");

                if (negocioAramis == null)
                {
                    var planPro2 = await context.Planes.FirstOrDefaultAsync(p => p.Nombre == "Pro");
                    negocioAramis = new Negocio
                    {
                        Id = Guid.NewGuid(),
                        Slug = "salon-aramis",
                        Nombre = "Salón Aramis",
                        Telefono = "+52 81 2345 6789",
                        Email = "hola@salonaramis.com",
                        Direccion = "Calle Morelos 47, Col. Centro, Monterrey, NL",
                        Descripcion = "Salón de belleza femenino con más de 8 años de experiencia. Especialistas en coloración, cortes modernos, keratinas y nail art.",
                        ColorPrimario = "#9333EA",
                        ColorSecundario = "#F3E8FF",
                        PlanId = planPro2?.Id,
                        Activo = 1,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };
                    await context.Negocios.AddAsync(negocioAramis);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Negocio 'Salón Aramis' creado.");
                }

                // ── Categorías ───────────────────────────────────────────────
                var catsAr = await context.CategoriasServicios.Where(c => c.NegocioId == negocioAramis.Id).ToListAsync();
                if (!catsAr.Any())
                {

                    var catsCabello = new CategoriaServicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Corte y Peinado", Orden = 1, Activo = 1 };
                    var catColor    = new CategoriaServicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Coloración", Orden = 2, Activo = 1 };
                    var catNails    = new CategoriaServicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Manicure y Pedicure", Orden = 3, Activo = 1 };
                    var catTrat     = new CategoriaServicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Tratamientos", Orden = 4, Activo = 1 };
                    await context.CategoriasServicios.AddRangeAsync(catsCabello, catColor, catNails, catTrat);
                    await context.SaveChangesAsync();
                    catsAr = [catsCabello, catColor, catNails, catTrat];
                    Console.WriteLine("✓ 4 categorías creadas para Salón Aramis.");
                }

                // ── Servicios ────────────────────────────────────────────────
                var srvsAr = await context.Servicios.Where(s => s.NegocioId == negocioAramis.Id).ToListAsync();
                if (!srvsAr.Any())
                {
                    var catsCabello = catsAr.First(c => c.Nombre == "Corte y Peinado");
                    var catColor    = catsAr.First(c => c.Nombre == "Coloración");
                    var catNails    = catsAr.First(c => c.Nombre == "Manicure y Pedicure");
                    var catTrat     = catsAr.First(c => c.Nombre == "Tratamientos");
                    var srvCorteDama    = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catsCabello.Id, Nombre = "Corte de dama", Descripcion = "Corte moderno o clásico con lavado y secado.", DuracionMinutos = 45, Precio = 280m, Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvCorteSecado  = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catsCabello.Id, Nombre = "Corte con secado", Descripcion = "Corte profesional + secado y styling.", DuracionMinutos = 60, Precio = 350m, Orden = 2, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvBrushing     = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catsCabello.Id, Nombre = "Brushing", Descripcion = "Secado y ondas perfectas con cepillo.", DuracionMinutos = 40, Precio = 200m, Orden = 3, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvTinte        = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catColor.Id, Nombre = "Tinte completo", Descripcion = "Coloración completa con tinte profesional.", DuracionMinutos = 120, Precio = 800m, Orden = 4, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvMechas       = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catColor.Id, Nombre = "Mechas / Highlights", Descripcion = "Mechas californianas o babylights personalizadas.", DuracionMinutos = 150, Precio = 1100m, Orden = 5, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvManicure     = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catNails.Id, Nombre = "Manicure", Descripcion = "Limpieza, formado y esmaltado de uñas.", DuracionMinutos = 30, Precio = 180m, Orden = 6, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvPedicure     = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catNails.Id, Nombre = "Pedicure", Descripcion = "Tratamiento completo de pies con esmaltado.", DuracionMinutos = 45, Precio = 220m, Orden = 7, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var srvKeratina     = new Servicio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CategoriaId = catTrat.Id, Nombre = "Keratina brasileña", Descripcion = "Alisado semi-permanente con keratina de alta calidad.", DuracionMinutos = 180, Precio = 1500m, Orden = 8, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    await context.Servicios.AddRangeAsync(srvCorteDama, srvCorteSecado, srvBrushing, srvTinte, srvMechas, srvManicure, srvPedicure, srvKeratina);
                    await context.SaveChangesAsync();
                    srvsAr = [srvCorteDama, srvCorteSecado, srvBrushing, srvTinte, srvMechas, srvManicure, srvPedicure, srvKeratina];
                    Console.WriteLine("✓ 8 servicios creados para Salón Aramis.");
                }

                // ── Empleados + horarios + EmpleadoServicio ──────────────────
                var empsAr = await context.Empleados.Where(e => e.NegocioId == negocioAramis.Id).ToListAsync();
                if (!empsAr.Any())
                {
                    var empAramis    = new Empleado { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Aramis García",   Telefono = "+52 81 2345 0001", Email = "aramis@salonaramis.com",   Biografia = "Dueña y estilista principal. 8 años de experiencia en coloración y cortes modernos.", Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var empSofia     = new Empleado { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Sofía Hernández", Telefono = "+52 81 2345 0002", Email = "sofia.h@salonaramis.com",  Biografia = "Estilista con 4 años de experiencia. Especialista en cortes y brushing.",           Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var empValentina = new Empleado { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, Nombre = "Valentina Cruz",  Telefono = "+52 81 2345 0003", Email = "valentina@salonaramis.com", Biografia = "Esteticista certificada en uñas y tratamientos capilares.",                         Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    await context.Empleados.AddRangeAsync(empAramis, empSofia, empValentina);
                    await context.SaveChangesAsync();
                    empsAr = [empAramis, empSofia, empValentina];
                    Console.WriteLine("✓ 3 empleados creados para Salón Aramis.");

                    // Horarios empleados
                    var horariosA = new List<HorarioEmpleado>();
                    for (byte dia = 1; dia <= 5; dia++)
                    {
                        horariosA.Add(new HorarioEmpleado { Id = Guid.NewGuid(), EmpleadoId = empAramis.Id,    DiaSemana = dia, HoraInicio = TimeSpan.Parse("09:00"), HoraFin = TimeSpan.Parse("19:00"), Activo = 1 });
                        horariosA.Add(new HorarioEmpleado { Id = Guid.NewGuid(), EmpleadoId = empValentina.Id, DiaSemana = dia, HoraInicio = TimeSpan.Parse("10:00"), HoraFin = TimeSpan.Parse("18:00"), Activo = 1 });
                    }
                    horariosA.Add(new HorarioEmpleado { Id = Guid.NewGuid(), EmpleadoId = empAramis.Id, DiaSemana = 6, HoraInicio = TimeSpan.Parse("09:00"), HoraFin = TimeSpan.Parse("17:00"), Activo = 1 });
                    for (byte dia = 2; dia <= 6; dia++)
                        horariosA.Add(new HorarioEmpleado { Id = Guid.NewGuid(), EmpleadoId = empSofia.Id, DiaSemana = dia, HoraInicio = TimeSpan.Parse("10:00"), HoraFin = TimeSpan.Parse("20:00"), Activo = 1 });
                    await context.HorariosEmpleados.AddRangeAsync(horariosA);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Horarios asignados a empleados de Salón Aramis.");

                    // EmpleadoServicio
                    var srvCorteDama   = srvsAr.First(s => s.Nombre == "Corte de dama");
                    var srvCorteSecado = srvsAr.First(s => s.Nombre == "Corte con secado");
                    var srvBrushing    = srvsAr.First(s => s.Nombre == "Brushing");
                    var srvTinte       = srvsAr.First(s => s.Nombre == "Tinte completo");
                    var srvMechas      = srvsAr.First(s => s.Nombre == "Mechas / Highlights");
                    var srvManicure    = srvsAr.First(s => s.Nombre == "Manicure");
                    var srvPedicure    = srvsAr.First(s => s.Nombre == "Pedicure");
                    var srvKeratina    = srvsAr.First(s => s.Nombre == "Keratina brasileña");
                    var esAramis = new[] { srvCorteDama, srvCorteSecado, srvBrushing, srvTinte, srvMechas, srvKeratina }.Select(s => new EmpleadoServicio { EmpleadoId = empAramis.Id, ServicioId = s.Id });
                    var esSofia  = new[] { srvCorteDama, srvCorteSecado, srvBrushing, srvManicure }.Select(s => new EmpleadoServicio { EmpleadoId = empSofia.Id, ServicioId = s.Id });
                    var esValen  = new[] { srvManicure, srvPedicure, srvKeratina }.Select(s => new EmpleadoServicio { EmpleadoId = empValentina.Id, ServicioId = s.Id });
                    await context.EmpleadosServicios.AddRangeAsync(esAramis.Concat(esSofia).Concat(esValen));
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Servicios asignados a empleados de Salón Aramis.");
                }

                // ── Horarios del negocio ─────────────────────────────────────
                if (!await context.HorariosNegocios.AnyAsync(h => h.NegocioId == negocioAramis.Id))
                {
                    var horariosNeg = new List<HorarioNegocio>();
                    for (byte dia = 1; dia <= 5; dia++)
                        horariosNeg.Add(new HorarioNegocio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, DiaSemana = dia, HoraInicio = TimeSpan.Parse("09:00"), HoraFin = TimeSpan.Parse("19:00"), Activo = 1 });
                    horariosNeg.Add(new HorarioNegocio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, DiaSemana = 6, HoraInicio = TimeSpan.Parse("09:00"), HoraFin = TimeSpan.Parse("17:00"), Activo = 1 });
                    horariosNeg.Add(new HorarioNegocio { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, DiaSemana = 0, HoraInicio = TimeSpan.Parse("09:00"), HoraFin = TimeSpan.Parse("17:00"), Activo = 0 });
                    await context.HorariosNegocios.AddRangeAsync(horariosNeg);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Horarios del negocio Salón Aramis guardados.");
                }

                // ── Clientes ─────────────────────────────────────────────────
                var clisAr = await context.Clientes.Where(c => c.NegocioId == negocioAramis.Id).ToListAsync();
                if (!clisAr.Any())
                {
                    var cliMaria     = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "María González",   Telefono = "8112340001", Email = "maria.gonzalez@gmail.com",   FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliLaura     = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Laura Martínez",   Telefono = "8112340002", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliAna       = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Ana López",        Telefono = "8112340003", Email = "ana.lopez@hotmail.com",       FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliGabriela  = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Gabriela Torres",  Telefono = "8112340004", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliSofiaR    = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Sofía Ramírez",    Telefono = "8112340005", Email = "sofia.ramirez@gmail.com",     FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliIsabella  = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Isabella Vargas",  Telefono = "8112340006", Notas = "Alérgica al amoniaco. Usar tintes sin amoniaco.", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliDaniela   = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Daniela Morales",  Telefono = "8112340007", Email = "daniela.morales@gmail.com",   FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    var cliFernanda  = new Cliente { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, NombreCompleto = "Fernanda Sánchez", Telefono = "8112340008", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                    await context.Clientes.AddRangeAsync(cliMaria, cliLaura, cliAna, cliGabriela, cliSofiaR, cliIsabella, cliDaniela, cliFernanda);
                    await context.SaveChangesAsync();
                    clisAr = [cliMaria, cliLaura, cliAna, cliGabriela, cliSofiaR, cliIsabella, cliDaniela, cliFernanda];
                    Console.WriteLine("✓ 8 clientes creados para Salón Aramis.");

                    // citas se crean en el bloque siguiente junto con los demás clientes
                }

                // ── Citas ────────────────────────────────────────────────────
                if (!await context.Citas.AnyAsync(c => c.NegocioId == negocioAramis.Id))
                {
                    // Asegurar que tenemos empleados, servicios y clientes cargados
                    if (!empsAr.Any()) empsAr = await context.Empleados.Where(e => e.NegocioId == negocioAramis.Id).ToListAsync();
                    if (!srvsAr.Any()) srvsAr  = await context.Servicios.Where(s => s.NegocioId == negocioAramis.Id).ToListAsync();
                    if (!clisAr.Any()) clisAr  = await context.Clientes.Where(c => c.NegocioId == negocioAramis.Id).ToListAsync();

                    var empAramis    = empsAr.First(e => e.Nombre == "Aramis García");
                    var empSofia     = empsAr.First(e => e.Nombre == "Sofía Hernández");
                    var empValentina = empsAr.First(e => e.Nombre == "Valentina Cruz");
                    var srvCorteDama   = srvsAr.First(s => s.Nombre == "Corte de dama");
                    var srvCorteSecado = srvsAr.First(s => s.Nombre == "Corte con secado");
                    var srvBrushing    = srvsAr.First(s => s.Nombre == "Brushing");
                    var srvTinte       = srvsAr.First(s => s.Nombre == "Tinte completo");
                    var srvMechas      = srvsAr.First(s => s.Nombre == "Mechas / Highlights");
                    var srvManicure    = srvsAr.First(s => s.Nombre == "Manicure");
                    var srvPedicure    = srvsAr.First(s => s.Nombre == "Pedicure");
                    var srvKeratina    = srvsAr.First(s => s.Nombre == "Keratina brasileña");
                    var cliMaria     = clisAr.First(c => c.NombreCompleto == "María González");
                    var cliLaura     = clisAr.First(c => c.NombreCompleto == "Laura Martínez");
                    var cliAna       = clisAr.First(c => c.NombreCompleto == "Ana López");
                    var cliGabriela  = clisAr.First(c => c.NombreCompleto == "Gabriela Torres");
                    var cliSofiaR    = clisAr.First(c => c.NombreCompleto == "Sofía Ramírez");
                    var cliIsabella  = clisAr.First(c => c.NombreCompleto == "Isabella Vargas");
                    var cliDaniela   = clisAr.First(c => c.NombreCompleto == "Daniela Morales");
                    var cliFernanda  = clisAr.First(c => c.NombreCompleto == "Fernanda Sánchez");

                    var hoy     = DateTime.UtcNow.Date;
                    var ayer    = hoy.AddDays(-1);
                    var hace3   = hoy.AddDays(-3);
                    var hace5   = hoy.AddDays(-5);
                    var hace7   = hoy.AddDays(-7);
                    var hace10  = hoy.AddDays(-10);
                    var hace14  = hoy.AddDays(-14);
                    var hace20  = hoy.AddDays(-20);
                    var manana  = hoy.AddDays(1);
                    var en3     = hoy.AddDays(3);
                    var en7     = hoy.AddDays(7);

                    static string Codigo() => Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToUpper();

                    var citas = new List<Cita>
                    {
                        // ── Hace 20 días ──────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliSofiaR.Id,   EmpleadoId = empAramis.Id,   ServicioId = srvKeratina.Id,  InicioEn = hace20.AddHours(10), FinEn = hace20.AddHours(13),   Estado = EstadosCitas.Completada, Precio = srvKeratina.Precio,  FechaCreacion = hace20, FechaActualizacion = hace20 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliDaniela.Id,   EmpleadoId = empValentina.Id, ServicioId = srvManicure.Id,  InicioEn = hace20.AddHours(14), FinEn = hace20.AddHours(14.5), Estado = EstadosCitas.Completada, Precio = srvManicure.Precio,  FechaCreacion = hace20, FechaActualizacion = hace20 },

                        // ── Hace 14 días ──────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliMaria.Id,    EmpleadoId = empAramis.Id,   ServicioId = srvTinte.Id,     InicioEn = hace14.AddHours(10), FinEn = hace14.AddHours(12),   Estado = EstadosCitas.Completada, Precio = srvTinte.Precio,    FechaCreacion = hace14, FechaActualizacion = hace14 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliIsabella.Id, EmpleadoId = empValentina.Id, ServicioId = srvPedicure.Id,  InicioEn = hace14.AddHours(14), FinEn = hace14.AddHours(14.75),Estado = EstadosCitas.Completada, Precio = srvPedicure.Precio, FechaCreacion = hace14, FechaActualizacion = hace14 },

                        // ── Hace 10 días ──────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliFernanda.Id, EmpleadoId = empSofia.Id,    ServicioId = srvCorteDama.Id, InicioEn = hace10.AddHours(11), FinEn = hace10.AddHours(11.75),Estado = EstadosCitas.Completada, Precio = srvCorteDama.Precio,FechaCreacion = hace10, FechaActualizacion = hace10 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliLaura.Id,    EmpleadoId = empAramis.Id,   ServicioId = srvMechas.Id,    InicioEn = hace10.AddHours(14), FinEn = hace10.AddHours(16.5), Estado = EstadosCitas.Completada, Precio = srvMechas.Precio,   FechaCreacion = hace10, FechaActualizacion = hace10 },

                        // ── Hace 7 días ───────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliDaniela.Id,  EmpleadoId = empValentina.Id, ServicioId = srvManicure.Id,  InicioEn = hace7.AddHours(10),  FinEn = hace7.AddHours(10.5), Estado = EstadosCitas.Completada, Precio = srvManicure.Precio,  FechaCreacion = hace7, FechaActualizacion = hace7 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliGabriela.Id, EmpleadoId = empSofia.Id,    ServicioId = srvBrushing.Id,  InicioEn = hace7.AddHours(11),  FinEn = hace7.AddHours(11.67),Estado = EstadosCitas.Completada, Precio = srvBrushing.Precio,  FechaCreacion = hace7, FechaActualizacion = hace7 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliAna.Id,      EmpleadoId = empAramis.Id,   ServicioId = srvCorteSecado.Id,InicioEn = hace7.AddHours(13),  FinEn = hace7.AddHours(14),   Estado = EstadosCitas.Completada, Precio = srvCorteSecado.Precio,FechaCreacion = hace7, FechaActualizacion = hace7 },

                        // ── Hace 5 días ───────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliIsabella.Id, EmpleadoId = empValentina.Id, ServicioId = srvPedicure.Id,  InicioEn = hace5.AddHours(10),  FinEn = hace5.AddHours(10.75),Estado = EstadosCitas.Completada, Precio = srvPedicure.Precio, FechaCreacion = hace5, FechaActualizacion = hace5 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliMaria.Id,    EmpleadoId = empAramis.Id,   ServicioId = srvCorteDama.Id, InicioEn = hace5.AddHours(12),  FinEn = hace5.AddHours(12.75),Estado = EstadosCitas.Completada, Precio = srvCorteDama.Precio, FechaCreacion = hace5, FechaActualizacion = hace5 },

                        // ── Hace 3 días ───────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliLaura.Id,    EmpleadoId = empSofia.Id,    ServicioId = srvCorteDama.Id, InicioEn = hace3.AddHours(11),  FinEn = hace3.AddHours(11.75),Estado = EstadosCitas.Completada, Precio = srvCorteDama.Precio, FechaCreacion = hace3, FechaActualizacion = hace3 },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliDaniela.Id,  EmpleadoId = empValentina.Id, ServicioId = srvManicure.Id,  InicioEn = hace3.AddHours(15),  FinEn = hace3.AddHours(15.5), Estado = EstadosCitas.Inasistencia, Precio = srvManicure.Precio, FechaCreacion = hace3, FechaActualizacion = hace3 },

                        // ── Ayer ──────────────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliGabriela.Id, EmpleadoId = empAramis.Id,   ServicioId = srvTinte.Id,     InicioEn = ayer.AddHours(11),   FinEn = ayer.AddHours(13),    Estado = EstadosCitas.Completada, Precio = srvTinte.Precio,    FechaCreacion = ayer, FechaActualizacion = ayer },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliSofiaR.Id,   EmpleadoId = empSofia.Id,    ServicioId = srvCorteSecado.Id,InicioEn = ayer.AddHours(14),   FinEn = ayer.AddHours(15),    Estado = EstadosCitas.Completada, Precio = srvCorteSecado.Precio,FechaCreacion = ayer, FechaActualizacion = ayer },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliIsabella.Id, EmpleadoId = empValentina.Id, ServicioId = srvKeratina.Id,  InicioEn = ayer.AddHours(15),   FinEn = ayer.AddHours(18),    Estado = EstadosCitas.Completada, Precio = srvKeratina.Precio,  FechaCreacion = ayer, FechaActualizacion = ayer },

                        // ── HOY ───────────────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliMaria.Id,    EmpleadoId = empAramis.Id,   ServicioId = srvTinte.Id,     InicioEn = hoy.AddHours(10),    FinEn = hoy.AddHours(12),     Estado = EstadosCitas.Confirmada, Precio = srvTinte.Precio,    FechaCreacion = hoy.AddDays(-1), FechaActualizacion = hoy.AddDays(-1) },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliFernanda.Id, EmpleadoId = empSofia.Id,    ServicioId = srvCorteDama.Id, InicioEn = hoy.AddHours(11),    FinEn = hoy.AddHours(11.75),  Estado = EstadosCitas.Confirmada, Precio = srvCorteDama.Precio, FechaCreacion = hoy.AddDays(-1), FechaActualizacion = hoy.AddDays(-1) },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliAna.Id,      EmpleadoId = empValentina.Id, ServicioId = srvManicure.Id,  InicioEn = hoy.AddHours(10),    FinEn = hoy.AddHours(10.5),   Estado = EstadosCitas.Pendiente,  Precio = srvManicure.Precio,  FechaCreacion = hoy, FechaActualizacion = hoy },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliLaura.Id,    EmpleadoId = empAramis.Id,   ServicioId = srvCorteDama.Id, InicioEn = hoy.AddHours(13),    FinEn = hoy.AddHours(13.75),  Estado = EstadosCitas.Pendiente,  Precio = srvCorteDama.Precio, FechaCreacion = hoy, FechaActualizacion = hoy },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliIsabella.Id, EmpleadoId = empSofia.Id,    ServicioId = srvBrushing.Id,  InicioEn = hoy.AddHours(14.5),  FinEn = hoy.AddHours(15.17),  Estado = EstadosCitas.Pendiente,  Precio = srvBrushing.Precio,  FechaCreacion = hoy, FechaActualizacion = hoy },

                        // ── Mañana ────────────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliMaria.Id,    EmpleadoId = empAramis.Id,   ServicioId = srvMechas.Id,    InicioEn = manana.AddHours(10), FinEn = manana.AddHours(12.5),Estado = EstadosCitas.Confirmada, Precio = srvMechas.Precio,   FechaCreacion = hoy, FechaActualizacion = hoy },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliDaniela.Id,  EmpleadoId = empValentina.Id, ServicioId = srvPedicure.Id,  InicioEn = manana.AddHours(11), FinEn = manana.AddHours(11.75),Estado = EstadosCitas.Pendiente, Precio = srvPedicure.Precio, FechaCreacion = hoy, FechaActualizacion = hoy },

                        // ── En 3 días ─────────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliFernanda.Id, EmpleadoId = empSofia.Id,    ServicioId = srvCorteDama.Id, InicioEn = en3.AddHours(10),    FinEn = en3.AddHours(10.75), Estado = EstadosCitas.Pendiente, Precio = srvCorteDama.Precio, FechaCreacion = hoy, FechaActualizacion = hoy },
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliSofiaR.Id,   EmpleadoId = empAramis.Id,   ServicioId = srvTinte.Id,     InicioEn = en3.AddHours(14),    FinEn = en3.AddHours(16),    Estado = EstadosCitas.Pendiente, Precio = srvTinte.Precio,    FechaCreacion = hoy, FechaActualizacion = hoy },

                        // ── En 7 días ─────────────────────────────────────────
                        new Cita { Id = Guid.NewGuid(), NegocioId = negocioAramis.Id, CodigoConfirmacion = Codigo(), ClienteId = cliGabriela.Id, EmpleadoId = empAramis.Id,   ServicioId = srvKeratina.Id,  InicioEn = en7.AddHours(10),    FinEn = en7.AddHours(13),    Estado = EstadosCitas.Pendiente, Precio = srvKeratina.Precio,  FechaCreacion = hoy, FechaActualizacion = hoy },
                    };

                    await context.Citas.AddRangeAsync(citas);
                    await context.SaveChangesAsync();
                    Console.WriteLine($"✓ {citas.Count} citas creadas para Salón Aramis.");

                    // ── Actualizar estadísticas de clientes ───────────────────
                    var clientesIds = new[] { cliMaria.Id, cliLaura.Id, cliAna.Id, cliGabriela.Id, cliSofiaR.Id, cliIsabella.Id, cliDaniela.Id, cliFernanda.Id };
                    foreach (var cliId in clientesIds)
                    {
                        var citasCliente = citas.Where(c => c.ClienteId == cliId).ToList();
                        var cliente = await context.Clientes.FindAsync(cliId);
                        if (cliente is null) continue;
                        cliente.TotalCitas = citasCliente.Count;
                        cliente.CantidadInasistencias = citasCliente.Count(c => c.Estado == EstadosCitas.Inasistencia);
                        cliente.UltimaCitaEn = citasCliente.Max(c => c.InicioEn);
                        cliente.FechaActualizacion = DateTime.UtcNow;
                    }
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Estadísticas de clientes actualizadas.");
                }

                // ── Recuperación: usuarios de Salón Aramis si quedaron sin crear ──────
                var negAr = await context.Negocios.FirstOrDefaultAsync(n => n.Slug == "salon-aramis");
                if (negAr != null)
                {
                    if (await userManager.FindByEmailAsync("aramis@salon-aramis.com") is null)
                    {
                        var u = new ApplicationUser { Id = Guid.NewGuid(), UserName = "aramis@salon-aramis.com", Email = "aramis@salon-aramis.com", Nombre = "Aramis", Apellido = "García", NegocioId = negAr.Id, Activo = true, EmailConfirmed = true, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                        var res = await userManager.CreateAsync(u, "Aramis123!");
                        if (res.Succeeded)
                        {
                            await userManager.AddToRoleAsync(u, Roles.Propietario);
                            var emp = await context.Empleados.FirstOrDefaultAsync(e => e.NegocioId == negAr.Id && e.Email == "aramis@salonaramis.com");
                            if (emp != null) { emp.UsuarioId = u.Id; await context.SaveChangesAsync(); }
                            Console.WriteLine("✓ [Recuperación] Propietario aramis@salon-aramis.com creado.");
                        }
                        else Console.WriteLine($"✗ Error creando aramis: {string.Join(", ", res.Errors.Select(e => e.Description))}");
                    }
                    if (await userManager.FindByEmailAsync("sofia@salon-aramis.com") is null)
                    {
                        var u = new ApplicationUser { Id = Guid.NewGuid(), UserName = "sofia@salon-aramis.com", Email = "sofia@salon-aramis.com", Nombre = "Sofía", Apellido = "Hernández", NegocioId = negAr.Id, Activo = true, EmailConfirmed = true, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                        var res = await userManager.CreateAsync(u, "Sofia123!");
                        if (res.Succeeded)
                        {
                            await userManager.AddToRoleAsync(u, Roles.Empleado);
                            var emp = await context.Empleados.FirstOrDefaultAsync(e => e.NegocioId == negAr.Id && e.Email == "sofia.h@salonaramis.com");
                            if (emp != null) { emp.UsuarioId = u.Id; await context.SaveChangesAsync(); }
                            Console.WriteLine("✓ [Recuperación] Empleado sofia@salon-aramis.com creado.");
                        }
                    }
                    if (await userManager.FindByEmailAsync("valentina@salon-aramis.com") is null)
                    {
                        var u = new ApplicationUser { Id = Guid.NewGuid(), UserName = "valentina@salon-aramis.com", Email = "valentina@salon-aramis.com", Nombre = "Valentina", Apellido = "Cruz", NegocioId = negAr.Id, Activo = true, EmailConfirmed = true, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow };
                        var res = await userManager.CreateAsync(u, "Valentina123!");
                        if (res.Succeeded)
                        {
                            await userManager.AddToRoleAsync(u, Roles.Empleado);
                            var emp = await context.Empleados.FirstOrDefaultAsync(e => e.NegocioId == negAr.Id && e.Email == "valentina@salonaramis.com");
                            if (emp != null) { emp.UsuarioId = u.Id; await context.SaveChangesAsync(); }
                            Console.WriteLine("✓ [Recuperación] Empleado valentina@salon-aramis.com creado.");
                        }
                    }
                }

                Console.WriteLine("\n===========================================================================");
                Console.WriteLine("   Datos demo cargados exitosamente");
                Console.WriteLine("===========================================================================\n");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al cargar datos de prueba: {ex.Message}");
                throw;
            }
        }
    }
}
