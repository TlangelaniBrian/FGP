using System.IO;
using Microsoft.Extensions.Options;

namespace FGP.Api.Artifacts;

public sealed class ArtifactStorageOptions
{
    /// <summary>
    /// Where generated artifacts are written. Relative values resolve against the
    /// process working directory, which for `dotnet run` is the project directory —
    /// so this must not collide with a source folder. "artifacts" did: on a
    /// case-insensitive filesystem it resolved onto FGP.Api/Artifacts/, dropping
    /// generated PDFs into the source tree. The dot prefix keeps it distinct and
    /// ignorable. Deployments set an absolute path.
    /// </summary>
    public string StoragePath { get; init; } = ".artifacts";
}

public interface IArtifactStorage
{
    Task<string> SaveAsync(string key, byte[] content, CancellationToken cancellationToken);
    Task<Stream?> OpenAsync(string key, CancellationToken cancellationToken);
}

public sealed class LocalArtifactStorage : IArtifactStorage
{
    private readonly string _root;

    public LocalArtifactStorage(IOptions<ArtifactStorageOptions> options)
    {
        _root = Path.GetFullPath(options.Value.StoragePath);
    }

    public Task<string> SaveAsync(string key, byte[] content, CancellationToken cancellationToken)
    {
        var fullPath = Resolve(key);
        var directory = Path.GetDirectoryName(fullPath);
        if (directory is not null)
        {
            Directory.CreateDirectory(directory);
        }
        File.WriteAllBytes(fullPath, content);
        return Task.FromResult(key);
    }

    public Task<Stream?> OpenAsync(string key, CancellationToken cancellationToken)
    {
        var fullPath = Resolve(key);
        return Task.FromResult(File.Exists(fullPath)
            ? (Stream?)File.OpenRead(fullPath)
            : null);
    }

    private string Resolve(string key)
    {
        var candidate = Path.GetFullPath(Path.Combine(_root, key));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;
        if (!candidate.StartsWith(rootWithSeparator, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Artifact key escapes the configured storage root.");
        }
        return candidate;
    }
}
