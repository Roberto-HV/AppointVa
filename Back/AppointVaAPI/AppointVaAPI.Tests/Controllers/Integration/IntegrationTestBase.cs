using System.Net.Http.Headers;

namespace AppointVaAPI.Tests.Controllers.Integration;

public abstract class IntegrationTestBase : IClassFixture<CustomWebApplicationFactory>
{
    protected readonly CustomWebApplicationFactory Factory;
    protected readonly HttpClient Client;

    protected IntegrationTestBase(CustomWebApplicationFactory factory)
    {
        Factory = factory;
        Client  = factory.CreateClient();
    }

    protected HttpClient NewClient() => Factory.CreateClient();

    protected HttpClient NewClient(string token)
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    protected void SetToken(string token) =>
        Client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

    protected void ClearToken() =>
        Client.DefaultRequestHeaders.Authorization = null;
}
