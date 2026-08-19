/* eslint-disable @typescript-eslint/no-explicit-any */

const API_BASE = "https://appointva.onrender.com/api";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Parse the ISO string components directly to avoid server-UTC timezone shifts.
// The backend sends "2026-08-20T12:00:00" (local Mexico City time, no Z).
function formatearFecha(iso: string): string {
  const [datePart = "", timePart = "00:00"] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours = 0, minutes = 0] = timePart.split(":").map(Number);

  const h = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  const min = String(minutes).padStart(2, "0");

  return `${day} de ${MESES[(month ?? 1) - 1] ?? ""} de ${year}, ${h}:${min} ${ampm}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: any, res: any) {
  const codigo = (req.query.codigo as string) ?? "";

  try {
    const apiRes = await fetch(`${API_BASE}/publico/citas/${codigo}`);

    if (!apiRes.ok) {
      res.redirect(302, "/");
      return;
    }

    const cita = await apiRes.json();

    const negocioSlug: string = cita.negocioSlug ?? "";
    const redirectUrl = negocioSlug
      ? `/b/${negocioSlug}/confirmacion/${codigo}`
      : "/";

    const proto: string = (req.headers["x-forwarded-proto"] as string) ?? "https";
    const host: string = (req.headers["host"] as string) ?? "www.appointva.com";
    const canonicalUrl = `${proto}://${host}/cita/${codigo}`;

    const title = `Tu cita en ${cita.nombreNegocio ?? "AppointVa"}`;
    const description = [
      cita.nombreServicio,
      cita.nombreEmpleado ? `con ${cita.nombreEmpleado}` : null,
      cita.inicioEn ? `— ${formatearFecha(cita.inicioEn)}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="AppointVa" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta http-equiv="refresh" content="0; url=${esc(redirectUrl)}" />
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body></body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(html);
  } catch {
    res.redirect(302, "/");
  }
}
