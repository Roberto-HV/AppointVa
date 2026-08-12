namespace AppointVaAPI.Helpers
{
    public static class ZonaHorariaHelper
    {
        public static TimeZoneInfo Resolver(string? id)
        {
            var tzId = id ?? "Central Standard Time (Mexico)";
            try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); }
            catch (TimeZoneNotFoundException) { }

            if (TimeZoneInfo.TryConvertWindowsIdToIanaId(tzId, out var ianaId))
                try { return TimeZoneInfo.FindSystemTimeZoneById(ianaId); }
                catch { }

            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(tzId, out var winId))
                try { return TimeZoneInfo.FindSystemTimeZoneById(winId); }
                catch { }

            return TimeZoneInfo.Utc;
        }

        public static DateTimeOffset ToDateTimeOffset(DateTime localUnspecified, TimeZoneInfo tz) =>
            new DateTimeOffset(localUnspecified, tz.GetUtcOffset(localUnspecified));
    }
}
