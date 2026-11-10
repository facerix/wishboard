<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $db = db_connect();
    $db->query('SELECT 1');
    $db->close();
    echo json_encode(['status' => 'ok']);
} catch (Throwable $error) {
    error_log('Wishboard API health check failed: ' . $error->getMessage());
    http_response_code(503);
    echo json_encode(['error' => 'Service unavailable']);
}
