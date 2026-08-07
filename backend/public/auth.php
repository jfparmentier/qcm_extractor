<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
require $projectRoot . '/src/Autoload.php';
QcmProxy\EmailAccessEndpoint::run($projectRoot);
