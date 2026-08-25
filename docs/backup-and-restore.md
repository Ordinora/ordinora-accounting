# Backup and restore runbook

## Scope

An Ordinora backup is complete only when it contains both PostgreSQL and the private accounting-document store. The backup script creates a timestamped, immutable package containing:

- `database.dump`, produced by `pg_dump` custom format without ownership or privilege statements;
- `documents/`, preserving tenant, quarantine, and accepted storage paths;
- `manifest.json`, containing SHA-256 hashes, file sizes, and core database row counts.

The package intentionally excludes `.env` and all credentials.

## Create and verify a backup

From the project directory in PowerShell:

```powershell
$backup = .\scripts\backup-ordinora.ps1 -BackupRoot "D:\OrdinoraBackups"
.\scripts\verify-ordinora-backup.ps1 -BackupPath $backup
```

`DATABASE_URL` and `DOCUMENT_STORAGE_ROOT` are read from the process environment, falling back to the local `.env` and development storage path. A production backup destination must be encrypted, access-controlled, and separate from the application server.

The PowerShell document-file backup applies only to `DOCUMENT_STORAGE_PROVIDER=local`. Production Azure Blob storage must use Azure-native container backup/versioning or a separately tested object-copy process. PostgreSQL and blob backups must share a recorded recovery point, retention policy, immutable/off-account copy, checksum or object-integrity verification, and restoration rehearsal.

## Restore rehearsal

Restoration is deliberately restricted to a database name ending in `_restore_test` and an empty, dedicated document directory:

```powershell
.\scripts\restore-ordinora-rehearsal.ps1 `
  -BackupPath "D:\OrdinoraBackups\ordinora-YYYYMMDD-HHMMSS-xxxxxxxx" `
  -RestoreDatabaseUrl "postgresql://user:password@localhost:5432/ordinora_restore_test?schema=public" `
  -RestoreDocumentRoot "D:\OrdinoraRestoreTest\documents"
```

The rehearsal verifies the manifest before restoration, recreates only the explicitly named disposable database, restores private files into the empty test directory, checks completed Prisma migrations, and compares company, user, journal, and document counts with the manifest.

## Production controls still required

- Encrypt backup media and transfer channels.
- Use a database role dedicated to backup/restore operations.
- Apply retention and deletion policies approved for client accounting records.
- Store at least one copy in a separate failure domain.
- Schedule backups and alert on failed jobs.
- Perform and record periodic restore rehearsals.
- Never treat synchronization software such as OneDrive as the sole backup mechanism.
