export const CURL = `curl -X POST 'https://api.acme-platform.io/v2/tenants/8f1c2d3e-4b5a-4c6d-9e7f-0a1b2c3d4e5f/customers/3fa85f64-5717-4562-b3fc-2c963f66afa6/orders' \\
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwaG9kZGVyIiwic2NvcGUiOiJyZWFkIn0.Qm9ndXNTaWduYXR1cmU' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Request-Id: 6b0e8a5a-0d1c-4ef4-8f3d-2a7f1b9c4d10' \\
  -d '{"productId":"d290f1ee-6c54-4b01-90e6-d701748f0851","quantity":2,"dryRun":true}'`

export const DOCKER = `docker run -d --name worker-blue \\
  -e DATABASE_URL=postgres://ops:s3cr3t@db.internal:5432/orders \\
  -e REDIS_URL=redis://cache.internal:6379/0 \\
  -e KAFKA_BROKERS=broker-1.internal:9092,broker-2.internal:9092 \\
  -e LOG_LEVEL=debug -e TENANT_ID=8f1c2d3e-4b5a-4c6d-9e7f-0a1b2c3d4e5f \\
  -p 8080:8080 -v /var/log/worker:/app/logs \\
  registry.acme.io/platform/order-worker:2.14.3 --concurrency 8 --dry-run false`
