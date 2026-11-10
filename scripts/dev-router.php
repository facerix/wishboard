<?php
declare(strict_types=1);

// PHP's built-in server ignores .htaccess, so mirror its dotfile rule here.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
foreach (explode('/', rawurldecode($path ?: '/')) as $segment) {
    if (str_starts_with($segment, '.')) {
        http_response_code(403);
        exit;
    }
}

return false;
