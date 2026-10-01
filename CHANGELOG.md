# Changelog

## 1.0.0

- Initial release: 66 operations across 11 resources, built from the Immofacile API V2
  OpenAPI specification (2.0.0).
- Two credentials: Client Credentials (exchanges client ID/secret for a Bearer token and
  refreshes it on expiry) and Access Token (a token you already hold). Both select the
  production or staging host.
- Multipart upload for the two product photo operations.
