<?php

declare(strict_types=1);

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo '{"ok":false,"error":{"code":"NOT_FOUND","message":"Ressource inexistante.","retryable":false}}';
