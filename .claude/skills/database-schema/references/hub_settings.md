# hub_settings

Key-value configuration storage for system-wide settings.

## DDL
```sql
CREATE TABLE IF NOT EXISTS hub_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
INSERT OR IGNORE INTO hub_settings (key, value) VALUES ('stardom_dev_mode', '0');
INSERT OR IGNORE INTO hub_settings (key, value) VALUES ('hub_dev_mode', '0');
```

## Columns
- `key` - Setting identifier (primary key)
- `value` - Setting value (text-based)
- `updated_at` - Last update timestamp

## Relationships
- None (standalone configuration table)

## Usage
- Stores feature flags and system settings
- Pre-populated with `stardom_dev_mode` and `hub_dev_mode` defaults
- Access via `getSetting()` and `setSetting()` methods
- Simple key-value lookup pattern

## Business Logic
- Uses INSERT OR IGNORE for default values to avoid overwriting user changes
- Updated timestamps use localtime for readability
- ON CONFLICT handling in upserts preserves update timestamps
