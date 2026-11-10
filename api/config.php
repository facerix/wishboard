<?php
declare(strict_types=1);

/** Read the deliberately small KEY=value subset used by the server's .dbenv. */
function load_db_config(string $path): array
{
    $lines = @file($path, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        throw new RuntimeException('Cannot read database configuration');
    }

    $values = [];
    foreach ($lines as $index => $line) {
        if (trim($line) === '' || str_starts_with(ltrim($line), '#')) {
            continue;
        }
        if (!preg_match('/^([A-Z][A-Z0-9_]*)=(.*)$/D', $line, $match)) {
            throw new RuntimeException('Invalid database configuration on line ' . ($index + 1));
        }
        if (array_key_exists($match[1], $values)) {
            throw new RuntimeException('Duplicate database configuration key: ' . $match[1]);
        }
        $values[$match[1]] = $match[2];
    }

    foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as $key) {
        if (!isset($values[$key]) || $values[$key] === '') {
            throw new RuntimeException('Missing database configuration key: ' . $key);
        }
    }

    return $values;
}

function db_config_path(): string
{
    return __DIR__ . '/.dbenv';
}

function db_connect(): mysqli
{
    $config = load_db_config(db_config_path());
    $db = new mysqli($config['DB_HOST'], $config['DB_USER'], $config['DB_PASSWORD'], $config['DB_NAME']);
    if (!$db->set_charset('utf8mb4')) {
        throw new RuntimeException('Could not set database character set');
    }
    return $db;
}
