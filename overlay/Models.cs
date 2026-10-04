namespace JMBNOverlay;

internal sealed record MissionOption(string Id, string Title, DateTimeOffset StartTime)
{
    public override string ToString() => $"{Title} // {StartTime:dd MMM HH:mm}";
}

internal sealed record CrewAssignment(
    string UserId,
    string Name,
    string? Station,
    string? Role,
    string Readiness
);
