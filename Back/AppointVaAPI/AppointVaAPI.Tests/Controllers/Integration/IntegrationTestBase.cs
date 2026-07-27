using System.Net.Http.Headers;

namespace AppointVaAPI.Tests.Controllers.Integration;

public abstract class IntegrationTestBase : IClassFixture<CustomWebApplicationFactory>
{
    protected readonly HttpClient Client;

    protected IntegrationTestBase(CustomWebApplicationFactory factory)
    {
        Client = factory.CreateClient();
    }

    protected void SetToken(string token) =>
        Client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

    protected void ClearToken() =>
        Client.DefaultRequestHeaders.Authorization = null;
}
