using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AppointVaAPI.Services
{
    public class PushService : IPushService
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<PushService> _logger;
        private readonly HttpClient _http;

        public PushService(ApplicationDbContext db, IConfiguration config,
                           ILogger<PushService> logger, IHttpClientFactory httpFactory)
        {
            _db = db;
            _config = config;
            _logger = logger;
            _http = httpFactory.CreateClient("WebPush");
        }

        // ── Guardar / eliminar suscripción ────────────────────────────────────────

        public async Task GuardarSuscripcionAsync(Guid usuarioId, string endpoint, string p256dh, string auth)
        {
            var existente = await _db.PushSuscripciones.FirstOrDefaultAsync(s => s.UsuarioId == usuarioId);
            if (existente is not null)
            {
                existente.Endpoint = endpoint;
                existente.P256dh = p256dh;
                existente.Auth = auth;
                existente.ActualizadaEn = DateTime.UtcNow;
            }
            else
            {
                _db.PushSuscripciones.Add(new PushSuscripcion
                {
                    Id = Guid.NewGuid(),
                    UsuarioId = usuarioId,
                    Endpoint = endpoint,
                    P256dh = p256dh,
                    Auth = auth,
                });
            }
            await _db.SaveChangesAsync();
        }

        public async Task EliminarSuscripcionAsync(Guid usuarioId)
        {
            var suscripcion = await _db.PushSuscripciones.FirstOrDefaultAsync(s => s.UsuarioId == usuarioId);
            if (suscripcion is not null)
            {
                _db.PushSuscripciones.Remove(suscripcion);
                await _db.SaveChangesAsync();
            }
        }

        // ── Notificación de nueva cita ─────────────────────────────────────────────

        public async Task EnviarNuevaCitaEmpleadoAsync(Guid citaId)
        {
            var cita = await _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .Include(c => c.Empleado)
                .FirstOrDefaultAsync(c => c.Id == citaId);

            if (cita is null) return;

            var backendUrl = _config["BackendUrl"] ?? string.Empty;
            var icalUrl = string.IsNullOrWhiteSpace(backendUrl) ? null
                : $"{backendUrl}/api/publico/citas/{cita.CodigoConfirmacion}/ical";
            var googleCalUrl = BuildGoogleCalendarUrl(cita);
            var payload = BuildPayloadNuevaCita(cita, icalUrl, googleCalUrl);

            if (cita.EmpleadoId != Guid.Empty)
            {
                var empleado = await _db.Empleados.FirstOrDefaultAsync(e => e.Id == cita.EmpleadoId);
                if (empleado?.UsuarioId is not null)
                {
                    var subEmpleado = await _db.PushSuscripciones
                        .FirstOrDefaultAsync(s => s.UsuarioId == empleado.UsuarioId.Value);
                    if (subEmpleado is not null)
                        await EnviarAsync(subEmpleado, payload);
                }
            }

            var roleId = await _db.Roles
                .Where(r => r.Name == Roles.Propietario)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (roleId == Guid.Empty) return;

            var propietarioIds = await _db.UserRoles
                .Where(ur => ur.RoleId == roleId)
                .Select(ur => ur.UserId)
                .ToListAsync();

            var propietarios = await _db.Users
                .Where(u => u.NegocioId == cita.NegocioId && propietarioIds.Contains(u.Id) && u.Activo)
                .ToListAsync();

            foreach (var propietario in propietarios)
            {
                var subProp = await _db.PushSuscripciones
                    .FirstOrDefaultAsync(s => s.UsuarioId == propietario.Id);
                if (subProp is not null)
                    await EnviarAsync(subProp, payload);
            }
        }

        // ── Prueba diagnóstica ────────────────────────────────────────────────────

        public async Task<string> EnviarPruebaAsync(Guid usuarioId)
        {
            var suscripcion = await _db.PushSuscripciones
                .FirstOrDefaultAsync(s => s.UsuarioId == usuarioId);

            if (suscripcion is null)
                return "sin_suscripcion";

            if (string.IsNullOrWhiteSpace(suscripcion.P256dh))
                throw new InvalidOperationException("DIAGNÓSTICO: P256dh en BD está vacío");
            if (string.IsNullOrWhiteSpace(suscripcion.Auth))
                throw new InvalidOperationException("DIAGNÓSTICO: Auth en BD está vacío");
            if (string.IsNullOrWhiteSpace(suscripcion.Endpoint))
                throw new InvalidOperationException("DIAGNÓSTICO: Endpoint en BD está vacío");

            var publicKey  = _config["Push:VapidPublicKey"];
            var privateKey = _config["Push:VapidPrivateKey"];

            if (string.IsNullOrWhiteSpace(publicKey))
                throw new InvalidOperationException("DIAGNÓSTICO: VAPID public key no configurada (Push__VapidPublicKey en Render)");
            if (string.IsNullOrWhiteSpace(privateKey))
                throw new InvalidOperationException("DIAGNÓSTICO: VAPID private key no configurada (Push__VapidPrivateKey en Render)");

            // Verificar tamaños de claves antes de operar
            var p256dhBytes  = UrlBase64Decode(suscripcion.P256dh);
            var authBytesDx  = UrlBase64Decode(suscripcion.Auth);
            var pubKeyBytes  = UrlBase64Decode(publicKey);
            var privKeyBytes = UrlBase64Decode(privateKey);

            if (p256dhBytes.Length != 65 && p256dhBytes.Length != 64)
                throw new InvalidOperationException(
                    $"DIAGNÓSTICO: P256dh tiene {p256dhBytes.Length} bytes (esperado 64 ó 65)");
            if (authBytesDx.Length != 16)
                throw new InvalidOperationException(
                    $"DIAGNÓSTICO: Auth tiene {authBytesDx.Length} bytes (esperado 16)");
            if (pubKeyBytes.Length != 65)
                throw new InvalidOperationException(
                    $"DIAGNÓSTICO: VAPID public key tiene {pubKeyBytes.Length} bytes (esperado 65)");
            if (privKeyBytes.Length != 32)
                throw new InvalidOperationException(
                    $"DIAGNÓSTICO: VAPID private key tiene {privKeyBytes.Length} bytes (esperado 32)");

            var payload = JsonSerializer.Serialize(new
            {
                title = "AppointVa · Prueba",
                body  = "Las notificaciones push funcionan.",
                url   = "/dashboard/perfil",
                icalUrl      = (string?)null,
                googleCalUrl = (string?)null
            });

            await EnviarConVapidAsync(suscripcion, payload, publicKey, privateKey);
            return "enviada";
        }

        // ── Internos ──────────────────────────────────────────────────────────────

        private async Task EnviarAsync(PushSuscripcion suscripcion, string payload)
        {
            var publicKey  = _config["Push:VapidPublicKey"];
            var privateKey = _config["Push:VapidPrivateKey"];

            if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey))
            {
                _logger.LogWarning("VAPID keys no configuradas. Push notification omitida.");
                return;
            }

            try
            {
                await EnviarConVapidAsync(suscripcion, payload, publicKey, privateKey);
            }
            catch (PushExpiredException)
            {
                _db.PushSuscripciones.Remove(suscripcion);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando push a {Endpoint}", suscripcion.Endpoint);
            }
        }

        private async Task EnviarConVapidAsync(PushSuscripcion suscripcion, string payload,
                                               string publicKey, string privateKey)
        {
            const string subject = "mailto:hola@appointva.com";

            string token;
            try { token = GenerarVapidJwt(suscripcion.Endpoint, publicKey, privateKey, subject); }
            catch (Exception ex) { throw new InvalidOperationException($"PASO-1-JWT [{ex.GetType().Name}]: {ex.Message}"); }

            byte[] contenidoCifrado;
            try { contenidoCifrado = CifrarPayloadRfc8291(payload, suscripcion.P256dh, suscripcion.Auth); }
            catch (InvalidOperationException) { throw; }
            catch (Exception ex) { throw new InvalidOperationException($"PASO-2-CIFRADO [{ex.GetType().Name}]: {ex.Message}"); }

            using var request = new HttpRequestMessage(HttpMethod.Post, suscripcion.Endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("vapid",
                $"t={token},k={publicKey}");
            request.Headers.TryAddWithoutValidation("TTL", "86400");
            request.Headers.TryAddWithoutValidation("Urgency", "high");

            var content = new ByteArrayContent(contenidoCifrado);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            content.Headers.TryAddWithoutValidation("Content-Encoding", "aes128gcm");
            request.Content = content;

            var response = await _http.SendAsync(request);

            if (response.StatusCode is System.Net.HttpStatusCode.Gone
                                    or System.Net.HttpStatusCode.NotFound)
                throw new PushExpiredException();

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException(
                    $"Push service {(int)response.StatusCode}: {body}");
            }
        }

        // ── VAPID JWT (ES256) usando ECDsa nativo de .NET ─────────────────────────

        private static string GenerarVapidJwt(string endpoint, string publicKeyB64,
                                              string privateKeyB64, string subject)
        {
            var privBytes = UrlBase64Decode(privateKeyB64); // 32 bytes (escalar D)
            var pubBytes  = UrlBase64Decode(publicKeyB64);  // 65 bytes (0x04 || X || Y)

            if (privBytes.Length != 32)
                throw new InvalidOperationException(
                    $"VAPID private key: se esperaban 32 bytes, hay {privBytes.Length}");
            if (pubBytes.Length != 65 || pubBytes[0] != 0x04)
                throw new InvalidOperationException(
                    $"VAPID public key: se esperaban 65 bytes (0x04||X||Y), hay {pubBytes.Length}");

            var ecParams = new ECParameters
            {
                Curve = ECCurve.NamedCurves.nistP256,
                D = privBytes,
                Q = new ECPoint
                {
                    X = pubBytes[1..33],
                    Y = pubBytes[33..65]
                }
            };

            using var ecdsa = ECDsa.Create(ecParams);

            var audience = new Uri(endpoint).GetLeftPart(UriPartial.Authority);
            var exp      = DateTimeOffset.UtcNow.AddHours(12).ToUnixTimeSeconds();

            var header  = UrlBase64Encode(Encoding.UTF8.GetBytes("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
            var jwtBody = UrlBase64Encode(Encoding.UTF8.GetBytes(
                $"{{\"aud\":\"{audience}\",\"exp\":{exp},\"sub\":\"{subject}\"}}"));
            var entrada = $"{header}.{jwtBody}";

            var firma = ecdsa.SignData(Encoding.UTF8.GetBytes(entrada),
                HashAlgorithmName.SHA256,
                DSASignatureFormat.IeeeP1363FixedFieldConcatenation);

            return $"{entrada}.{UrlBase64Encode(firma)}";
        }

        // ── Cifrado RFC 8291 (aes128gcm) con crypto nativo de .NET ───────────────

        private static byte[] CifrarPayloadRfc8291(string plaintext, string p256dhB64, string authB64)
        {
            var authBytes     = UrlBase64Decode(authB64);   // 16 bytes
            var receiverRaw   = UrlBase64Decode(p256dhB64); // 65 bytes normalmente

            // Normalizar a punto no comprimido de 65 bytes (0x04 || X || Y)
            byte[] receiverPub;
            if (receiverRaw.Length == 64)
            {
                receiverPub = new byte[65];
                receiverPub[0] = 0x04;
                receiverRaw.CopyTo(receiverPub, 1);
            }
            else if (receiverRaw.Length == 65 && receiverRaw[0] == 0x04)
            {
                receiverPub = receiverRaw;
            }
            else
            {
                throw new InvalidOperationException(
                    $"P256DH tiene formato inesperado: {receiverRaw.Length} bytes, primer byte 0x{receiverRaw[0]:X2}");
            }

            // PASO-B: Importar clave pública del receptor vía SubjectPublicKeyInfo DER
            ECDiffieHellman receiverEcdh;
            try
            {
                var spki = BuildP256Spki(receiverPub);
                var temp = ECDiffieHellman.Create();
                temp.ImportSubjectPublicKeyInfo(spki, out _);
                receiverEcdh = temp;
            }
            catch (Exception ex) { throw new InvalidOperationException($"PASO-B-SPKI [{ex.GetType().Name}]: {ex.Message}"); }

            using (receiverEcdh)
            {
                // PASO-C: Generar par efímero + ECDH
                byte[] sharedSecret, senderPub;
                try
                {
                    using var senderEcdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
                    senderPub    = ObtenerPuntoNoComprimido(senderEcdh);
                    sharedSecret = senderEcdh.DeriveRawSecretAgreement(receiverEcdh.PublicKey);
                }
                catch (Exception ex) { throw new InvalidOperationException($"PASO-C-ECDH [{ex.GetType().Name}]: {ex.Message}"); }

                // PASO-D: HKDF (RFC 8291)
                byte[] cek, nonce, senderPubLocal = senderPub;
                try
                {
                    var salt = new byte[16];
                    RandomNumberGenerator.Fill(salt);

                    var prkKey    = HKDF.Extract(HashAlgorithmName.SHA256, sharedSecret, authBytes);

                    // key_info = "WebPush: info" || 0x00 || ua_pub(65) || as_pub(65)
                    // RFC 8291 §3.3: info pasado a Expand debe ser key_info || 0x01
                    var labelInfo = Encoding.UTF8.GetBytes("WebPush: info\0");
                    var keyInfo   = new byte[labelInfo.Length + receiverPub.Length + senderPubLocal.Length + 1];
                    labelInfo.CopyTo(keyInfo, 0);
                    receiverPub.CopyTo(keyInfo, labelInfo.Length);
                    senderPubLocal.CopyTo(keyInfo, labelInfo.Length + receiverPub.Length);
                    keyInfo[^1] = 0x01;

                    var ikm    = HKDF.Expand(HashAlgorithmName.SHA256, prkKey, 32, keyInfo);
                    var prk    = HKDF.Extract(HashAlgorithmName.SHA256, ikm, salt);
                    cek        = HKDF.Expand(HashAlgorithmName.SHA256, prk, 16, BuildInfo("Content-Encoding: aes128gcm"));
                    nonce      = HKDF.Expand(HashAlgorithmName.SHA256, prk, 12, BuildInfo("Content-Encoding: nonce"));

                    // PASO-E: AES-128-GCM
                    var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
                    var padded         = new byte[plaintextBytes.Length + 1];
                    plaintextBytes.CopyTo(padded, 0);
                    padded[^1] = 0x02;

                    using var aesGcm = new AesGcm(cek, tagSizeInBytes: 16);
                    var ciphertext   = new byte[padded.Length];
                    var authTag      = new byte[16];
                    aesGcm.Encrypt(nonce, padded, ciphertext, authTag);

                    // Formato aes128gcm: salt(16) || rs(4 BE) || keylen(1=65) || sender_pub(65) || cipher || tag
                    int recordSize = 4096;
                    var result = new byte[16 + 4 + 1 + 65 + ciphertext.Length + 16];
                    int pos = 0;
                    salt.CopyTo(result, pos);                    pos += 16;
                    result[pos++] = (byte)(recordSize >> 24);
                    result[pos++] = (byte)(recordSize >> 16);
                    result[pos++] = (byte)(recordSize >> 8);
                    result[pos++] = (byte)recordSize;
                    result[pos++] = 65;
                    senderPubLocal.CopyTo(result, pos);          pos += 65;
                    ciphertext.CopyTo(result, pos);              pos += ciphertext.Length;
                    authTag.CopyTo(result, pos);

                    return result;
                }
                catch (InvalidOperationException) { throw; }
                catch (Exception ex) { throw new InvalidOperationException($"PASO-D/E-HKDF-AESGCM [{ex.GetType().Name}]: {ex.Message}"); }
            }
        }

        // ── Helpers crypto ────────────────────────────────────────────────────────

        // Construye el DER SubjectPublicKeyInfo (91 bytes) para P-256 uncompressed
        private static byte[] BuildP256Spki(byte[] uncompressedPoint)
        {
            // Estructura ASN.1:
            // 30 59 SEQUENCE (89 bytes)
            //   30 13 SEQUENCE (19 bytes)  ← AlgorithmIdentifier
            //     06 07 2A 86 48 CE 3D 02 01  ← OID ecPublicKey
            //     06 08 2A 86 48 CE 3D 03 01 07  ← OID prime256v1
            //   03 42 00  ← BIT STRING (66 bytes, 0 unused bits)
            //     04 [X(32)] [Y(32)]  ← uncompressed point
            ReadOnlySpan<byte> prefix = [
                0x30, 0x59,
                0x30, 0x13,
                0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01,
                0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07,
                0x03, 0x42, 0x00
            ];
            var spki = new byte[prefix.Length + uncompressedPoint.Length]; // 26 + 65 = 91 bytes
            prefix.CopyTo(spki);
            uncompressedPoint.CopyTo(spki, prefix.Length);
            return spki;
        }

        private static byte[] ObtenerPuntoNoComprimido(ECDiffieHellman key)
        {
            var p = key.ExportParameters(false);
            var result = new byte[65];
            result[0] = 0x04;
            p.Q.X!.CopyTo(result, 1);
            p.Q.Y!.CopyTo(result, 33);
            return result;
        }

        // Construye el info label HKDF: label_utf8 || 0x00 || 0x01
        private static byte[] BuildInfo(string label)
        {
            var labelBytes = Encoding.UTF8.GetBytes(label);
            var info       = new byte[labelBytes.Length + 2];
            labelBytes.CopyTo(info, 0);
            info[^2] = 0x00;
            info[^1] = 0x01;
            return info;
        }

        private static byte[] UrlBase64Decode(string input)
        {
            var s = input.Replace('-', '+').Replace('_', '/');
            s = s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
            return Convert.FromBase64String(s);
        }

        private static string UrlBase64Encode(byte[] input)
            => Convert.ToBase64String(input).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        // ── Payload builders ──────────────────────────────────────────────────────

        private static string BuildPayloadNuevaCita(Cita cita, string? icalUrl, string? googleCalUrl)
        {
            var cliente  = cita.Cliente?.NombreCompleto ?? "Un cliente";
            var servicio = cita.Servicio?.Nombre ?? "Servicio";
            var negocio  = cita.Negocio?.Nombre ?? "AppointVa";
            var hora     = cita.InicioEn.ToString("HH:mm");
            var fecha    = cita.InicioEn.ToString("dd/MM/yyyy");

            return JsonSerializer.Serialize(new
            {
                title = $"Nueva cita — {negocio}",
                body  = $"{cliente} · {servicio} · {fecha} {hora}",
                url   = "/citas",
                icalUrl,
                googleCalUrl
            });
        }

        private static string BuildGoogleCalendarUrl(Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} — {cita.Negocio?.Nombre ?? "AppointVa"}");
            var inicio   = cita.InicioEn.ToString("yyyyMMddTHHmmssZ");
            var fin      = cita.FinEn.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cliente: {cita.Cliente?.NombreCompleto ?? "—"}\nTel: {cita.Cliente?.Telefono ?? "—"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
        }

        // ── Excepción privada para suscripción expirada ───────────────────────────

        private sealed class PushExpiredException : Exception { }
    }
}
