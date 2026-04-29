import { describe, it, expect } from "vitest";
import { resolveExternalRef } from "../src/core/ref-resolver";
import type { RepoFilePath } from "../src/adapters/types";

const GITHUB_FILE: RepoFilePath = {
  owner: "Apicurio",
  repo: "apicurio-registry",
  branch: "main",
  filePath: "app/src/test/resources/io/apicurio/registry/noprofile/maven/openapi-yaml/petstore-api.yaml",
};

const GITLAB_FILE: RepoFilePath = {
  owner: "my-org",
  repo: "my-project",
  branch: "master",
  filePath: "api/specs/petstore.yaml",
};

describe("resolveExternalRef", () => {
  it("resolves relative path on GitHub", () => {
    const url = resolveExternalRef("./Pet.yaml", GITHUB_FILE, "github");
    expect(url).toBe(
      "https://raw.githubusercontent.com/Apicurio/apicurio-registry/main/app/src/test/resources/io/apicurio/registry/noprofile/maven/openapi-yaml/Pet.yaml"
    );
  });

  it("resolves parent-relative path on GitHub", () => {
    const url = resolveExternalRef("../common/Error.yaml", GITHUB_FILE, "github");
    expect(url).toBe(
      "https://raw.githubusercontent.com/Apicurio/apicurio-registry/main/app/src/test/resources/io/apicurio/registry/noprofile/maven/common/Error.yaml"
    );
  });

  it("resolves relative path on GitLab", () => {
    const url = resolveExternalRef("./schemas/Pet.yaml", GITLAB_FILE, "gitlab");
    expect(url).toBe(
      "https://gitlab.com/my-org/my-project/-/raw/master/api/specs/schemas/Pet.yaml"
    );
  });

  it("returns full URLs unchanged", () => {
    const url = resolveExternalRef("https://example.com/spec.yaml", GITHUB_FILE, "github");
    expect(url).toBe("https://example.com/spec.yaml");
  });

  it("returns http URLs unchanged", () => {
    const url = resolveExternalRef("http://example.com/spec.yaml", GITLAB_FILE, "gitlab");
    expect(url).toBe("http://example.com/spec.yaml");
  });

  it("resolves repo-absolute paths (starting with /)", () => {
    const url = resolveExternalRef("/components/schemas/Error.yaml", GITHUB_FILE, "github");
    expect(url).toBe(
      "https://raw.githubusercontent.com/Apicurio/apicurio-registry/main/components/schemas/Error.yaml"
    );
  });

  it("handles file in repo root directory", () => {
    const rootFile: RepoFilePath = {
      owner: "owner",
      repo: "repo",
      branch: "main",
      filePath: "openapi.yaml",
    };
    const url = resolveExternalRef("./schemas/Pet.yaml", rootFile, "github");
    expect(url).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/schemas/Pet.yaml"
    );
  });
});
