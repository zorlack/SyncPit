# SyncPit Versioning & Docker Images

## Image Naming Scheme

All Docker images follow the pattern:
```
ghcr.io/zorlack/syncpit/<component>:<version>
```

**Components:**
- `welld` - The Well server (real-time sync daemon)

## Version Tags

### Release Tags (v1.2.3)

When you create a git tag like `v1.2.3`, Docker images are built with:
```
ghcr.io/zorlack/syncpit/welld:1.2.3
ghcr.io/zorlack/syncpit/welld:1.2
ghcr.io/zorlack/syncpit/welld:1
ghcr.io/zorlack/syncpit/welld:latest
```

**Creating a release:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Development Tags (main branch)

Commits to `main` branch are tagged as:
```
ghcr.io/zorlack/syncpit/welld:dev
ghcr.io/zorlack/syncpit/welld:0.0.0-dev
```

### Experimental Tags (experimental/* branches)

Commits to experimental branches like `experimental/synctest` are tagged as:
```
ghcr.io/zorlack/syncpit/welld:0.0.0-experimental-synctest
```

### Pull Request Tags

Pull requests are tagged with their PR number:
```
ghcr.io/zorlack/syncpit/welld:pr-42
```

### SHA Tags

All builds are also tagged with their git commit SHA:
```
ghcr.io/zorlack/syncpit/welld:experimental-synctest-a1b2c3d
```

## Using Images

**Latest stable release:**
```bash
docker pull ghcr.io/zorlack/syncpit/welld:latest
docker run -p 3000:3000 ghcr.io/zorlack/syncpit/welld:latest
```

**Development version:**
```bash
docker pull ghcr.io/zorlack/syncpit/welld:dev
docker run -p 3000:3000 ghcr.io/zorlack/syncpit/welld:dev
```

**Specific version:**
```bash
docker pull ghcr.io/zorlack/syncpit/welld:1.2.3
docker run -p 3000:3000 ghcr.io/zorlack/syncpit/welld:1.2.3
```

**Experimental feature:**
```bash
docker pull ghcr.io/zorlack/syncpit/welld:0.0.0-experimental-feature-name
docker run -p 3000:3000 ghcr.io/zorlack/syncpit/welld:0.0.0-experimental-feature-name
```

## Versioning Strategy

SyncPit follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** version: Incompatible API changes
- **MINOR** version: Backwards-compatible new features
- **PATCH** version: Backwards-compatible bug fixes

Pre-release versions use suffixes:
- `0.0.0-dev` - Current development (main branch)
- `0.0.0-experimental-<name>` - Experimental features
- `1.0.0-rc.1` - Release candidates
- `1.0.0-beta.1` - Beta releases

## Multi-Platform Support

All images are built for:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/aarch64)

Docker automatically pulls the correct architecture for your system.
